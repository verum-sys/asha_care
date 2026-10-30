import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyFacility, makePatient, makeReferral } from '../db/factory';

const state = vi.hoisted(() => ({ token: 'clerk-token' as string | null }));
vi.mock('../db/db', () => ({ notifyChange: vi.fn(), uid: (p = '') => `${p}uid-1` }));
vi.mock('./config', () => ({
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  isRemoteEnabled: () => true,
  getRemoteToken: async () => state.token,
}));

import { facilityAct, getRemoteCase, NotSignedInError, pullCases, pushRecords } from './remoteSupabase';

interface Call { method: string; url: string; headers: Record<string, string>; body?: unknown }
const calls: Call[] = [];
const emptyReply = (c: Call) => (c.method === 'GET' ? [] : undefined); // PostgREST answers GET with a JSON array
let respond: (c: Call) => unknown = emptyReply;

beforeEach(() => {
  calls.length = 0;
  state.token = 'clerk-token';
  respond = emptyReply;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const call: Call = { method: init.method!, url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    const out = respond(call);
    return new Response(out === undefined ? '' : JSON.stringify(out), { status: 200 });
  });
});

describe('remoteSupabase', () => {
  it('pushes patients, then referrals, then follow-ups, with the Clerk token and without facility facts', async () => {
    const patient = makePatient({ id: 'CL-1', name: 'A' });
    const referral = makeReferral({ id: 'REF-1', patientId: 'CL-1', referralDate: '2026-10-30', tier: 'phc' });
    await pushRecords([patient], [referral], [{ id: 'fu-1', referralId: 'REF-1', at: '2026-10-30T10:00:00Z', action: 'referral_sent', syncStatus: 'pending' }], '2026-10-30T11:00:00Z');

    expect(calls.map((c) => c.url.split('?')[0].split('/rest/v1/')[1])).toEqual(['patients', 'referrals', 'followups']);
    expect(calls[0].headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer clerk-token', Prefer: 'resolution=merge-duplicates,return=minimal' });
    expect(calls[1].url).toContain('on_conflict=id');
    const row = (calls[1].body as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ id: 'REF-1', patient_id: 'CL-1', tier: 'phc', updated_at: referral.updatedAt });
    expect(row).not.toHaveProperty('facility');
  });

  it('sends nothing and signals "not signed in" when there is no session', async () => {
    state.token = null;
    await expect(pushRecords([makePatient({ id: 'CL-1', name: 'A' })], [], [], 'x')).rejects.toBeInstanceOf(NotSignedInError);
    expect(calls).toHaveLength(0);
  });

  it('pulls changed rows, takes facility facts from the facility column, and advances the cursor', async () => {
    const referral = makeReferral({ id: 'REF-1', patientId: 'CL-1', referralDate: '2026-10-30' });
    const facility = { ...emptyFacility(), response: 'accepted' as const };
    respond = (c) => {
      if (c.url.includes('/referrals?')) return [{ id: 'REF-1', data: referral, facility, server_updated_at: '2026-10-30T12:00:02.5+00:00' }];
      if (c.url.includes('/patients?')) return [{ id: 'CL-1', data: makePatient({ id: 'CL-1', name: 'A' }), server_updated_at: '2026-10-30T12:00:01+00:00' }];
      return [];
    };
    const pulled = await pullCases('2026-10-30T11:00:00.000Z');

    expect(pulled.referrals[0].facility.response).toBe('accepted');
    expect(pulled.referrals[0].syncStatus).toBe('synced');
    expect(pulled.cursor).toBe('2026-10-30T12:00:02.5+00:00');
    // 10 second overlap before the cursor, URL-encoded
    expect(calls[0].url).toContain('server_updated_at=gt.2026-10-30T10%3A59%3A50.000Z');
  });

  it('keeps the old cursor when nothing changed, and pages through large result sets', async () => {
    expect((await pullCases('2026-10-30T11:00:00.000Z')).cursor).toBe('2026-10-30T11:00:00.000Z');
    calls.length = 0;
    const row = (i: number) => ({ id: `E${i}`, data: { id: `E${i}`, referralId: 'REF-1', at: 'x', kind: 'note' }, server_updated_at: `2026-10-30T12:00:00.${String(i % 1000).padStart(3, '0')}+00:00` });
    respond = (c) => {
      if (!c.url.includes('/facility_events?')) return [];
      return c.url.includes('offset=0') ? Array.from({ length: 500 }, (_, i) => row(i)) : [row(500)];
    };
    const pulled = await pullCases();
    expect(pulled.events).toHaveLength(501);
    expect(calls.filter((c) => c.url.includes('/facility_events?'))).toHaveLength(2);
  });

  it('records a facility action by patching only the facility column and adding an event', async () => {
    respond = (c) => (c.method === 'GET' ? [{ facility: emptyFacility() }] : undefined);
    await facilityAct('REF-1', { kind: 'accepted', text: 'ok' });

    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('referrals?id=eq.REF-1');
    expect(Object.keys(patch.body as object)).toEqual(['facility']);
    expect((patch.body as { facility: { response: string } }).facility.response).toBe('accepted');
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toContain('/facility_events');
    expect((post.body as { data: { kind: string } }[])[0].data.kind).toBe('accepted');
  });

  it('returns undefined for a case the server does not have', async () => {
    respond = () => [];
    expect(await getRemoteCase('REF-404')).toBeUndefined();
  });
});

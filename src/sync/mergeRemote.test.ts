import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyFacility, makePatient, makeReferral } from '../db/factory';
import type { FacilityEvent, FollowUp, Patient, Referral } from '../db/types';

type Store = 'patients' | 'referrals' | 'followups' | 'facility_events';
const db = vi.hoisted(() => ({ stores: {} as Record<string, Map<string, unknown>> }));
vi.mock('../db/db', () => ({
  getDB: async () => ({
    transaction: () => ({
      objectStore: (s: string) => ({ get: async (id: string) => db.stores[s].get(id), put: async (r: { id: string }) => void db.stores[s].set(r.id, r) }),
      done: Promise.resolve(),
    }),
  }),
}));

import { mergePulledCases } from './mergeRemote';

const put = (s: Store, r: { id: string }) => db.stores[s].set(r.id, r);
const get = <T,>(s: Store, id: string) => db.stores[s].get(id) as T;
const pulled = (p: Partial<{ patients: Patient[]; referrals: Referral[]; followUps: FollowUp[]; events: FacilityEvent[] }>) =>
  ({ patients: [], referrals: [], followUps: [], events: [], cursor: undefined, ...p });
const ref = (o: Partial<Referral>) => makeReferral({ id: 'REF-1', patientId: 'CL-1', referralDate: '2026-10-30', syncStatus: 'synced', ...o });

beforeEach(() => {
  db.stores = { patients: new Map(), referrals: new Map(), followups: new Map(), facility_events: new Map() };
});

describe('mergePulledCases', () => {
  it('adds cases created on other devices', async () => {
    const n = await mergePulledCases(pulled({ patients: [makePatient({ id: 'CL-1', name: 'A', syncStatus: 'synced' })], referrals: [ref({})] }));
    expect(n).toBe(2);
    expect(get('referrals', 'REF-1')).toBeTruthy();
  });

  it('replaces a synced local copy only when the server copy is newer', async () => {
    put('referrals', ref({ tier: 'asha', updatedAt: '2026-10-30T10:00:00.000Z' }));
    await mergePulledCases(pulled({ referrals: [ref({ tier: 'asha', reason: 'older', updatedAt: '2026-10-30T09:00:00.000Z' })] }));
    expect(get<Referral>('referrals', 'REF-1').reason).toBe('');
    await mergePulledCases(pulled({ referrals: [ref({ tier: 'phc', updatedAt: '2026-10-30T11:00:00.000Z' })] }));
    expect(get<Referral>('referrals', 'REF-1').tier).toBe('phc');
  });

  it('never overwrites unsent local edits, but still takes facility-owned facts', async () => {
    put('referrals', ref({ syncStatus: 'pending', reason: 'local edit', updatedAt: '2026-10-30T10:00:00.000Z' }));
    const facility = { ...emptyFacility(), response: 'accepted' as const, updatedAt: '2026-10-30T12:00:00.000Z' };
    await mergePulledCases(pulled({ referrals: [ref({ reason: 'server', updatedAt: '2026-10-30T11:00:00.000Z', facility })] }));
    const local = get<Referral>('referrals', 'REF-1');
    expect(local.reason).toBe('local edit');
    expect(local.syncStatus).toBe('pending');
    expect(local.facility.response).toBe('accepted');
  });

  it('does not rewrite anything when nothing changed', async () => {
    put('referrals', ref({}));
    const n = await mergePulledCases(pulled({ referrals: [ref({})] }));
    expect(n).toBe(0);
  });

  it('adds follow-ups and facility events only once', async () => {
    const fu: FollowUp = { id: 'fu-1', referralId: 'REF-1', at: 'x', action: 'referral_sent', syncStatus: 'synced' };
    const ev: FacilityEvent = { id: 'fe-1', referralId: 'REF-1', at: 'x', kind: 'accepted' };
    expect(await mergePulledCases(pulled({ followUps: [fu], events: [ev] }))).toBe(2);
    expect(await mergePulledCases(pulled({ followUps: [fu], events: [ev] }))).toBe(0);
  });
});

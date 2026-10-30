import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ remote: false, meta: new Map<string, unknown>() }));
vi.mock('../sync/config', () => ({ isRemoteEnabled: () => state.remote }));
vi.mock('./db', () => ({
  getDB: async () => ({ transaction: () => ({ objectStore: () => ({ put: async () => undefined }), done: Promise.resolve() }) }),
  getMeta: async (k: string) => state.meta.get(k),
  setMeta: async (k: string, v: unknown) => void state.meta.set(k, v),
  notifyChange: vi.fn(),
  uid: () => 'id',
}));

import { createCase } from './repo';

const draft = { reason: '', destinationFacility: '', referralDate: '2026-10-30', urgency: 'routine' as const, notes: '' };

beforeEach(() => {
  state.meta.clear();
});

describe('new record ids', () => {
  it('keep the plain counter format in local mode', async () => {
    state.remote = false;
    expect(await createCase({ name: 'A' }, draft, 'ASHA-1001')).toBe('REF-0001');
  });

  it('carry a per-device tag with a shared server, so two devices cannot both create REF-0001', async () => {
    state.remote = true;
    const first = await createCase({ name: 'A' }, draft, 'ASHA-1001');
    const second = await createCase({ name: 'B' }, draft, 'ASHA-1001');
    expect(first).toMatch(/^REF-[0-9A-Z]{4}-0001$/);
    expect(second).toMatch(/^REF-[0-9A-Z]{4}-0002$/);
    expect(first.slice(0, 9)).toBe(second.slice(0, 9));
  });
});

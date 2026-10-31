import { describe, expect, it } from 'vitest';
import { syncPillState } from './syncState';

const base = { online: true, syncing: false, syncFailed: false, needsSignIn: false, pending: 0 };

describe('syncPillState', () => {
  it('says saved when online and nothing is waiting', () => expect(syncPillState(base)).toBe('saved'));
  it('says waiting when changes are queued', () => expect(syncPillState({ ...base, pending: 3 })).toBe('waiting'));
  it('says sending while a sync runs', () => expect(syncPillState({ ...base, pending: 3, syncing: true })).toBe('sending'));
  it('says offline whatever else is true', () => expect(syncPillState({ ...base, online: false, pending: 3, syncFailed: true })).toBe('offline'));
  it('asks to sign in only when something is waiting', () => {
    expect(syncPillState({ ...base, pending: 2, needsSignIn: true })).toBe('signin');
    expect(syncPillState({ ...base, needsSignIn: true })).toBe('saved');
  });
  it('reports a failed attempt', () => expect(syncPillState({ ...base, pending: 1, syncFailed: true })).toBe('failed'));
});

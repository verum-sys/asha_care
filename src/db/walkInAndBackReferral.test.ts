import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePatient, makeReferral } from './factory';
import { createCase, createCaseForExistingPatient, updateVisitDetails } from './repo';

/** A tiny in-memory stand-in for IndexedDB: one Map per store. */
const state = vi.hoisted(() => ({ stores: new Map<string, Map<string, { id: string }>>(), meta: new Map<string, number>(), counter: 0 }));
const store = (name: string) => { if (!state.stores.has(name)) state.stores.set(name, new Map()); return state.stores.get(name)!; };
vi.mock('./db', () => ({
  getDB: async () => ({
    get: async (name: string, id: string) => structuredClone(store(name).get(id)),
    transaction: () => ({
      objectStore: (name: string) => ({ put: async (record: { id: string }) => { store(name).set(record.id, structuredClone(record)); } }),
      done: Promise.resolve(),
    }),
  }),
  notifyChange: vi.fn(), uid: (prefix = '') => `${prefix}${++state.counter}`,
  getMeta: async (key: string) => state.meta.get(key), setMeta: async (key: string, value: number) => { state.meta.set(key, value); },
}));
vi.mock('../sync/config', () => ({ isRemoteEnabled: () => false }));

beforeEach(() => { state.stores.clear(); state.meta.clear(); });

describe('patients who come straight to DH or TCC', () => {
  it('registers a new walk-in at TCC with today as the visit date and the chosen ASHA unit', async () => {
    const id = await createCase({ name: 'Kamla Bai', age: 62 }, { tier: 'tcc', unit: 'b', reason: 'Non-healing ulcer', urgency: 'urgent', referralDate: '2026-11-04', appointmentDate: '2026-11-04', destinationFacility: 'TCC (walk-in)', notes: 'Walk-in at TCC' }, 'Walk-in at TCC');
    const referral = store('referrals').get(id) as unknown as ReturnType<typeof makeReferral>;
    expect(referral).toMatchObject({ tier: 'tcc', unit: 'b', worker: { appointmentDate: '2026-11-04' } });
    expect(store('patients').size).toBe(1);
    expect(store('outbox').size).toBe(2);
  });

  it('links a traced walk-in to the earlier record and tells the earlier case', async () => {
    store('patients').set('CL-7', makePatient({ id: 'CL-7', name: 'Sunita Devi' }));
    store('referrals').set('REF-7', makeReferral({ id: 'REF-7', patientId: 'CL-7', referralDate: '2026-10-01', tier: 'phc', unit: 'c' }));
    const id = await createCaseForExistingPatient('CL-7', { tier: 'tcc', unit: 'c', reason: 'Growth in mouth', urgency: 'urgent', referralDate: '2026-11-04', appointmentDate: '2026-11-04', destinationFacility: 'TCC (walk-in)', notes: '' }, 'Walk-in at TCC', 'REF-7');
    const referral = store('referrals').get(id) as unknown as ReturnType<typeof makeReferral>;
    expect(referral).toMatchObject({ patientId: 'CL-7', linkedReferralId: 'REF-7', tier: 'tcc', unit: 'c' });
    expect(store('patients').size).toBe(1);
    const notes = [...store('followups').values()] as unknown as { referralId: string; note: string }[];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ referralId: 'REF-7' });
    expect(notes[0].note).toContain(`came directly to TCC`);
    expect(notes[0].note).toContain(id);
  });

  it('refuses to link to a patient that does not exist', async () => {
    await expect(createCaseForExistingPatient('CL-404', { reason: 'x', urgency: 'soon', referralDate: '2026-11-04', destinationFacility: '', notes: '' }, 'Walk-in')).rejects.toThrow('Patient not found');
  });
});

describe('back referral from TCC to ASHA', () => {
  it('sends the follow-up date and TCC\'s instructions back to ASHA when TCC records the visit', async () => {
    store('referrals').set('REF-9', makeReferral({ id: 'REF-9', patientId: 'CL-9', referralDate: '2026-10-01', tier: 'tcc', worker: { appointmentDate: '2020-01-01' } }));
    await updateVisitDetails('REF-9', { attendance: 'attended', note: '', nextAppointment: '2026-12-01', ashaNote: '  Check mouth opening weekly  ' });
    const referral = store('referrals').get('REF-9') as unknown as ReturnType<typeof makeReferral>;
    expect(referral).toMatchObject({ ashaFollowUpDate: '2026-12-01', ashaFollowUpNote: 'Check mouth opening weekly' });
    const back = ([...store('followups').values()] as unknown as { action: string; note: string }[]).find(f => f.action === 'returned_to_asha');
    expect(back?.note).toContain('Instructions for ASHA: Check mouth opening weekly');
  });
});

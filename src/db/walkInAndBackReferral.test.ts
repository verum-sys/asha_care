import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePatient, makeReferral } from './factory';
import { archiveCases, createCase, createCaseForExistingPatient, referToNextTier, sendBackToAsha, updateCaseClinical, updateVisitDetails } from './repo';
import type { Referral } from './types';

/** A tiny in-memory stand-in for IndexedDB: one Map per store. */
const state = vi.hoisted(() => ({ stores: new Map<string, Map<string, { id: string }>>(), meta: new Map<string, number>(), counter: 0 }));
const store = (name: string) => { if (!state.stores.has(name)) state.stores.set(name, new Map()); return state.stores.get(name)!; };
vi.mock('./db', () => ({
  getDB: async () => ({
    get: async (name: string, id: string) => structuredClone(store(name).get(id)),
    transaction: () => ({
      objectStore: (name: string) => ({ put: async (record: { id: string }) => { store(name).set(record.id, structuredClone(record)); }, get: async (id: string) => structuredClone(store(name).get(id)) }),
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
    store('referrals').set('REF-9', makeReferral({ id: 'REF-9', patientId: 'CL-9', referralDate: '2026-10-01', tier: 'tcc', worker: { appointmentDate: '2020-01-01' }, clinicalHandovers: [{ fromTier: 'dh', toTier: 'tcc', at: '2026-10-20T10:00:00Z' }] }));
    await updateVisitDetails('REF-9', { attendance: 'attended', note: '', nextAppointment: '2026-12-01', ashaNote: '  Check mouth opening weekly  ' });
    const referral = store('referrals').get('REF-9') as unknown as ReturnType<typeof makeReferral>;
    expect(referral).toMatchObject({ ashaFollowUpDate: '2026-12-01', ashaFollowUpNote: 'Check mouth opening weekly' });
    const back = ([...store('followups').values()] as unknown as { action: string; note: string }[]).find(f => f.action === 'returned_to_asha');
    expect(back?.note).toContain('Instructions for ASHA: Check mouth opening weekly');
  });
});

const ref = (id: string) => store('referrals').get(id) as unknown as Referral;
const fromAsha = [{ fromTier: 'asha' as const, toTier: 'phc' as const, at: '2026-10-01T10:00:00Z' }];

describe('counter referral: DH or TCC sends the patient back to their PHC and ASHA', () => {
  it('sends the date and note; a reason means something could not happen, and ASHA is alerted', async () => {
    store('referrals').set('R1', makeReferral({ id: 'R1', patientId: 'P', referralDate: '2026-11-01', tier: 'dh', unit: 'b' }));
    await sendBackToAsha('R1', { date: '2026-11-20', note: 'Remind her of the review', reason: 'Tests or reports still awaited' });
    expect(ref('R1')).toMatchObject({ ashaFollowUpDate: '2026-11-20', ashaFollowUpNote: 'Remind her of the review', ashaFollowUpReason: 'Tests or reports still awaited', ashaAlert: 'DH: Tests or reports still awaited', backReferredFrom: 'dh', unit: 'b' });
    const back = ([...store('followups').values()] as unknown as { action: string; note: string }[]).find(f => f.action === 'returned_to_asha');
    expect(back?.note).toContain('Could not happen: Tests or reports still awaited');
  });
  it('without a reason it is a normal back referral; TCC records the outcome', async () => {
    store('referrals').set('R2', makeReferral({ id: 'R2', patientId: 'P', referralDate: '2026-11-01', tier: 'tcc' }));
    await sendBackToAsha('R2', { date: '2026-12-01', note: 'Check she is eating well' });
    expect(ref('R2').ashaAlert).toBeUndefined();
    expect(ref('R2').worker.outcomeRecorded).toBe(true);
  });
  it('only DH and TCC send back, and they need a date and a note', async () => {
    store('referrals').set('R3', makeReferral({ id: 'R3', patientId: 'P', referralDate: '2026-11-01', tier: 'phc' }));
    await expect(sendBackToAsha('R3', { date: '2026-12-01', note: 'x' })).rejects.toThrow('Only DH and TCC');
    store('referrals').set('R4', makeReferral({ id: 'R4', patientId: 'P', referralDate: '2026-11-01', tier: 'tcc' }));
    await expect(sendBackToAsha('R4', { date: '', note: 'x' })).rejects.toThrow('date');
    await expect(sendBackToAsha('R4', { date: '2026-12-01', note: ' ' })).rejects.toThrow('note');
  });
});

describe('direct patients and the referral path', () => {
  it('refuses attendance for a patient who came directly to the tier', async () => {
    store('referrals').set('D1', makeReferral({ id: 'D1', patientId: 'P', referralDate: '2026-11-01', tier: 'tcc', worker: { appointmentDate: '2026-11-01' } }));
    await expect(updateVisitDetails('D1', { attendance: 'attended', note: '' })).rejects.toThrow('came directly');
  });
  it('a missed facility visit alerts ASHA; attending later clears it', async () => {
    store('referrals').set('M1', makeReferral({ id: 'M1', patientId: 'P', referralDate: '2026-11-01', tier: 'phc', worker: { appointmentDate: '2026-11-01' }, clinicalHandovers: fromAsha }));
    await updateVisitDetails('M1', { attendance: 'not_attended', note: '' });
    expect(ref('M1').ashaAlert).toBe('Missed the PHC appointment on 2026-11-01');
    await updateVisitDetails('M1', { attendance: 'attended', note: '' });
    expect(ref('M1').ashaAlert).toBeUndefined();
  });
  it('a direct DH patient can be referred to TCC with only the exam, keeping their PHC unit and a structured handover', async () => {
    store('referrals').set('D2', makeReferral({ id: 'D2', patientId: 'P', referralDate: '2026-11-01', tier: 'dh', unit: 'c', physicalExam: { pulseRate: 80, oralCavityFindings: 'Ulcer' } }));
    await referToNextTier('D2', 'tcc', 'TCC', 'Please see', 'urgent', 'a', '2026-11-10');
    const r = ref('D2');
    expect(r).toMatchObject({ tier: 'tcc', unit: 'c' });
    expect(r.clinicalHandovers?.[0].structuredSummary?.exam).toEqual([{ label: 'Pulse', value: '80 bpm' }, { label: 'Oral cavity', value: 'Ulcer' }]);
  });
  it('keeps every vitals check with its tier and time', async () => {
    store('referrals').set('V1', makeReferral({ id: 'V1', patientId: 'P', referralDate: '2026-11-01', tier: 'tcc' }));
    await updateCaseClinical('V1', { physicalExam: { pulseRate: 80, recordedAt: '2026-11-05T05:00:00Z' } });
    await updateCaseClinical('V1', { physicalExam: { pulseRate: 92, bpSystolic: 140, bpDiastolic: 90, recordedAt: '2026-11-05T09:30:00Z' } });
    await updateCaseClinical('V1', { physicalExam: { generalFindings: 'No vitals this time' } });
    expect(ref('V1').vitalsLog).toEqual([
      { at: '2026-11-05T05:00:00Z', tier: 'tcc', values: { pulseRate: 80 }, recordedBy: undefined },
      { at: '2026-11-05T09:30:00Z', tier: 'tcc', values: { pulseRate: 92, bpSystolic: 140, bpDiastolic: 90 }, recordedBy: undefined },
    ]);
  });
  it('archives cases instead of deleting them, and queues them for sync', async () => {
    store('referrals').set('A1', makeReferral({ id: 'A1', patientId: 'P', referralDate: '2026-11-01' }));
    await archiveCases(['A1', 'missing']);
    expect(ref('A1').archived).toBe(true);
    expect(store('outbox').has('referral:A1')).toBe(true);
  });
});

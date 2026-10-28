import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReferral } from './factory';
import { referToNextTier, updateCaseClinical, updateVisitDetails, updateCaseAttachment, addFollowUp } from './repo';
import type { Referral } from './types';
const state = vi.hoisted(() => ({ referrals: new Map<string, Referral>(), counter: 0 }));
vi.mock('./db', () => ({
  getDB: async () => ({
    get: async (_store: string, id: string) => structuredClone(state.referrals.get(id)),
    transaction: () => ({
      objectStore: (store: string) => ({ put: async (record: Referral) => { if (store === 'referrals') state.referrals.set(record.id, structuredClone(record)); } }),
      done: Promise.resolve(),
    }),
  }),
  notifyChange: vi.fn(), uid: () => `id-${++state.counter}`, getMeta: vi.fn(), setMeta: vi.fn(),
}));
beforeEach(() => state.referrals.clear());
describe('clinical handover persistence', () => {
  it('carries edited summaries and preserves PHC and DH notes through TCC', async () => {
    state.referrals.set('current', makeReferral({ id: 'current', patientId: 'patient', referralDate: '2026-10-25', tier: 'phc', notes: 'PHC clinical notes', physicalExam: { generalFindings: 'PHC examination' } }));
    await updateCaseClinical('current', { aiSummaryOverride: 'Edited PHC summary' });
    await referToNextTier('current', 'dh', 'District hospital', 'PHC referral reason');
    let record = state.referrals.get('current')!;
    expect(record.aiSummaryOverride).toBe('Edited PHC summary');
    expect(record.clinicalHandovers?.[0]).toMatchObject({ fromTier: 'phc', toTier: 'dh', aiSummary: 'Edited PHC summary', physicalExam: { generalFindings: 'PHC examination' } });
    expect(record.clinicalHandovers?.[0].notes).toContain('PHC clinical notes');
    await updateCaseClinical('current', { physicalExam: { generalFindings: 'DH examination' }, dhNotes: 'DH specialist notes', aiSummaryOverride: 'Edited DH summary' });
    await referToNextTier('current', 'tcc', 'Cancer centre');
    record = state.referrals.get('current')!;
    expect(record.clinicalHandovers).toHaveLength(2);
    expect(record.clinicalHandovers?.[0].physicalExam?.generalFindings).toBe('PHC examination');
    expect(record.clinicalHandovers?.[0].aiSummary).toBe('Edited PHC summary');
    expect(record.clinicalHandovers?.[1]).toMatchObject({ fromTier: 'dh', toTier: 'tcc', dhNotes: 'DH specialist notes', aiSummary: 'Edited DH summary', physicalExam: { generalFindings: 'DH examination' } });
    expect(record.notes).toContain('PHC clinical notes');
    expect(record.dhNotes).toBe('DH specialist notes');
  });
});

describe('editable visits and reports', () => {
  it('allows acceptance after a missed appointment and a later attendance update', async () => {
    state.referrals.set('visit', makeReferral({ id: 'visit', patientId: 'p', referralDate: '2026-10-20', worker: { appointmentDate: '2026-10-20', attendance: 'not_attended' } }));
    await updateVisitDetails('visit', { response: 'accepted', date: '2026-10-20', attendance: 'not_attended', note: 'Accepted later' });
    expect(state.referrals.get('visit')?.worker).toMatchObject({ facilityResponse: 'accepted', attendance: 'not_attended' });
    await updateVisitDetails('visit', { response: 'accepted', date: '2026-10-30', attendance: 'unknown', note: 'New visit booked' });
    expect(state.referrals.get('visit')?.worker).toMatchObject({ appointmentDate: '2026-10-30', attendance: 'unknown' });
    await updateVisitDetails('visit', { response: 'accepted', date: '2026-10-30', attendance: 'attended', note: 'Arrived' });
    expect(state.referrals.get('visit')?.worker.attendance).toBe('attended');
  });
  it('records attendance alone without touching acceptance or the appointment from the referral', async () => {
    state.referrals.set('att', makeReferral({ id: 'att', patientId: 'p', referralDate: '2026-10-20', worker: { appointmentDate: '2026-11-02', appointmentCertainty: 'tentative', facilityResponse: 'accepted' } }));
    await updateVisitDetails('att', { attendance: 'attended', note: 'Reached the PHC' });
    expect(state.referrals.get('att')?.worker).toMatchObject({ appointmentDate: '2026-11-02', appointmentCertainty: 'tentative', facilityResponse: 'accepted', attendance: 'attended' });
    await updateVisitDetails('att', { attendance: 'not_attended', note: '' });
    expect(state.referrals.get('att')?.worker).toMatchObject({ appointmentDate: '2026-11-02', facilityResponse: 'accepted', attendance: 'not_attended' });
  });
  it('edits a report without losing other reports or changing its identity', async () => {
    const report = { id: 'report', title: 'Original', fileName: 'report.pdf', fileSize: '1 MB', fileType: 'application/pdf', category: 'general' as const, uploadedAt: '2026-10-25', uploadedBy: 'Worker', dataUrl: 'data:application/pdf;base64,test' };
    state.referrals.set('case', makeReferral({ id: 'case', patientId: 'p', referralDate: '2026-10-25', reports: [report, { ...report, id: 'other' }] }));
    await updateCaseAttachment('case', { ...report, title: 'Corrected', findings: 'Updated findings' });
    expect(state.referrals.get('case')?.reports).toHaveLength(2);
    expect(state.referrals.get('case')?.reports?.[0]).toMatchObject({ id: 'report', title: 'Corrected', findings: 'Updated findings', dataUrl: report.dataUrl });
    await expect(updateCaseAttachment('case', { ...report, id: 'missing' })).rejects.toThrow('Report not found');
  });
});

describe('follow-up scope and care-stage visits', () => {
  it('allows loop closure only at TCC and blocks onward information from TCC', async () => {
    state.referrals.set('current', makeReferral({ id: 'current', patientId: 'p', referralDate: '2026-10-25', tier: 'phc' }));
    await expect(addFollowUp('current', { action: 'outcome_recorded', note: 'Done' })).rejects.toThrow('Only TCC');
    await updateCaseClinical('current', { tier: 'tcc' });
    await expect(addFollowUp('current', { action: 'info_sent_to_facility' })).rejects.toThrow('final care stage');
    await addFollowUp('current', { action: 'outcome_recorded', note: 'Outcome documented' });
    expect(state.referrals.get('current')?.worker.outcomeRecorded).toBe(true);
  });
  it('preserves the actual visit date in handover and resets attendance for the receiving stage', async () => {
    state.referrals.set('current', makeReferral({ id: 'current', patientId: 'p', referralDate: '2026-10-25', tier: 'phc' }));
    await addFollowUp('current', { action: 'patient_attended', date: '2026-10-20' });
    await referToNextTier('current', 'dh', 'DH');
    const record = state.referrals.get('current')!;
    expect(record.clinicalHandovers?.[0].visitStatus).toMatchObject({ attendance: 'attended', attendedDate: '2026-10-20' });
    expect(record.worker.attendance).toBeUndefined();
    expect(record.facility.attendance).toBe('unknown');
  });
});

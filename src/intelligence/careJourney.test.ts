import { describe, expect, it } from 'vitest';
import { careJourney } from './careJourney';
import { makePatient, makeReferral } from '../db/factory';
import type { CaseRecord } from '../db/repo';
function record(): CaseRecord { return { patient: makePatient({ id: 'p', name: 'Test patient' }), referral: makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-25', tier: 'tcc' }), followUps: [], facilityEvents: [] }; }
describe('patient care journey', () => {
  it('shows actual PHC and DH visit dates from stage-tagged follow-ups', () => {
    const data = record();
    data.followUps = [
      { id: '1', referralId: 'r', at: '2026-10-24T00:00:00Z', action: 'patient_attended', data: { tier: 'phc', date: '2026-10-20' }, syncStatus: 'pending' },
      { id: '2', referralId: 'r', at: '2026-10-24T00:00:00Z', action: 'patient_attended', data: { tier: 'dh', date: '2026-10-22' }, syncStatus: 'pending' },
    ];
    expect(careJourney(data).find(step => step.tier === 'phc')?.detail).toBe('Attended on 2026-10-20');
    expect(careJourney(data).find(step => step.tier === 'dh')?.detail).toBe('Attended on 2026-10-22');
  });
  it('does not describe a scheduled or missed appointment as an attended visit', () => {
    const data = record();
    data.referral.clinicalHandovers = [{ fromTier: 'phc', toTier: 'dh', at: '2026-10-23T00:00:00Z', visitStatus: { appointmentDate: '2026-10-20', attendance: 'not_attended' } }];
    data.referral.worker.appointmentDate = '2026-10-30';
    expect(careJourney(data).find(step => step.tier === 'phc')?.detail).toContain('Missed appointment (2026-10-20)');
    expect(careJourney(data).find(step => step.tier === 'tcc')?.detail).toContain('attendance not confirmed');
  });
  it('does not invent dates for legacy records', () => {
    const data = record();
    data.referral.clinicalHandovers = [{ fromTier: 'phc', toTier: 'dh', at: '2026-10-23T00:00:00Z', visitStatus: { attendance: 'attended', appointmentDate: '2026-10-20' } }];
    expect(careJourney(data)[1].detail).toContain('actual visit date not recorded');
    expect(careJourney(data)[1].detail).not.toContain('Attended on 2026-10-20');
  });
});

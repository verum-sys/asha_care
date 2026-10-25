import { describe, expect, it } from 'vitest';
import { nextCareTier, tierFollowUpOptions } from './tierFollowUpOptions';
describe('care-stage follow-up options', () => {
  it.each(['asha', 'phc', 'dh'] as const)('offers only attendance, rescheduling, onward referral and information for %s', tier => {
    expect(tierFollowUpOptions(tier)).toEqual(['patient_attended', 'patient_not_attended', 'rescheduled', 'refer_next_tier', 'info_sent_to_facility']);
  });
  it('lets only TCC close the loop with no onward information option', () => {
    expect(tierFollowUpOptions('tcc')).toEqual(['patient_attended', 'patient_not_attended', 'rescheduled', 'outcome_recorded']);
    expect(nextCareTier('phc')).toBe('dh');
    expect(nextCareTier('dh')).toBe('tcc');
    expect(nextCareTier('tcc')).toBeUndefined();
  });
});

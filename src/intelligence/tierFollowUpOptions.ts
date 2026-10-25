import type { CareTier, FollowUpAction } from '../db/types';
export type FollowUpChoice = FollowUpAction | 'refer_next_tier';
export function tierFollowUpOptions(tier: CareTier): FollowUpChoice[] {
  const common: FollowUpChoice[] = ['patient_attended', 'patient_not_attended', 'rescheduled'];
  return tier === 'tcc' ? [...common, 'outcome_recorded'] : [...common, 'refer_next_tier', 'info_sent_to_facility'];
}
export function nextCareTier(tier: CareTier): CareTier | undefined {
  return ({ asha: 'phc', phc: 'dh', dh: 'tcc' } as Partial<Record<CareTier, CareTier>>)[tier];
}

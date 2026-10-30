import type { CareTier, FollowUpAction } from '../db/types';
export type FollowUpChoice = FollowUpAction | 'refer_next_tier';
/** Record follow-up only reschedules the appointment; attendance and referral have their own buttons. */
export function tierFollowUpOptions(_tier: CareTier): FollowUpChoice[] {
  return ['rescheduled'];
}
export function nextCareTier(tier: CareTier): CareTier | undefined {
  return ({ asha: 'phc', phc: 'dh', dh: 'tcc' } as Partial<Record<CareTier, CareTier>>)[tier];
}

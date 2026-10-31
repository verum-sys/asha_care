import type { Attendance, CareTier } from '../db/types';

export type CaseAction = 'attendance' | 'refer' | 'followUp';

/**
 * The one thing most worth doing on a case right now. Everything else sits behind "More".
 * viewTier is the team looking at the case; holderTier is who holds the case now.
 */
export function primaryCaseAction({ viewTier, holderTier, attendance }: { viewTier: CareTier; holderTier: CareTier; attendance: Attendance }): CaseAction {
  if (viewTier !== holderTier) return 'followUp'; // already handed on: the referring team only follows up
  if (holderTier === 'asha') return 'refer';
  if (attendance !== 'attended') return 'attendance';
  return holderTier === 'tcc' ? 'followUp' : 'refer';
}

export const NEXT_TIER: Partial<Record<CareTier, CareTier>> = { asha: 'phc', phc: 'dh', dh: 'tcc' };

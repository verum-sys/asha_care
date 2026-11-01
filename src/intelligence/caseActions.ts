import type { Attendance, CareTier } from '../db/types';

export type CaseAction = 'attendance' | 'exam' | 'refer' | 'followUp';

/**
 * The one thing most worth doing on a case right now. Everything else sits behind "More".
 * viewTier is the team looking at the case; holderTier is who holds the case now.
 */
export function primaryCaseAction({ viewTier, holderTier, attendance, hasExam = true }: { viewTier: CareTier; holderTier: CareTier; attendance: Attendance; hasExam?: boolean }): CaseAction {
  if (viewTier !== holderTier) return 'followUp'; // already handed on: the referring team only follows up
  if (holderTier === 'asha') return 'refer';
  if (attendance !== 'attended') return 'attendance';
  if (holderTier !== 'tcc' && !hasExam) return 'exam';
  return holderTier === 'tcc' ? 'followUp' : 'refer';
}

export const NEXT_TIER: Partial<Record<CareTier, CareTier>> = { asha: 'phc', phc: 'dh', dh: 'tcc' };

/**
 * What PHC and DH must record before they can refer a case on: the patient's attendance and the physical examination.
 * Reports are optional. ASHA has no such step, and TCC has nowhere to refer.
 */
export function referralBlockers({ tier, attendance, hasExam }: { tier: CareTier; attendance: Attendance; hasExam: boolean }): Array<'attendance' | 'exam'> {
  if (tier !== 'phc' && tier !== 'dh') return [];
  const missing: Array<'attendance' | 'exam'> = [];
  if (attendance !== 'attended') missing.push('attendance');
  if (!hasExam) missing.push('exam');
  return missing;
}

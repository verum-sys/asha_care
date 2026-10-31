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

export interface ActionLocks { attendance?: string; followUp?: string }

/**
 * Actions that exist but cannot be used yet, with the reason (a message key) shown to the worker.
 * - A facility cannot record attendance or a follow-up before the appointment date arrives.
 * - ASHA cannot record a follow-up until the case has been referred.
 */
export function actionLocks({ viewTier, holderTier, appointmentDate, today, referred }: { viewTier: CareTier; holderTier: CareTier; appointmentDate?: string; today: string; referred: boolean }): ActionLocks {
  const locks: ActionLocks = {};
  const notYet = !!appointmentDate && appointmentDate.slice(0, 10) > today;
  if (viewTier !== 'asha' && viewTier === holderTier && notYet) {
    locks.attendance = 'Available from the appointment date';
    locks.followUp = 'Available from the appointment date';
  }
  if (viewTier === 'asha' && holderTier === 'asha' && !referred) locks.followUp = 'Follow-up starts after the referral';
  return locks;
}

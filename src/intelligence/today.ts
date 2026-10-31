import type { CareStateKey } from '../db/types';
import type { CaseSummary } from './priority';

/** Care states that mean someone should act today, whatever the date says. */
const ACT_NOW: CareStateKey[] = ['not_attended', 'appt_passed_unknown', 'follow_up_required', 'info_requested', 'declined', 'incomplete'];

export type TodayReason =
  | { kind: 'dueToday' }
  | { kind: 'overdue'; days: number }
  | { kind: 'state'; state: CareStateKey }
  | { kind: 'urgent' };

/** Why this case is on today's list, or undefined if it can wait. Closed cases never are. */
export function todayReason(c: Pick<CaseSummary, 'intel' | 'referral'>): TodayReason | undefined {
  const { intel, referral } = c;
  if (!intel.open) return undefined;
  const due = intel.dueInDays;
  if (due !== undefined && due < 0) return { kind: 'overdue', days: -due };
  if (due === 0) return { kind: 'dueToday' };
  if (ACT_NOW.includes(intel.careState)) return { kind: 'state', state: intel.careState };
  if (referral.urgency === 'urgent') return { kind: 'urgent' };
  return undefined;
}

export const needsToday = (c: Pick<CaseSummary, 'intel' | 'referral'>): boolean => !!todayReason(c);

/** The few cases to deal with first: those that need action today, highest priority first. */
export function pickToday<T extends Pick<CaseSummary, 'intel' | 'referral'>>(cases: T[], limit = 3): T[] {
  return cases.filter(needsToday).sort((a, b) => b.intel.priority - a.intel.priority).slice(0, limit);
}

/** A number to dial, or undefined. Keeps digits and a leading plus only. */
export function telHref(phone?: string): string | undefined {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 7 ? `tel:${digits}` : undefined;
}

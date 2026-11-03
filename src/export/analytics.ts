import type { CaseRecord } from '../db/repo';
import type { CareTier, CareUnit, Urgency } from '../db/types';
import { addDays, today } from '../intelligence/dates';
import { stageAt, tiersVisited } from './caseReport';

export const TIER_ORDER: CareTier[] = ['asha', 'phc', 'dh', 'tcc'];

export interface Analytics {
  total: number;
  highRisk: number;
  screened: number;
  loopsClosed: number;
  missed: number;
  walkIns: number;
  /** Cases that reached PHC, DH or TCC by any route. */
  reachedFacility: number;
  /** Cases that ever reached each tier. */
  reached: Record<CareTier, number>;
  /** Cases each tier holds right now. */
  current: Record<CareTier, number>;
  /** Attendance recorded at each tier (PHC, DH, TCC). */
  attendance: Record<'phc' | 'dh' | 'tcc', { attended: number; missed: number; pending: number }>;
  urgency: Record<Urgency, number>;
  /** How many screened patients scored 0..12 on CBAC Part A. */
  riskScores: number[];
  /** New cases in each of the last 8 weeks, oldest first. */
  weekly: { start: string; count: number }[];
}

const zero = () => ({ asha: 0, phc: 0, dh: 0, tcc: 0 });

export function computeAnalytics(cases: CaseRecord[], unit: CareUnit | 'all' = 'all', now = today()): Analytics {
  const list = unit === 'all' ? cases : cases.filter(c => (c.referral.unit || 'a') === unit);
  const a: Analytics = {
    total: list.length, highRisk: 0, screened: 0, loopsClosed: 0, missed: 0, walkIns: 0, reachedFacility: 0,
    reached: zero(), current: zero(),
    attendance: { phc: { attended: 0, missed: 0, pending: 0 }, dh: { attended: 0, missed: 0, pending: 0 }, tcc: { attended: 0, missed: 0, pending: 0 } },
    urgency: { routine: 0, soon: 0, urgent: 0 },
    riskScores: Array.from({ length: 13 }, () => 0),
    weekly: [],
  };
  // Eight weeks ending today.
  const starts = Array.from({ length: 8 }, (_, i) => addDays(now, -7 * (7 - i) - 6));
  a.weekly = starts.map(start => ({ start, count: 0 }));

  for (const c of list) {
    const r = c.referral;
    const cbac = r.screening?.cbac;
    if (cbac) {
      a.screened++;
      if (cbac.highRiskNcd) a.highRisk++;
      const score = Math.max(0, Math.min(12, Math.round(cbac.partA.totalScore || 0)));
      a.riskScores[score]++;
    }
    const path = tiersVisited(c);
    for (const tier of path) a.reached[tier]++;
    if (path.some(tier => tier !== 'asha')) a.reachedFacility++;
    a.current[r.tier || 'asha']++;
    a.urgency[r.urgency] = (a.urgency[r.urgency] ?? 0) + 1;
    if (r.ashaFollowUpDate) a.loopsClosed++;
    if (r.referringWorker?.startsWith('Walk-in')) a.walkIns++;
    for (const tier of ['phc', 'dh', 'tcc'] as const) {
      const stage = stageAt(c, tier);
      if (!stage) continue;
      const att = stage.visit.attendance ?? stage.facility?.attendance ?? 'unknown';
      if (att === 'attended') a.attendance[tier].attended++;
      else if (att === 'not_attended') { a.attendance[tier].missed++; a.missed++; }
      else a.attendance[tier].pending++;
    }
    const created = (r.createdAt || '').slice(0, 10);
    for (let i = a.weekly.length - 1; i >= 0; i--) {
      if (created >= a.weekly[i].start && created <= now) { a.weekly[i].count++; break; }
    }
  }
  return a;
}

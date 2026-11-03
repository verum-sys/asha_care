import type { CaseRecord } from '../db/repo';

const digits = (phone?: string) => (phone ?? '').replace(/\D/g, '').slice(-10);
const words = (text?: string) => (text ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const sameName = (a?: string, b?: string) => { const x = words(a).join(' '); return !!x && x === words(b).join(' '); };
/** Villages are typed loosely ("bero gaon", "Bero village"), so one shared word of 3+ letters counts. */
const samePlace = (a?: string, b?: string) => {
  const ignore = new Set(['village', 'gaon', 'gram', 'ward', 'block', 'zila', 'district', 'post']);
  const x = new Set(words(a).filter(w => w.length >= 3 && !ignore.has(w)));
  return words(b).some(w => x.has(w));
};

export interface TraceQuery { name?: string; phone?: string; locality?: string }

/**
 * People already in CareLink who may be this walk-in: the same 10-digit phone number, or the same name in the same
 * village. One entry per person, with their most recent case. Never a guess on name alone.
 */
export function traceMatches(cases: CaseRecord[], query: TraceQuery, limit = 3): CaseRecord[] {
  const phone = digits(query.phone);
  const byPatient = new Map<string, CaseRecord>();
  for (const c of cases) {
    const phoneMatch = phone.length === 10 && digits(c.patient.phone) === phone;
    const nameMatch = sameName(query.name, c.patient.name) && samePlace(query.locality, c.patient.locality);
    if (!phoneMatch && !nameMatch) continue;
    const seen = byPatient.get(c.patient.id);
    if (!seen || c.referral.updatedAt > seen.referral.updatedAt) byPatient.set(c.patient.id, c);
  }
  return [...byPatient.values()].sort((a, b) => b.referral.updatedAt.localeCompare(a.referral.updatedAt)).slice(0, limit);
}

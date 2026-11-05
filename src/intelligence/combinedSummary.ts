import type { LabTest, ReportAttachment } from '../db/types';
import { NOT_STATED } from './reportFields';

export interface CombinedRow { label: string; value: string; report: string; category: ReportAttachment['category'] }
export interface CombinedSummary {
  rows: CombinedRow[];
  flagged: (LabTest & { report: string })[];
  plain: { report: string; text: string }[];
  /** Reports with no structured values yet. */
  missing: ReportAttachment[];
}

const ORDER: ReportAttachment['category'][] = ['biopsy', 'radiology', 'general'];
const SKIP = new Set(['Report type']);

/**
 * One summary across all of a patient's reports: the values that matter for diagnosis (biopsy first, then imaging,
 * then lab), any out-of-range test, and each report's plain-words line. Built from the saved structured values.
 */
export function combineReports(reports: ReportAttachment[]): CombinedSummary {
  const sorted = [...reports].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  const out: CombinedSummary = { rows: [], flagged: [], plain: [], missing: [] };
  for (const r of sorted) {
    if (!r.aiFields) { out.missing.push(r); continue; }
    for (const [label, value] of Object.entries(r.aiFields)) {
      if (!value || value === NOT_STATED || SKIP.has(label)) continue;
      out.rows.push({ label, value, report: r.title, category: r.category });
    }
    for (const test of r.aiTests ?? []) if (test.flag && test.flag !== 'normal') out.flagged.push({ ...test, report: r.title });
    if (r.aiPlain) out.plain.push({ report: r.title, text: r.aiPlain });
  }
  return out;
}

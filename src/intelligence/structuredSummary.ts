import type { CareTier, PhysicalExamNotes, Referral, ReportAttachment, StructuredSummary } from '../db/types';
import { recordedVitals } from '../components/RecordedVitals';

/**
 * Which reports each tier passes on (from the clinician call): PHC sends its basic tests (CBC and other lab reports);
 * DH sends every report (lab, biopsy, radiology, other). TCC treats and passes nothing on.
 */
export const PASSED_ON: Record<CareTier, ReportAttachment['category'][]> = { asha: [], phc: ['general'], dh: ['general', 'biopsy', 'radiology'], tcc: [] };

const EXAM_FINDINGS: [keyof PhysicalExamNotes, string][] = [
  ['generalFindings', 'General examination'],
  ['systemicExam', 'Systemic examination'],
  ['oralCavityFindings', 'Oral cavity'],
  ['breastExamFindings', 'Breast'],
  ['cervicalExamFindings', 'Cervical'],
];

/** The examination as label/value rows: each vital sign, then each finding that was written. */
export function examRows(exam?: PhysicalExamNotes): { label: string; value: string }[] {
  if (!exam) return [];
  const rows = recordedVitals(exam).map(v => ({ label: v.label, value: v.value }));
  for (const [key, label] of EXAM_FINDINGS) {
    const value = exam[key];
    if (typeof value === 'string' && value.trim()) rows.push({ label, value: value.trim() });
  }
  return rows;
}

/**
 * The structured overview a tier hands to the next one: the examination values, and for each report passed on its
 * key values (from the reviewed AI extraction, otherwise the typed findings), a plain-words line and the report itself.
 */
export function buildStructuredSummary(referral: Pick<Referral, 'physicalExam' | 'reports' | 'biopsyReports' | 'radiologyReports' | 'tier'>, tier: CareTier): StructuredSummary {
  const categories = PASSED_ON[tier];
  const all = [...(referral.reports ?? []), ...(referral.biopsyReports ?? []), ...(referral.radiologyReports ?? [])];
  return {
    exam: examRows(referral.physicalExam),
    vitalsAt: referral.physicalExam?.recordedAt,
    reports: all.filter(r => categories.includes(r.category)).map(r => ({
      id: r.id, category: r.category, title: r.title,
      fields: r.aiFields, tests: r.aiTests, plain: r.aiPlain, findings: r.findings?.trim() || undefined,
    })),
  };
}

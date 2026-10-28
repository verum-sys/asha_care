import { useLang } from '../i18n';
import type { ClinicalHandover, PhysicalExamNotes } from '../db/types';
import { RecordedVitals, recordedVitals } from './RecordedVitals';

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Old saved summaries start with a "Care module / destination / priority" line and, for ASHA and PHC, report counts and a
 * copy of the handover notes. Drop those when displaying (the stored text is untouched) so the summary reads once, cleanly.
 */
export function tidySummary(summary: string, handover: Pick<ClinicalHandover, 'fromTier' | 'notes'>): string {
  const early = handover.fromTier === 'asha' || handover.fromTier === 'phc';
  const notes = normalise(handover.notes || '');
  return summary.split(/\n{2,}/).filter(paragraph => {
    const text = paragraph.trim();
    if (/^Care module:/i.test(text)) return false;
    if (early && /^Reports attached:/i.test(text)) return false;
    if (/^Handover notes:/i.test(text) && (early || normalise(text.replace(/^Handover notes:\s*/i, '')) === notes)) return false;
    return true;
  }).join('\n\n').trim();
}

/** Each distinct note and examination is shown once, at the first stage where it appears; the AI summary only at the ASHA stage. */
export function ClinicalHandovers({ handovers }: { handovers?: ClinicalHandover[] }) {
  const { t } = useLang();
  if (!handovers?.length) return null;
  const seen = new Set<string>();
  const once = (value: string | undefined) => {
    const key = value ? normalise(value) : '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const stages = handovers.map((handover, index) => {
    const exam: PhysicalExamNotes | undefined = handover.physicalExam;
    const vitals = recordedVitals(exam);
    const showVitals = vitals.length > 0 && once(`vitals ${JSON.stringify(vitals)}`);
    const rows = ([
      ['Clinical notes', handover.notes],
      ['General examination', exam?.generalFindings],
      ['Systemic examination', exam?.systemicExam],
      ['Oral examination', exam?.oralCavityFindings],
      ['Breast examination', exam?.breastExamFindings],
      ['Cervical examination', exam?.cervicalExamFindings],
      ['DH notes', handover.dhNotes],
      // The AI summary is shown once, in the ASHA section; later stages only add their own notes.
      ['Saved AI summary', handover.fromTier === 'asha' && handover.aiSummary ? tidySummary(handover.aiSummary, handover) : undefined],
    ] as const).filter(([, value]) => once(value)) as unknown as [string, string][];
    return { handover, index, exam, showVitals, rows };
  });
  return <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-3">
    <h3 className="text-sm font-bold text-sky-900">{t('Notes from previous care teams')}</h3>
    {stages.map(({ handover, index, exam, showVitals, rows }) => <details key={`${handover.at}-${index}`} open className="rounded-lg bg-white border border-sky-100 p-3 text-xs space-y-2">
      <summary className="font-semibold text-sky-900 cursor-pointer">{handover.fromTier.toUpperCase()} → {handover.toTier.toUpperCase()} · {new Date(handover.at).toLocaleDateString()}</summary>
      {showVitals && <RecordedVitals exam={exam} />}
      {rows.map(([label, value]) => <div key={label}><strong>{label}</strong><p className="whitespace-pre-wrap text-slate-700 mt-1">{value}</p></div>)}
      {!showVitals && !rows.length && <p className="text-slate-500">{t('Nothing new since the previous care team.')}</p>}
    </details>)}
  </section>;
}

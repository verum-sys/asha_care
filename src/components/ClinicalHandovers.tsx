import { useState, type ReactNode } from 'react';
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
  return <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold text-sky-900">{t('Notes from previous care teams')}</h3>
      <span className="text-[11px] text-slate-500">{t('Hover or tap a stage to see its notes.')}</span>
    </div>
    <ul className="space-y-1.5">
      {stages.map(({ handover, index, exam, showVitals, rows }) => <HandoverStage key={`${handover.at}-${index}`} id={`handover-${handover.fromTier}`}
        label={`${handover.fromTier.toUpperCase()} → ${handover.toTier.toUpperCase()} · ${new Date(handover.at).toLocaleDateString()}`}>
        {showVitals && <RecordedVitals exam={exam} />}
        {rows.map(([label, value]) => <div key={label}><strong>{label}</strong><p className="whitespace-pre-wrap text-slate-700 mt-1">{value}</p></div>)}
        {!showVitals && !rows.length && <p className="text-slate-500">{t('Nothing new since the previous care team.')}</p>}
      </HandoverStage>)}
    </ul>
  </section>;
}

/** One compact row per stage; its notes open in a popup on hover or keyboard focus, and on tap for touch screens. */
function HandoverStage({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  return <li id={id} className="group relative">
    <button type="button" aria-expanded={pinned} onClick={() => setPinned(open => !open)} onBlur={() => setPinned(false)}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-left text-xs font-semibold text-sky-900 hover:border-sky-300 focus:border-sky-400 focus:outline-none">
      <span>{label}</span><span aria-hidden="true" className="text-sky-500">ⓘ</span>
    </button>
    <div role="region" aria-label={label}
      className={`absolute left-0 top-full z-30 mt-1 w-[min(36rem,calc(100vw-2rem))] max-h-80 overflow-y-auto space-y-2 rounded-xl border border-sky-200 bg-white p-3 text-xs shadow-xl ${pinned ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}>
      {children}
    </div>
  </li>;
}

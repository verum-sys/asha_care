import { Fragment, useState, type ReactNode } from 'react';
import { useLang } from '../i18n';
import type { ClinicalHandover, PhysicalExamNotes, StructuredSummary } from '../db/types';
import { NOT_STATED } from '../intelligence/reportFields';
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
export function ClinicalHandovers({ handovers, onOpenReport }: { handovers?: ClinicalHandover[]; onOpenReport?: (reportId: string) => void }) {
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
    // With a structured overview, the examination findings are already in its table.
    if (handover.structuredSummary) for (const key of ['generalFindings', 'systemicExam', 'oralCavityFindings', 'breastExamFindings', 'cervicalExamFindings'] as const) once(exam?.[key]);
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
        {handover.structuredSummary ? <StructuredOverview summary={handover.structuredSummary} onOpenReport={onOpenReport} /> : showVitals && <RecordedVitals exam={exam} />}
        {rows.map(([label, value]) => <div key={label}><strong>{label}</strong><p className="whitespace-pre-wrap text-slate-700 mt-1">{value}</p></div>)}
        {!showVitals && !rows.length && !handover.structuredSummary && <p className="text-slate-500">{t('Nothing new since the previous care team.')}</p>}
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

const CATEGORY_LABEL = { general: 'Lab / other', biopsy: 'Biopsy', radiology: 'Radiology' } as const;

/** The structured handover: examination values, then each report with a plain-words overview, its key values, and the report itself. */
export function StructuredOverview({ summary, onOpenReport }: { summary: StructuredSummary; onOpenReport?: (reportId: string) => void }) {
  const { t } = useLang();
  return <div className="space-y-2" data-testid="structured-overview">
    {summary.exam.length > 0 && <div>
      <strong>{t('Examination')}</strong>{summary.vitalsAt && <span className="text-slate-500"> · {t('checked')} {new Date(summary.vitalsAt).toLocaleString()}</span>}
      <table className="mt-1 w-full border border-slate-200"><tbody>{summary.exam.map(row => <tr key={row.label} className="border-t border-slate-100"><th scope="row" className="w-1/3 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-600">{t(row.label)}</th><td className="px-2 py-1 text-slate-800">{row.value}</td></tr>)}</tbody></table>
    </div>}
    {summary.reports.length > 0 && <div className="space-y-1.5">
      <strong>{t('Reports')}</strong>
      {summary.reports.map(report => {
        const values = Object.entries(report.fields ?? {}).filter(([, v]) => v && v !== NOT_STATED);
        return <div key={report.id} className="rounded-lg border border-slate-200 p-2 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase">{t(CATEGORY_LABEL[report.category])}</span> <span className="font-semibold">{report.title}</span></span>
            {onOpenReport && <button type="button" className="text-sky-700 font-semibold underline" onClick={() => onOpenReport(report.id)}>{t('Open report')}</button>}
          </div>
          {report.plain && <p className="text-slate-800">{report.plain}</p>}
          {values.length > 0 && <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">{values.map(([k, v]) => <Fragment key={k}><dt className="text-slate-500">{t(k)}</dt><dd className="text-slate-800">{v}</dd></Fragment>)}</dl>}
          {!!report.tests?.length && <p className="text-slate-700">{report.tests.filter(x => x.flag && x.flag !== 'normal').map(x => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ''} (${x.flag})`).join(' · ') || t('All listed results within range.')}</p>}
          {!values.length && !report.tests?.length && <p className="text-slate-700">{report.findings || t('PDF attached, no findings entered.')}</p>}
        </div>;
      })}
    </div>}
  </div>;
}

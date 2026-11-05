import { useState } from 'react';
import { useLang } from '../i18n';
import { updateCaseAttachment } from '../db/repo';
import type { Patient, ReportAttachment } from '../db/types';
import { combineReports } from '../intelligence/combinedSummary';
import { extractReport, withExtraction } from '../intelligence/extractReport';
import { getRemoteToken } from '../sync/config';

const ORDER: ReportAttachment['category'][] = ['biopsy', 'radiology', 'general'];
const CATEGORY_LABEL = { general: 'Lab / other', biopsy: 'Biopsy', radiology: 'Radiology' } as const;

/**
 * Summary of all the reports on a case, in one place. Reports without structured values can be read in one go
 * ("Summarise all reports"); each is read on this device and only its text, without patient identifiers, goes to the AI.
 */
export function CombinedReportSummary({ referralId, reports, patient, onEditReport }: {
  referralId: string; reports: ReportAttachment[]; patient: Pick<Patient, 'name' | 'phone' | 'id'>; onEditReport?: (report: ReportAttachment) => void;
}) {
  const { t } = useLang();
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<{ title: string; error: string }[]>([]);
  if (!reports.length) return null;
  const summary = combineReports(reports);
  const done = reports.length - summary.missing.length;

  async function summariseAll() {
    setRunning(true); setFailed([]);
    const errors: { title: string; error: string }[] = [];
    try {
      const token = await getRemoteToken();
      if (!token) throw new Error('Please sign in again to make the structured report.');
      const todo = summary.missing;
      for (let i = 0; i < todo.length; i++) {
        const report = todo[i];
        setProgress(t('Reading report {n} of {total}: {title}', { n: i + 1, total: todo.length, title: report.title }));
        try {
          const x = await extractReport(report, patient, token);
          await updateCaseAttachment(referralId, withExtraction(report, x));
        } catch (e) { errors.push({ title: report.title, error: e instanceof Error ? t(e.message) : t('Structured report unavailable. Please retry.') }); }
      }
    } catch (e) { errors.push({ title: '', error: e instanceof Error ? t(e.message) : t('Structured report unavailable. Please retry.') }); }
    setFailed(errors); setProgress(''); setRunning(false);
  }

  return <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2 text-xs" data-testid="combined-summary">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-violet-900">{t('Summary of all reports')}</h3>
      <span className="text-slate-500">{t('{done} of {total} reports summarised', { done, total: reports.length })}</span>
    </div>
    {summary.rows.length > 0 && <table className="w-full border border-slate-200 bg-white">
      <tbody>{summary.rows.map((row, i) => <tr key={`${row.report}-${row.label}-${i}`} className="border-t border-slate-100 align-top">
        <th scope="row" className="w-1/3 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-600">{t(row.label)}</th>
        <td className="px-2 py-1 text-slate-800">{row.value} <span className="text-[10px] font-semibold uppercase text-slate-400">· {t(CATEGORY_LABEL[row.category])}</span></td>
      </tr>)}</tbody>
    </table>}
    {summary.flagged.length > 0 && <p className="text-slate-800"><strong>{t('Out of range')}:</strong> {summary.flagged.map(x => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ''} (${t(x.flag ?? '')})`).join(' · ')}</p>}
    {summary.plain.length > 0 && <div className="space-y-0.5"><strong>{t('In plain words')}</strong>{summary.plain.map(p => <p key={p.report} className="text-slate-700">{p.text}</p>)}</div>}
    {summary.missing.length > 0 && <div className="space-y-1.5">
      <p className="text-slate-600">{t('Not summarised yet')}: {summary.missing.map(r => r.title).join(', ')}</p>
      <button type="button" className="btn btn-primary !min-h-[36px] px-3 text-xs" disabled={running} onClick={() => void summariseAll()}>{running ? progress || t('Opening the report…') : summary.missing.length === reports.length ? t('Summarise all reports') : t('Summarise the remaining reports')}</button>
    </div>}
    {failed.map(f => <p key={f.title + f.error} role="alert" className="text-rose-700">{f.title ? `${f.title}: ` : ''}{f.error}</p>)}
    {onEditReport && done > 0 && <div className="flex flex-wrap gap-1.5">{[...reports].filter(r => r.aiFields).sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category)).map(r => <button key={r.id} type="button" className="text-violet-800 font-semibold underline" onClick={() => onEditReport(r)}>{t('Check')} {r.title}</button>)}</div>}
    <p className="text-[11px] text-slate-500">{t('AI read from the reports. Check values against the original report before acting on them.')}</p>
  </section>;
}

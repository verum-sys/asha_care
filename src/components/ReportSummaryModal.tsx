import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLang } from '../i18n';
import { updateCaseAttachment } from '../db/repo';
import type { LabTest, Patient, ReportAttachment, ReportFields } from '../db/types';
import type { ReportText } from '../intelligence/reportText';
import { extractReport, withExtraction } from '../intelligence/extractReport';
import { cleanFields, REPORT_FIELDS, NOT_STATED } from '../intelligence/reportFields';

type Step = 'saved' | 'reading' | 'summarising' | 'done' | 'error';
const FLAG_CLASS: Record<string, string> = { high: 'text-rose-700 font-bold', low: 'text-sky-700 font-bold', abnormal: 'text-amber-700 font-bold' };

/**
 * Structured report (trial): the report's key values in fixed fields, for the doctor. The report is read on this
 * device (OCR for scanned pages); only its text, without the patient's name, phone or ID, goes to the AI, which fills
 * the fields with the report's own values ("Not stated" when absent). The doctor checks and edits before saving; it is
 * kept apart from the findings they typed.
 */
export function ReportSummaryModal({ referralId, report, patient, onClose }: { referralId: string; report: ReportAttachment; patient: Pick<Patient, 'name' | 'phone' | 'id'>; onClose: () => void }) {
  const { t } = useLang();
  const { getToken } = useAuth();
  const hasSaved = !!report.aiFields;
  const [step, setStep] = useState<Step>(hasSaved ? 'saved' : 'reading');
  const [progress, setProgress] = useState('');
  const [read, setRead] = useState<ReportText | null>(null);
  const [fields, setFields] = useState<ReportFields>(report.aiFields ?? cleanFields(report.category, {}));
  const [tests, setTests] = useState<LabTest[]>(report.aiTests ?? []);
  const [plain, setPlain] = useState(report.aiPlain ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showText, setShowText] = useState(false);
  const run = useRef(0);

  async function start() {
    const id = ++run.current;
    setStep('reading'); setError(''); setRead(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again to make the structured report.');
      const x = await extractReport(report, patient, token, d => {
        if (run.current !== id) return;
        if (d.stage === 'ai') { setStep('summarising'); return; }
        setProgress(d.stage === 'ocr' ? t('Reading scanned page {page} of {pages} with OCR ({percent}%)', { page: d.page ?? 1, pages: d.pages ?? 1, percent: d.percent ?? 0 }) : d.stage === 'reading' ? t('Reading page {page} of {pages}', { page: d.page ?? 1, pages: d.pages ?? 1 }) : t('Opening the report…'));
      });
      if (run.current !== id) return;
      setRead({ text: x.text, source: x.source, pages: 0 });
      setFields(x.fields);
      setTests(x.tests);
      setPlain(x.plain);
      setStep('done');
    } catch (e) {
      if (run.current !== id) return;
      setError(e instanceof Error ? t(e.message) : t('Structured report unavailable. Please retry.'));
      setStep('error');
    }
  }

  useEffect(() => {
    if (!hasSaved) void start();
    return () => { run.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      await updateCaseAttachment(referralId, withExtraction(report, { fields, tests, plain: plain.trim(), source: read?.source ?? report.aiSummarySource ?? 'text' }));
      onClose();
    } catch { setError(t('The structured report could not be saved. Please retry.')); setSaving(false); }
  }

  const ready = step === 'done' || step === 'saved';
  return <div role="dialog" aria-modal="true" aria-labelledby="ai-report-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
    <div className="bg-white rounded-2xl p-5 w-full max-w-2xl space-y-3 max-h-[90vh] overflow-y-auto">
      <div>
        <h2 id="ai-report-title" className="text-lg font-bold">{t('Structured report')}</h2>
        <p className="text-sm text-slate-700">{report.title}</p>
        <p className="text-xs text-muted">{t('Trial feature. The report is read on this device; only its text, without the patient\'s name, phone or ID, is sent to the AI. Check every value against the original report.')}</p>
      </div>

      {(step === 'reading' || step === 'summarising') && <p role="status" className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">{step === 'reading' ? progress || t('Opening the report…') : t('Reading the values from the report…')}</p>}

      {step === 'error' && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 space-y-2"><p>{error}</p><button type="button" className="btn btn-secondary text-xs" onClick={() => void start()}>{t('Try again')}</button></div>}

      {ready && <>
        {step === 'saved' && <p className="text-xs text-muted">{t('Saved structured report. You can edit it, or read the report again.')}</p>}
        {read && <p className="text-xs text-muted">{read.source === 'ocr' ? t('Read with OCR (scanned report): check numbers and spellings carefully.') : t('Read from the text inside the PDF.')}</p>}
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden" data-testid="structured-fields">
          <tbody>{REPORT_FIELDS[report.category].map(field => (
            <tr key={field} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="w-2/5 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold text-slate-600 align-top">{t(field)}</th>
              <td className="px-1 py-1"><input aria-label={t(field)} value={fields[field] ?? ''} onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))} className={`!min-h-[34px] !py-1 text-sm ${(fields[field] ?? NOT_STATED) === NOT_STATED ? 'text-slate-400' : ''}`} /></td>
            </tr>
          ))}</tbody>
        </table>
        {tests.length > 0 && <table className="w-full text-xs border border-slate-200" data-testid="structured-tests">
          <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left">{t('Test')}</th><th className="px-2 py-1 text-left">{t('Result')}</th><th className="px-2 py-1 text-left">{t('Reference range')}</th></tr></thead>
          <tbody>{tests.map((test, i) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{test.name}</td><td className={`px-2 py-1 ${FLAG_CLASS[test.flag ?? ''] ?? ''}`}>{test.value}{test.unit ? ` ${test.unit}` : ''}{test.flag && test.flag !== 'normal' ? ` (${t(test.flag)})` : ''}</td><td className="px-2 py-1 text-slate-500">{test.range ?? ''}</td></tr>)}</tbody>
        </table>}
        <label className="block text-sm font-semibold">{t('In plain words (for the next team)')}<textarea rows={2} value={plain} onChange={e => setPlain(e.target.value)} /></label>
      </>}

      {read && <div>
        <button type="button" className="text-xs font-semibold text-sky-700 underline" onClick={() => setShowText(s => !s)}>{showText ? t('Hide the text that was read') : t('Show the text that was read')}</button>
        {showText && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">{read.text || '—'}</pre>}
      </div>}

      <div className="flex flex-wrap justify-end gap-2">
        {step === 'saved' && <button type="button" className="btn btn-secondary text-xs" onClick={() => void start()}>{t('Read the report again')}</button>}
        <button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Close')}</button>
        {ready && <button type="button" className="btn btn-primary text-xs" disabled={saving} onClick={() => void save()}>{saving ? t('Saving…') : t('Save structured report')}</button>}
      </div>
    </div>
  </div>;
}

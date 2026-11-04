import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLang } from '../i18n';
import { updateCaseAttachment } from '../db/repo';
import type { Patient, ReportAttachment } from '../db/types';
import { readReportText, redactPatient, type ReportText } from '../intelligence/reportText';

const MAX_CHARS = 11500;
type Step = 'saved' | 'reading' | 'summarising' | 'done' | 'error';

/**
 * AI summary of an uploaded report (trial). The report is read on this device (OCR for scanned pages); only the text,
 * with the patient's name, phone and ID removed, goes to the AI service. The doctor reviews and saves the draft; it is
 * stored apart from the findings they typed.
 */
export function ReportSummaryModal({ referralId, report, patient, onClose }: { referralId: string; report: ReportAttachment; patient: Pick<Patient, 'name' | 'phone' | 'id'>; onClose: () => void }) {
  const { t } = useLang();
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>(report.aiSummary ? 'saved' : 'reading');
  const [progress, setProgress] = useState('');
  const [read, setRead] = useState<ReportText | null>(null);
  const [summary, setSummary] = useState(report.aiSummary ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showText, setShowText] = useState(false);
  const run = useRef(0);

  async function start() {
    const id = ++run.current;
    setStep('reading'); setError(''); setSummary(''); setRead(null);
    try {
      const result = await readReportText(report, (stage, d) => {
        if (run.current !== id) return;
        setProgress(stage === 'ocr' ? t('Reading scanned page {page} of {pages} with OCR ({percent}%)', { page: d?.page ?? 1, pages: d?.pages ?? 1, percent: d?.percent ?? 0 }) : stage === 'reading' ? t('Reading page {page} of {pages}', { page: d?.page ?? 1, pages: d?.pages ?? 1 }) : t('Opening the report…'));
      });
      if (run.current !== id) return;
      setRead(result);
      const text = redactPatient(result.text, patient);
      if (text.replace(/\s/g, '').length < 20) throw new Error(t('No readable text was found in this report.'));
      setStep('summarising');
      const token = await getToken();
      if (!token) throw new Error(t('Please sign in again to use the AI summary.'));
      const response = await fetch('/api/interpret-answer', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'report-summary', kind: report.category, context: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[report text cut here]` : text }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.summary !== 'string') throw new Error(data.error || t('AI summary unavailable. Please retry.'));
      if (run.current !== id) return;
      setSummary(data.summary);
      setStep('done');
    } catch (e) {
      if (run.current !== id) return;
      setError(e instanceof Error ? t(e.message) : t('AI summary unavailable. Please retry.'));
      setStep('error');
    }
  }

  useEffect(() => {
    if (!report.aiSummary) void start();
    return () => { run.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      await updateCaseAttachment(referralId, { ...report, aiSummary: summary.trim(), aiSummaryAt: new Date().toISOString(), aiSummarySource: read?.source ?? report.aiSummarySource });
      onClose();
    } catch { setError(t('The summary could not be saved. Please retry.')); setSaving(false); }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="ai-report-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
    <div className="bg-white rounded-2xl p-5 w-full max-w-xl space-y-3 max-h-[90vh] overflow-y-auto">
      <div>
        <h2 id="ai-report-title" className="text-lg font-bold">{t('AI summary of the report')}</h2>
        <p className="text-sm text-slate-700">{report.title}</p>
        <p className="text-xs text-muted">{t('Trial feature. The report is read on this device; only its text, without the patient\'s name, phone or ID, is sent to the AI. Always check the draft against the original report.')}</p>
      </div>

      {(step === 'reading' || step === 'summarising') && <p role="status" className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">{step === 'reading' ? progress || t('Opening the report…') : t('Writing the summary…')}</p>}

      {step === 'error' && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 space-y-2"><p>{error}</p><button type="button" className="btn btn-secondary text-xs" onClick={() => void start()}>{t('Try again')}</button></div>}

      {(step === 'done' || step === 'saved') && <>
        {step === 'saved' && <p className="text-xs text-muted">{t('Saved summary. You can edit it, or make a new one from the report.')}</p>}
        {read && <p className="text-xs text-muted">{read.source === 'ocr' ? t('Read with OCR (scanned report): check numbers and spellings carefully.') : t('Read from the text inside the PDF.')}</p>}
        <label htmlFor="ai-report-summary" className="block text-sm font-semibold">{t('Summary (AI draft, edit if needed)')}</label>
        <textarea id="ai-report-summary" rows={10} value={summary} onChange={e => setSummary(e.target.value)} className="font-mono text-sm" />
      </>}

      {read && <div>
        <button type="button" className="text-xs font-semibold text-sky-700 underline" onClick={() => setShowText(s => !s)}>{showText ? t('Hide the text that was read') : t('Show the text that was read')}</button>
        {showText && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">{read.text || '—'}</pre>}
      </div>}

      <div className="flex flex-wrap justify-end gap-2">
        {step === 'saved' && <button type="button" className="btn btn-secondary text-xs" onClick={() => void start()}>{t('Make a new summary')}</button>}
        <button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Close')}</button>
        {(step === 'done' || step === 'saved') && <button type="button" className="btn btn-primary text-xs" disabled={saving || summary.trim().length < 20} onClick={() => void save()}>{saving ? t('Saving…') : t('Save summary')}</button>}
      </div>
    </div>
  </div>;
}

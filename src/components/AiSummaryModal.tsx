import { useLang } from '../i18n';
import { recordedVitals } from './RecordedVitals';
import { useEffect, useState } from 'react';
import { updateCaseClinical, type CaseRecord } from '../db/repo';
import type { CareTier } from '../db/types';
interface Props { caseRecord: CaseRecord | null; viewerTier?: CareTier | 'super_admin'; isOpen: boolean; onClose: () => void; }
export function buildSummary(caseRecord: CaseRecord) {
  const { patient, referral } = caseRecord;
  const cbac = referral.screening?.cbac;
  const exam = referral.physicalExam;
  const reports = [...(referral.reports || []), ...(referral.biopsyReports || []), ...(referral.radiologyReports || [])];
  const bullets = [
    `${patient.name || 'Unnamed patient'} · ${patient.age ?? 'Age not recorded'} · ${patient.sex || 'Sex not recorded'} · ${patient.locality || 'Locality not recorded'}`,
    `Care module: ${(referral.tier || 'asha').toUpperCase()}, Unit ${(referral.unit || 'a').toUpperCase()}. Destination: ${referral.destinationFacility || 'Not assigned'}. Recorded priority: ${referral.urgency || 'Not recorded'}.`,
    cbac ? `CBAC Part A: ${cbac.partA.totalScore}/12. Recorded flags: ${[cbac.highRiskNcd && 'High NCD risk', cbac.symptomAlert && 'Symptom alert', cbac.tbSuspectAlert && 'TB screening alert'].filter(Boolean).join(', ') || 'None'}. PHQ-2 score: ${cbac.partD.totalScore}/6.` : 'CBAC assessment has not been recorded.',
    exam ? `Physical examination: ${recordedVitals(exam).map(item => `${item.label}: ${item.value}`).join(', ')}. ${exam.generalFindings || 'General findings not recorded.'}` : 'Physical examination has not been recorded.',
    ...[exam?.systemicExam, exam?.oralCavityFindings, exam?.breastExamFindings, exam?.cervicalExamFindings].filter(Boolean).map(finding => `Recorded examination findings: ${finding}`),
    `Reports attached: ${reports.length} (${referral.reports?.length || 0} general, ${referral.biopsyReports?.length || 0} biopsy, ${referral.radiologyReports?.length || 0} radiology).`,
    ...reports.map(report => `${report.title}: ${report.findings || 'No findings entered. PDF contents have not been analyzed.'}`),
    ...(referral.dhNotes ? [`DH notes: ${referral.dhNotes}`] : []),
    ...(referral.tccNotes ? [`TCC notes: ${referral.tccNotes}`] : []),
    ...(referral.notes ? [`Handover notes: ${referral.notes}`] : []),
  ];
  const pending = [!cbac && 'Complete the CBAC assessment', referral.tier !== 'asha' && !exam && 'Record physical examination findings', referral.tier !== 'asha' && !reports.length && 'Attach available diagnostic reports', referral.tier === 'dh' && !referral.dhNotes && 'Add DH notes', referral.tier === 'tcc' && !referral.tccNotes && 'Add TCC notes'].filter(Boolean);
  return { text: bullets.join('\n\n'), pending };
}
export function AiSummaryModal({ caseRecord, isOpen, onClose }: Props) {
  const { t } = useLang();
  const [summary, setSummary] = useState(() => caseRecord ? caseRecord.referral.aiSummaryOverride ?? buildSummary(caseRecord).text : '');
  const [copyStatus, setCopyStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const recordId = caseRecord?.referral.id;
  useEffect(() => {
    if (caseRecord) setSummary(caseRecord.referral.aiSummaryOverride ?? buildSummary(caseRecord).text);
    setError(''); setCopyStatus('');
  }, [recordId]);
  if (!isOpen || !caseRecord) return null;
  const { patient, referral } = caseRecord;
  const { pending } = buildSummary(caseRecord);
  async function saveSummary() {
    if (!summary.trim() || saving) return;
    setSaving(true); setError('');
    try {
      await updateCaseClinical(referral.id, { aiSummaryOverride: summary.trim() });
      onClose();
    } catch { setError('Summary could not be saved. Your edits are still here; please retry.'); }
    finally { setSaving(false); }
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="summary-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
    <div className="bg-white rounded-2xl border border-teal-100 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div><span className="eyebrow">{t('CARELINK INTELLIGENCE')}</span><h2 id="summary-title" className="text-xl font-semibold mt-1">{t('AI summary')}</h2><p className="text-xs text-slate-500 mt-2">{t('Review and edit this summary. The saved version travels with the patient to the next care team.')}</p></div>
        <button type="button" disabled={saving} aria-label={t('Close summary')} onClick={onClose} className="text-slate-400">✕</button>
      </div>
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-sm text-teal-800">{patient.name} · {patient.id}</div>
      <label htmlFor="editable-ai-summary" className="block text-sm font-semibold">{t('Editable clinical handover summary')}</label>
      <textarea id="editable-ai-summary" rows={12} value={summary} onChange={event => { setSummary(event.target.value); setCopyStatus(''); }} disabled={saving} className="w-full text-sm" />
      {!!pending.length && <div className="rounded-xl bg-sky-50 p-3"><h3 className="text-sm font-semibold text-sky-900">{t('Documentation to complete')}</h3><ul className="mt-2 text-xs text-slate-600 space-y-1">{pending.map(item => <li key={String(item)}>• {item}</li>)}</ul></div>}
      <p className="text-xs text-slate-400">{t('The initial draft summarizes saved records. PDF contents are not interpreted automatically.')}</p>
      {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
        <button type="button" className="btn btn-secondary text-xs" onClick={async () => { try { await navigator.clipboard.writeText(summary); setCopyStatus('Copied'); } catch { setCopyStatus('Clipboard unavailable'); } }}>{copyStatus || 'Copy summary'}</button>
        <div className="flex gap-2"><button type="button" disabled={saving} className="btn btn-secondary text-xs" onClick={onClose}>{t('Cancel')}</button><button type="button" disabled={saving || !summary.trim()} className="btn btn-primary text-xs" onClick={saveSummary}>{saving ? 'Saving…' : 'Save summary'}</button></div>
      </div>
    </div>
  </div>;
}

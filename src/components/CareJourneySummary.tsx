import { useLang } from '../i18n';
import type { CaseRecord } from '../db/repo';
import { careJourney } from '../intelligence/careJourney';
export function CareJourneySummary({ record, onEditSummary }: { record: CaseRecord; onEditSummary?: () => void }) {
  const { t } = useLang();
  if (record.referral.tier !== 'tcc') return null;
  return <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2">
    <h3 className="text-sm font-bold text-teal-900">{t('Patient care journey')}</h3>
    <p className="text-xs text-teal-800">ASHA → PHC → DH → TCC · {record.referral.worker.outcomeRecorded || record.referral.facility.completed ? 'Outcome recorded — loop closed' : 'TCC care in progress'}</p>
    <ol className="space-y-2 text-xs">{careJourney(record).map(step => <li key={step.tier}><strong>{step.tier.toUpperCase()}</strong><span className="text-slate-700"> · {step.detail}</span></li>)}</ol>
    {(record.referral.aiSummaryOverride || onEditSummary) && <div className="border-t border-teal-200 pt-2 text-xs">
      <div className="flex items-center justify-between gap-2"><strong>{t('Saved clinical summary')}</strong>{onEditSummary && <button type="button" className="btn btn-secondary !min-h-[30px] text-xs" onClick={onEditSummary}>{t('Edit summary')}</button>}</div>
      {record.referral.aiSummaryOverride ? <p className="mt-1 line-clamp-2 break-words" title={record.referral.aiSummaryOverride}>{record.referral.aiSummaryOverride.replace(/\s+/g, ' ')}</p> : <p className="mt-1 text-slate-600">{t('No edited summary saved yet.')}</p>}
    </div>}
  </section>;
}

import { useLang } from '../i18n';
import type { CaseRecord } from '../db/repo';
import { careJourney } from '../intelligence/careJourney';
/** TCC overview of the whole journey. The AI summary is not repeated here; it lives only in the ASHA stage. */
export function CareJourneySummary({ record }: { record: CaseRecord }) {
  const { t } = useLang();
  if (record.referral.tier !== 'tcc') return null;
  return <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2">
    <h3 className="text-sm font-bold text-teal-900">{t('Patient care journey')}</h3>
    <p className="text-xs text-teal-800">ASHA → PHC → DH → TCC · {record.referral.worker.outcomeRecorded || record.referral.facility.completed ? t('Outcome recorded — loop closed') : t('TCC care in progress')}</p>
    <ol className="space-y-2 text-xs">{careJourney(record).map(step => <li key={step.tier}><strong>{step.tier.toUpperCase()}</strong><span className="text-slate-700"> · {step.detail}</span></li>)}</ol>
  </section>;
}

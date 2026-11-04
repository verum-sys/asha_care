import { useLang } from '../i18n';
import type { CareTier, PhysicalExamNotes, VitalsCheck } from '../db/types';
import { addVitalsCheck, latestFirst } from '../intelligence/vitals';
/** The exam form asks for body temperature in °F (98.6); a value under 50 can only be °C. */
export const temperatureText = (value: number) => `${value} ${value < 50 ? '°C' : '°F'}`;

export function recordedVitals(exam?: PhysicalExamNotes): { label: string; value: string }[] {
  if (!exam) return [];
  const entries: { label: string; value: string }[] = [];
  const present = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (present(exam.bpSystolic) && present(exam.bpDiastolic)) entries.push({ label: 'BP', value: `${exam.bpSystolic}/${exam.bpDiastolic} mmHg` });
  else if (present(exam.bpSystolic)) entries.push({ label: 'Systolic BP', value: `${exam.bpSystolic} mmHg` });
  else if (present(exam.bpDiastolic)) entries.push({ label: 'Diastolic BP', value: `${exam.bpDiastolic} mmHg` });
  for (const [key, label, unit] of [['pulseRate', 'Pulse', ' bpm'], ['spo2', 'SpO2', '%'], ['bmi', 'BMI', ''], ['temperature', 'Temperature', ''], ['weightKg', 'Weight', ' kg'], ['heightCm', 'Height', ' cm']] as const) {
    if (present(exam[key])) entries.push({ label, value: key === 'temperature' ? temperatureText(exam[key]!) : `${exam[key]}${unit}` });
  }
  return entries;
}
/** The recorded examination as plain handover text (vitals plus each entered finding), or '' when nothing was recorded. */
export function physicalExamText(exam?: PhysicalExamNotes): string {
  if (!exam) return '';
  const vitals = recordedVitals(exam).map(entry => `${entry.label} ${entry.value}`).join('; ');
  const lines = [
    vitals && `Physical examination: ${vitals}`,
    exam.generalFindings?.trim() && `General: ${exam.generalFindings.trim()}`,
    exam.systemicExam?.trim() && `Systemic: ${exam.systemicExam.trim()}`,
    exam.oralCavityFindings?.trim() && `Oral cavity: ${exam.oralCavityFindings.trim()}`,
    exam.breastExamFindings?.trim() && `Breast: ${exam.breastExamFindings.trim()}`,
    exam.cervicalExamFindings?.trim() && `Cervical: ${exam.cervicalExamFindings.trim()}`,
  ];
  return lines.filter(Boolean).join('\n');
}
export function RecordedVitals({ exam }: { exam?: PhysicalExamNotes }) {
  const { t } = useLang();
  const entries = recordedVitals(exam);
  if (!entries.length) return null;
  return <div className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3 text-slate-700">
    <span className="font-bold text-slate-500">{t('Vitals:')}</span>
    {exam?.recordedAt && <span className="text-slate-500">{t('checked')} {when(exam.recordedAt)}</span>}
    {entries.map(entry => <span key={entry.label}>{t(entry.label)}: {entry.value}</span>)}
  </div>;
}

const VITAL_LABELS: [keyof VitalsValues, string, string][] = [['pulseRate', 'Pulse', ' bpm'], ['spo2', 'SpO2', '%'], ['temperature', 'Temperature', ''], ['weightKg', 'Weight', ' kg'], ['heightCm', 'Height', ' cm'], ['bmi', 'BMI', '']];
type VitalsValues = VitalsCheck['values'];
export function vitalsText(values: VitalsValues): string {
  const parts: string[] = [];
  if (values.bpSystolic && values.bpDiastolic) parts.push(`BP ${values.bpSystolic}/${values.bpDiastolic} mmHg`);
  for (const [key, label, unit] of VITAL_LABELS) if (values[key]) parts.push(`${label} ${key === 'temperature' ? temperatureText(values[key]!) : `${values[key]}${unit}`}`);
  return parts.join(' · ');
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/**
 * Vitals are checked at every visit and every tier. Shows the latest check with its date, time and tier, and every
 * earlier check on request. `tier` adds a reminder when this tier has not checked vitals yet.
 */
export function VitalsHistory({ log, tier, exam, examTier }: { log?: VitalsCheck[]; tier?: CareTier; exam?: PhysicalExamNotes; examTier?: CareTier }) {
  const { t } = useLang();
  // Records saved before the log existed: use the current examination as the one known check.
  const fallback = !log?.length && exam && examTier ? addVitalsCheck(undefined, exam, examTier, exam.recordedAt || '') : undefined;
  const checks = latestFirst(log?.length ? log : fallback);
  const latest = checks[0];
  const checkedHere = !tier || checks.some(c => c.tier === tier);
  if (!latest) return tier && tier !== 'asha' ? <p className="text-xs text-amber-800">{t('Vitals not checked yet. Check them at this visit.')}</p> : null;
  return <div className="text-xs bg-white p-2 rounded-lg border border-slate-200 space-y-1" data-testid="vitals-latest">
    <p><span className="font-bold text-slate-600">{t('Latest vitals check')}:</span> <span className="text-slate-500">{when(latest.at)} · {latest.tier.toUpperCase()}</span></p>
    <p className="text-slate-800">{vitalsText(latest.values)}</p>
    {!checkedHere && tier && <p className="text-amber-800">{t('Not checked at {tier} yet. Check vitals at this visit.', { tier: tier.toUpperCase() })}</p>}
    {checks.length > 1 && <details><summary className="cursor-pointer text-sky-700 font-semibold">{t('Earlier checks')} ({checks.length - 1})</summary>
      <ul className="mt-1 space-y-0.5">{checks.slice(1).map(c => <li key={c.at + c.tier}><span className="text-slate-500">{when(c.at)} · {c.tier.toUpperCase()}:</span> {vitalsText(c.values)}</li>)}</ul>
    </details>}
  </div>;
}

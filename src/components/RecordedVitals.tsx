import { useLang } from '../i18n';
import type { PhysicalExamNotes } from '../db/types';
export function recordedVitals(exam?: PhysicalExamNotes): { label: string; value: string }[] {
  if (!exam) return [];
  const entries: { label: string; value: string }[] = [];
  const present = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (present(exam.bpSystolic) && present(exam.bpDiastolic)) entries.push({ label: 'BP', value: `${exam.bpSystolic}/${exam.bpDiastolic} mmHg` });
  else if (present(exam.bpSystolic)) entries.push({ label: 'Systolic BP', value: `${exam.bpSystolic} mmHg` });
  else if (present(exam.bpDiastolic)) entries.push({ label: 'Diastolic BP', value: `${exam.bpDiastolic} mmHg` });
  for (const [key, label, unit] of [['pulseRate', 'Pulse', ' bpm'], ['spo2', 'SpO2', '%'], ['bmi', 'BMI', ''], ['temperature', 'Temperature', ' °C'], ['weightKg', 'Weight', ' kg'], ['heightCm', 'Height', ' cm']] as const) {
    if (present(exam[key])) entries.push({ label, value: `${exam[key]}${unit}` });
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
    {entries.map(entry => <span key={entry.label}>{t(entry.label)}: {entry.value}</span>)}
  </div>;
}

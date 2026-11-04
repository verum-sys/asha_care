import type { CareTier, PhysicalExamNotes, VitalsCheck } from '../db/types';

export const VITAL_KEYS = ['bpSystolic', 'bpDiastolic', 'pulseRate', 'spo2', 'temperature', 'weightKg', 'heightCm', 'bmi'] as const;

/** The vital signs in an examination, keeping only real numbers. */
export function vitalValues(exam?: PhysicalExamNotes): VitalsCheck['values'] {
  const values: VitalsCheck['values'] = {};
  for (const key of VITAL_KEYS) {
    const v = exam?.[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) values[key] = v;
  }
  return values;
}

/**
 * Every time an examination with vitals is saved, the vitals are added to the case's log with the level, date and time,
 * so each visit keeps its own reading and the latest check is always known.
 */
export function addVitalsCheck(log: VitalsCheck[] | undefined, exam: PhysicalExamNotes | undefined, tier: CareTier, at: string): VitalsCheck[] | undefined {
  const values = vitalValues(exam);
  if (!Object.keys(values).length) return log;
  return [...(log ?? []), { at, tier, values, recordedBy: exam?.recordedBy }];
}

/** Latest check first. */
export const latestFirst = (log?: VitalsCheck[]) => [...(log ?? [])].sort((a, b) => b.at.localeCompare(a.at));

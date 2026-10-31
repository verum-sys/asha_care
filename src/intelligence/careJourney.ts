import type { CaseRecord } from '../db/repo';
import type { CareTier, WorkerFacts, FacilityFacts } from '../db/types';
type Translate = (key: string, params?: Record<string, string | number>) => string;
const english: Translate = (key, params) => key.replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
export function careJourney(record: CaseRecord, t: Translate = english): { tier: CareTier; detail: string }[] {
  return (['asha', 'phc', 'dh', 'tcc'] as const).map(tier => {
    const visits = record.followUps.filter(followUp => followUp.data?.tier === tier && (followUp.action === 'patient_attended' || followUp.data?.attendance === 'attended'));
    const dates = [...new Set(visits.map(visit => visit.data?.date).filter(Boolean))].sort();
    const snapshots = (record.referral.clinicalHandovers || []).filter(handover => handover.fromTier === tier);
    const last = snapshots[snapshots.length - 1];
    const current = (record.referral.tier || 'asha') === tier;
    const worker: WorkerFacts | undefined = current ? record.referral.worker : last?.visitStatus;
    const facility: FacilityFacts | undefined = current ? record.referral.facility : last?.facilityStatus;
    if (worker?.attendance === 'attended' && worker.attendedDate && !dates.includes(worker.attendedDate)) dates.push(worker.attendedDate);
    const attendance = worker?.attendance ?? facility?.attendance;
    const appointment = worker?.appointmentDate ?? facility?.appointmentDate;
    let detail = dates.length ? t('Attended on {dates}', { dates: dates.sort().join(', ') }) : attendance === 'attended' ? t('Attended; actual visit date not recorded') : attendance === 'not_attended' ? t('Missed appointment') : appointment ? t('Appointment scheduled for {date}; attendance not confirmed', { date: appointment }) : t('Visit not recorded');
    if (attendance === 'not_attended' && appointment) detail += ` (${appointment})`;
    if (last) detail += `. ${t('Referred to {tier} on {date}', { tier: last.toTier.toUpperCase(), date: last.at.slice(0, 10) })}`;
    return { tier, detail };
  });
}

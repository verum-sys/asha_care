import { useLang } from '../i18n';
import { ATTENDANCE_LABELS } from './VisitStatusModal';
import { Chip, type Tone } from './StatusChip';
import type { CareTier, Patient, Referral } from '../db/types';

const URGENCY_TONE: Record<string, Tone> = { routine: 'ok', soon: 'warn', urgent: 'danger' };

/** Stays on screen while the case scrolls: who it is, where it is, and when they are expected. */
export function CaseHeader({ patient, referral, tier }: { patient: Patient; referral: Referral; tier: CareTier }) {
  const { t, formatDate } = useLang();
  const appointment = referral.worker.appointmentDate ?? referral.facility.appointmentDate;
  const attendance = referral.worker.attendance ?? referral.facility.attendance;
  const facts = [
    patient.age !== undefined ? t('case.header.age', { n: patient.age }) : '',
    patient.sex ? t(`sex.${patient.sex}`) : '',
    patient.locality ?? '',
    patient.id,
  ].filter(Boolean);
  return (
    <header className="sticky top-[calc(54px+env(safe-area-inset-top,0px))] z-20 -mx-1 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:top-0" data-testid="case-header">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h1 className="min-w-0 truncate text-base font-bold sm:text-lg">{patient.name?.trim() || t('Community member')}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="brand">{tier.toUpperCase()}</Chip>
          {referral.urgency && <Chip tone={URGENCY_TONE[referral.urgency] ?? 'neutral'}>{t(`urgency.${referral.urgency}`)}</Chip>}
        </div>
      </div>
      <p className="truncate text-xs text-muted">{facts.join(' · ')}</p>
      <p className="text-xs">
        <span className="text-muted">{t('Appointment:')}</span> <strong>{appointment ? formatDate(appointment) : t('Not set')}</strong>
        <span className="text-muted"> · {t('Attendance')}: </span><strong>{t(ATTENDANCE_LABELS[attendance])}</strong>
      </p>
    </header>
  );
}

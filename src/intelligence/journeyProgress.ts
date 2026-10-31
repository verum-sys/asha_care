import type { Referral } from '../db/types';

export type JourneyStep = 'asha' | 'phc' | 'dh' | 'tcc' | 'back';
export interface JourneyNode {
  step: JourneyStep;
  state: 'done' | 'current' | 'upcoming';
  /** For a finished step: when the case was handed on (yyyy-mm-dd). For the current step: the appointment date, if set. */
  date?: string;
  dateKind?: 'referred' | 'appointment';
}

const ORDER: JourneyStep[] = ['asha', 'phc', 'dh', 'tcc', 'back'];

/** Where the case is on ASHA → PHC → DH → TCC → back to ASHA. Works for any viewer. */
export function journeyProgress(referral: Pick<Referral, 'tier' | 'clinicalHandovers' | 'worker' | 'facility'>): JourneyNode[] {
  const tier = referral.tier || 'asha';
  const handovers = referral.clinicalHandovers || [];
  // After TCC the case returns to ASHA: ASHA again, but with a TCC handover on record.
  const returned = tier === 'asha' && handovers.some(h => h.fromTier === 'tcc');
  const currentIndex = returned ? ORDER.indexOf('back') : ORDER.indexOf(tier);
  return ORDER.map((step, index) => {
    if (index < currentIndex) {
      const handedOn = handovers.filter(h => h.fromTier === step).pop();
      return { step, state: 'done', date: handedOn?.at.slice(0, 10), dateKind: 'referred' };
    }
    if (index === currentIndex) {
      const appointment = referral.worker.appointmentDate ?? referral.facility.appointmentDate;
      return { step, state: 'current', date: appointment, dateKind: 'appointment' };
    }
    return { step, state: 'upcoming' };
  });
}

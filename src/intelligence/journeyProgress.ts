import type { Referral } from '../db/types';

export type JourneyStep = 'asha' | 'phc' | 'dh' | 'tcc' | 'back';
export interface JourneyNode {
  step: JourneyStep;
  /** 'skipped': the case never went through this step (registered later, or the patient came straight to DH or TCC). */
  state: 'done' | 'current' | 'upcoming' | 'skipped';
  /** For a finished step: when the case was handed on (yyyy-mm-dd). For the current step: the appointment date, if set. */
  date?: string;
  dateKind?: 'referred' | 'appointment';
}

const ORDER: JourneyStep[] = ['asha', 'phc', 'dh', 'tcc', 'back'];

/** Where the case is on ASHA → PHC → DH → TCC → back to ASHA. Works for any viewer. */
export function journeyProgress(referral: Pick<Referral, 'tier' | 'clinicalHandovers' | 'worker' | 'facility'> & Partial<Pick<Referral, 'ashaFollowUpDate'>>): JourneyNode[] {
  const tier = referral.tier || 'asha';
  const handovers = referral.clinicalHandovers || [];
  // After TCC the case goes back to ASHA: TCC records the next follow-up date (or, in older records, hands over to ASHA).
  const returned = !!referral.ashaFollowUpDate || (tier === 'asha' && handovers.some(h => h.fromTier === 'tcc'));
  const currentIndex = returned ? ORDER.indexOf('back') : ORDER.indexOf(tier);
  return ORDER.map((step, index) => {
    if (index < currentIndex) {
      const handedOn = handovers.filter(h => h.fromTier === step).pop();
      if (handedOn) return { step, state: 'done', date: handedOn.at.slice(0, 10), dateKind: 'referred' };
      // TCC closing the loop has no handover entry; the case was there.
      if (returned && step === tier) return { step, state: 'done' };
      return { step, state: 'skipped' };
    }
    if (index === currentIndex) {
      const appointment = returned ? referral.ashaFollowUpDate : referral.worker.appointmentDate ?? referral.facility.appointmentDate;
      return { step, state: 'current', date: appointment, dateKind: 'appointment' };
    }
    return { step, state: 'upcoming' };
  });
}

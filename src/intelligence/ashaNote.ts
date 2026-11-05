import type { CaseRecord } from '../db/repo';
import type { Referral } from '../db/types';

/** The appointment ASHA follows up on: the date TCC sent back when closing the loop, otherwise the current one. */
export function ashaAppointment(referral: Referral): string | undefined {
  return referral.ashaFollowUpDate ?? referral.worker.appointmentDate ?? referral.facility.appointmentDate;
}

/** Plain-language reminder for the ASHA worker, built from the saved CBAC and the PHC appointment. */
export function ashaNoteLines(data: CaseRecord, t: (key: string, params?: Record<string, string | number>) => string, formatDate: (date: string) => string): string[] {
  const { patient, referral } = data;
  const name = patient.name?.trim() || t('Community member');
  const cbac = referral.screening?.cbac;
  const appointment = referral.worker.appointmentDate ?? referral.facility.appointmentDate;
  const attendance = referral.worker.attendance ?? referral.facility.attendance;
  const lines: string[] = [];
  if (!cbac) lines.push(t('CBAC assessment is not done yet for {name}.', { name }));
  else {
    lines.push(t('CBAC assessment done for {name} on {date}.', { name, date: formatDate(referral.referralDate) }));
    lines.push(t('NCD risk score is {a} out of 12 and PHQ-2 score is {d} out of 6.', { a: cbac.partA.totalScore, d: cbac.partD.totalScore }));
    if (cbac.tbSuspectAlert) lines.push(t('TB suspect: sputum collection is needed.'));
  }
  // After TCC closes the loop (also for a patient who went straight to TCC), ASHA is told only the date and TCC's instructions.
  // Something went wrong (missed visit, or it could not happen at the facility): ASHA acts first.
  if (referral.ashaAlert) lines.push(t('Action needed: {alert}. Visit the patient and help them get back to care.', { alert: referral.ashaAlert }));
  if (referral.ashaFollowUpDate) {
    const from = (referral.backReferredFrom || 'tcc').toUpperCase();
    lines.push(t('Next follow-up from {tier} on {date}.', { tier: from, date: formatDate(referral.ashaFollowUpDate) }));
    if (referral.ashaFollowUpNote) lines.push(t('Instructions from {tier}: {note}', { tier: from, note: referral.ashaFollowUpNote }));
    return lines;
  }
  if (!cbac) return lines;
  if (referral.screening?.referralRequired === 'no') lines.push(t('No referral needed; continue routine community care.'));
  else if (appointment) lines.push(t('Will go to {facility} on {date}.', { facility: referral.destinationFacility || 'PHC', date: formatDate(appointment) }));
  else lines.push(t('PHC appointment date is not set yet.'));
  if (referral.screening?.referralRequired !== 'no' && attendance !== 'unknown') lines.push(t(attendance === 'attended' ? 'Visit status: attended the PHC.' : 'Visit status: missed the appointment. Follow up.'));
  return lines;
}

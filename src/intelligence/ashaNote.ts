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
  if (!cbac) return [t('CBAC assessment is not done yet for {name}.', { name })];
  lines.push(t('CBAC assessment done for {name} on {date}.', { name, date: formatDate(referral.referralDate) }));
  lines.push(t('NCD risk score is {a} out of 12 and PHQ-2 score is {d} out of 6.', { a: cbac.partA.totalScore, d: cbac.partD.totalScore }));
  if (cbac.tbSuspectAlert) lines.push(t('TB suspect: sputum collection is needed.'));
  // After TCC closes the loop, ASHA is told only the next appointment date.
  if (referral.ashaFollowUpDate) { lines.push(t('Next follow-up from TCC on {date}.', { date: formatDate(referral.ashaFollowUpDate) })); return lines; }
  if (referral.screening?.referralRequired === 'no') lines.push(t('No referral needed; continue routine community care.'));
  else if (appointment) lines.push(t('Will go to {facility} on {date}.', { facility: referral.destinationFacility || 'PHC', date: formatDate(appointment) }));
  else lines.push(t('PHC appointment date is not set yet.'));
  if (referral.screening?.referralRequired !== 'no' && attendance !== 'unknown') lines.push(t(attendance === 'attended' ? 'Visit status: attended the PHC.' : 'Visit status: missed the appointment. Follow up.'));
  return lines;
}

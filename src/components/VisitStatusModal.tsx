import { useLang } from '../i18n';
import { VoiceTextarea } from './VoiceTextarea';
import { useState } from 'react';
import type { Attendance, Referral } from '../db/types';
import { updateVisitDetails } from '../db/repo';

export const ATTENDANCE_LABELS: Record<Attendance, string> = { unknown: 'Not yet recorded', attended: 'Attended', not_attended: 'Missed appointment' };

/** Record whether the patient attended. The appointment itself is set when referring, so it is shown here but not edited. */
export function VisitStatusModal({ referral, onClose }: { referral: Referral; onClose: () => void }) {
  const { t, formatDate } = useLang();
  const [attendance, setAttendance] = useState<Attendance>(referral.worker.attendance ?? referral.facility.attendance);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const appointment = referral.worker.appointmentDate ?? referral.facility.appointmentDate;
  return <div role="dialog" aria-modal="true" aria-labelledby="visit-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"><form className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-4" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError('');
    try { await updateVisitDetails(referral.id, { attendance, note: note.trim() }); onClose(); }
    catch { setError('Visit details could not be saved. Please retry.'); }
    finally { setSaving(false); }
  }}>
    <h2 id="visit-title" className="text-lg font-bold">{t('Attendance')}</h2>
    <p className="text-xs text-muted">{t('Record whether the patient attended the referral visit. A missed appointment does not close the referral.')}</p>
    <div className="rounded-xl bg-surface p-3 text-sm"><span className="text-muted">{t('Appointment date')}: </span><strong>{appointment ? formatDate(appointment) : t('Not set')}</strong></div>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">{t('Attendance')}</legend>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
        {(Object.keys(ATTENDANCE_LABELS) as Attendance[]).map(value => <button key={value} type="button" role="radio" aria-checked={attendance === value} onClick={() => setAttendance(value)}
          className={`btn !min-h-[48px] text-sm font-semibold ${attendance === value ? 'btn-primary' : 'btn-secondary'}`}>{attendance === value ? '✓ ' : ''}{t(ATTENDANCE_LABELS[value])}</button>)}
      </div>
    </fieldset>
    <label className="block text-sm font-semibold">{t('Update notes')}<VoiceTextarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Cancel')}</button><button type="submit" className="btn btn-primary text-xs" disabled={saving}>{saving ? t('Saving…') : t('Save attendance')}</button></div>
  </form></div>;
}

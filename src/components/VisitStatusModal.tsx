import { useState } from 'react';
import type { Attendance, FacilityResponse, Referral } from '../db/types';
import { updateVisitDetails } from '../db/repo';
export function VisitStatusModal({ referral, onClose }: { referral: Referral; onClose: () => void }) {
  const [response, setResponse] = useState<FacilityResponse>(referral.worker.facilityResponse ?? referral.facility.response);
  const [date, setDate] = useState(referral.worker.appointmentDate ?? referral.facility.appointmentDate ?? '');
  const [attendance, setAttendance] = useState<Attendance>(referral.worker.attendance ?? referral.facility.attendance);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <div role="dialog" aria-modal="true" aria-labelledby="visit-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"><form className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-4" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError('');
    try { await updateVisitDetails(referral.id, { response, date, attendance, note: note.trim() }); onClose(); }
    catch { setError('Visit details could not be saved. Please retry.'); }
    finally { setSaving(false); }
  }}>
    <h2 id="visit-title" className="text-lg font-bold">Acceptance & appointment</h2>
    <p className="text-xs text-muted">A missed appointment does not close the referral. Record acceptance now or later, change the date, and update attendance separately.</p>
    <label className="block text-sm font-semibold">Recorded acceptance status<select value={response} onChange={event => setResponse(event.target.value as FacilityResponse)}>
      <option value="none">Pending</option><option value="received">Received</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="info_requested">More information requested</option>
    </select></label>
    <label className="block text-sm font-semibold">Appointment date<input type="date" value={date} onChange={event => { setDate(event.target.value); setAttendance('unknown'); }} /></label>
    <label className="block text-sm font-semibold">Attendance<select value={attendance} onChange={event => setAttendance(event.target.value as Attendance)}><option value="unknown">Not yet recorded</option><option value="not_attended">Missed appointment</option><option value="attended">Attended</option></select></label>
    <label className="block text-sm font-semibold">Update notes<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary text-xs" disabled={saving}>{saving ? 'Saving…' : 'Save visit details'}</button></div>
  </form></div>;
}

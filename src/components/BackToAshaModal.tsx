import { useState } from 'react';
import { useLang } from '../i18n';
import { sendBackToAsha } from '../db/repo';
import type { Referral } from '../db/types';
import { today } from '../intelligence/dates';
import { VoiceTextarea } from './VoiceTextarea';

const REASONS = ['Patient did not come', 'Patient asked for a later date', 'Tests or reports still awaited', 'Doctor or facility not available', 'Other'] as const;

/**
 * Counter referral from DH or TCC: the patient goes back to their PHC and ASHA with the next appointment and a short
 * note. ASHA sees only the date, the note and (if something could not happen) the reason, never clinical details.
 */
export function BackToAshaModal({ referral, onClose, onSaved }: { referral: Referral; onClose: () => void; onSaved?: () => void }) {
  const { t } = useLang();
  const tier = (referral.tier || 'asha').toUpperCase();
  const [date, setDate] = useState(referral.ashaFollowUpDate ?? '');
  const [note, setNote] = useState(referral.ashaFollowUpNote ?? '');
  const [happened, setHappened] = useState<'yes' | 'no'>(referral.ashaFollowUpReason ? 'no' : 'yes');
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Patient did not come');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const phc = referral.mappedPhc || `PHC ${(referral.unit || 'a').toUpperCase()}`;

  return <div role="dialog" aria-modal="true" aria-labelledby="back-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"><form className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onSubmit={async event => {
    event.preventDefault();
    if (!date) { setError('Choose the next appointment date.'); return; }
    if (!note.trim()) { setError('Write a short note for ASHA.'); return; }
    if (happened === 'no' && reason === 'Other' && !details.trim()) { setError('Write what could not happen.'); return; }
    setSaving(true); setError('');
    try {
      const why = happened === 'no' ? [reason === 'Other' ? '' : reason, details.trim()].filter(Boolean).join(': ') : undefined;
      await sendBackToAsha(referral.id, { date, note, reason: why });
      onSaved?.(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send back. Please retry.'); setSaving(false); }
  }}>
    <h2 id="back-title" className="text-lg font-bold">{t('Send back to PHC and ASHA')}</h2>
    <p className="text-xs text-muted">{t('The patient goes back to {phc} and its ASHA for follow-up. ASHA sees only the date and your note, not clinical details.', { phc })}</p>

    <label className="block text-sm font-semibold">{t('Next appointment')} *<input type="date" min={today()} value={date} onChange={e => { setDate(e.target.value); setError(''); }} required /></label>

    <fieldset className="space-y-1.5"><legend className="text-sm font-semibold">{t('Did everything planned at {tier} happen?', { tier })}</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {(['yes', 'no'] as const).map(v => <button key={v} type="button" role="radio" aria-checked={happened === v} onClick={() => setHappened(v)} className={`btn !min-h-[44px] text-sm font-semibold ${happened === v ? 'btn-primary' : 'btn-secondary'}`}>{v === 'yes' ? t('Yes') : t('No, something could not happen')}</button>)}
      </div>
    </fieldset>
    {happened === 'no' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <label className="block text-sm font-semibold">{t('Reason')}<select value={reason} onChange={e => setReason(e.target.value as (typeof REASONS)[number])}>{REASONS.map(r => <option key={r} value={r}>{t(r)}</option>)}</select></label>
      <label className="block text-sm font-semibold">{t('Details (plain words, no medical details)')}<input value={details} onChange={e => setDetails(e.target.value)} /></label>
    </div>}

    <label htmlFor="asha-back-note" className="block text-sm font-semibold">{t('Note for ASHA')} *</label>
    <VoiceTextarea id="asha-back-note" rows={2} value={note} onChange={e => { setNote(e.target.value); setError(''); }} placeholder={t('For example: remind her about the next visit and check she is eating well.')} />
    <p className="text-xs text-muted">{t('Do not write the diagnosis, test results or treatment here.')}</p>

    {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Cancel')}</button><button type="submit" className="btn btn-primary text-xs" disabled={saving}>{saving ? t('Saving…') : t('Send back')}</button></div>
  </form></div>;
}

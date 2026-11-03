import { useState } from 'react';
import { useLang } from '../i18n';
import { createCase } from '../db/repo';
import type { CareTier, CareUnit, Sex, Urgency } from '../db/types';
import { today } from '../intelligence/dates';

type Source = 'self' | 'other_hospital' | 'other';
const SOURCE_LABEL: Record<Source, string> = { self: 'Came directly (not referred by ASHA)', other_hospital: 'Referred by another hospital', other: 'Other' };

/** Registers a patient who reaches DH or TCC without coming through ASHA. No CBAC: the visit is today, so attendance and the exam can be recorded straight away. */
export function WalkInModal({ tier, unit, onClose, onSaved }: { tier: CareTier; unit: CareUnit; onClose: () => void; onSaved: (referralId: string) => void }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [phone, setPhone] = useState('');
  const [locality, setLocality] = useState('');
  const [source, setSource] = useState<Source>('self');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('soon');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const tierName = tier.toUpperCase();

  return <div role="dialog" aria-modal="true" aria-labelledby="walkin-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"><form className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onSubmit={async event => {
    event.preventDefault();
    if (!name.trim() || !reason.trim()) { setError('Please enter the name and the reason for the visit.'); return; }
    setSaving(true); setError('');
    try {
      const id = await createCase(
        { name: name.trim(), age: age ? Number(age) : undefined, sex: sex || undefined, phone: phone.trim() || undefined, locality: locality.trim() || undefined },
        {
          tier, unit, reason: reason.trim(), urgency, referralDate: today(), appointmentDate: today(),
          destinationFacility: `${tierName} (walk-in)`,
          notes: `Walk-in at ${tierName}: ${SOURCE_LABEL[source]}.`,
        },
        `Walk-in at ${tierName}`,
      );
      onSaved(id);
    } catch { setError('The patient could not be registered. Please retry.'); setSaving(false); }
  }}>
    <h2 id="walkin-title" className="text-lg font-bold">{t('Register walk-in patient')}</h2>
    <p className="text-xs text-muted">{t('For a patient who comes here without a referral from ASHA. The visit is recorded as today.')}</p>
    <label className="block text-sm font-semibold">{t('Name')} *<input value={name} onChange={e => setName(e.target.value)} required /></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm font-semibold">{t('Age')}<input type="number" min={0} max={120} value={age} onChange={e => setAge(e.target.value)} /></label>
      <label className="block text-sm font-semibold">{t('Sex')}<select value={sex} onChange={e => setSex(e.target.value as Sex | '')}><option value="">{t('Please select')}</option><option value="F">{t('Female')}</option><option value="M">{t('Male')}</option><option value="O">{t('Other')}</option></select></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm font-semibold">{t('Phone')}<input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <label className="block text-sm font-semibold">{t('Village / locality')}<input value={locality} onChange={e => setLocality(e.target.value)} /></label>
    </div>
    <label className="block text-sm font-semibold">{t('How did the patient come?')}<select value={source} onChange={e => setSource(e.target.value as Source)}>{(Object.keys(SOURCE_LABEL) as Source[]).map(key => <option key={key} value={key}>{t(SOURCE_LABEL[key])}</option>)}</select></label>
    <label className="block text-sm font-semibold">{t('Reason for the visit')} *<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} required /></label>
    <label className="block text-sm font-semibold">{t('Urgency')}<select value={urgency} onChange={e => setUrgency(e.target.value as Urgency)}><option value="routine">{t('Routine')}</option><option value="soon">{t('Soon')}</option><option value="urgent">{t('Urgent')}</option></select></label>
    {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Cancel')}</button><button type="submit" className="btn btn-primary text-xs" disabled={saving}>{saving ? t('Saving…') : t('Register patient')}</button></div>
  </form></div>;
}

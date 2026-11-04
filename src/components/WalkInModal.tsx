import { useState } from 'react';
import { useLang } from '../i18n';
import { createCase, createCaseForExistingPatient, listCases, type CaseRecord } from '../db/repo';
import { useLive } from '../db/useLive';
import type { CareTier, CareUnit, Sex, Urgency } from '../db/types';
import { today } from '../intelligence/dates';
import { traceMatches } from '../intelligence/tracePatient';
import { isPincode, phcsForPincode } from '../config/phcDirectory';

type Source = 'self' | 'other_hospital' | 'other';
const SOURCE_LABEL: Record<Source, string> = { self: 'Came directly (not referred by ASHA)', other_hospital: 'Referred by another hospital', other: 'Other' };
const TIER_NAME: Record<CareTier, string> = { asha: 'ASHA', phc: 'PHC', dh: 'DH', tcc: 'TCC' };

function matchLine(c: CaseRecord, t: (key: string, params?: Record<string, string | number>) => string, formatDate: (iso?: string) => string): string {
  const r = c.referral;
  const cbac = r.screening?.cbac;
  const tier = TIER_NAME[r.tier || 'asha'];
  return cbac
    ? t('Screened by ASHA on {date} (CBAC {score}/12). Case now at {tier}.', { date: formatDate(r.referralDate), score: cbac.partA.totalScore, tier })
    : t('Registered on {date}. Case now at {tier}.', { date: formatDate(r.createdAt.slice(0, 10)), tier });
}

/**
 * Registers a patient who reaches DH or TCC without coming through ASHA. No CBAC: the visit is today, so attendance and
 * the exam can be recorded straight away. If the same person is already in CareLink (same phone, or same name in the
 * same village), the new case joins their record, so the earlier tier is told and back referral reaches their ASHA.
 */
export function WalkInModal({ tier, unit, onClose, onSaved }: { tier: CareTier; unit: CareUnit; onClose: () => void; onSaved: (referralId: string) => void }) {
  const { t, formatDate } = useLang();
  const { data: cases = [] } = useLive(listCases, []);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [phone, setPhone] = useState('');
  const [locality, setLocality] = useState('');
  const [source, setSource] = useState<Source>('self');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('soon');
  const [pincode, setPincode] = useState('');
  // The PHC the patient belongs to, from the PIN code (PHC A by default); its ASHA gets the patient back after treatment.
  const [phcUnit, setPhcUnit] = useState<CareUnit>('a');
  const [linkTo, setLinkTo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const tierName = TIER_NAME[tier];
  const matches = traceMatches(cases, { name, phone, locality });
  const linked = matches.find(m => m.referral.id === linkTo);
  const pinOk = isPincode(pincode);
  const { phcs, known } = phcsForPincode(pincode);
  const phc = phcs.find(p => p.unit === phcUnit) ?? phcs[0];
  void unit; // the PHC chosen here decides the unit, not the registering user's unit

  return <div role="dialog" aria-modal="true" aria-labelledby="walkin-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"><form className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onSubmit={async event => {
    event.preventDefault();
    if (!name.trim() || !reason.trim()) { setError('Please enter the name and the reason for the visit.'); return; }
    if (!linked && !pinOk) { setError('Enter the 6-digit PIN code, so the patient is mapped to their PHC and ASHA.'); return; }
    setSaving(true); setError('');
    const draft = {
      tier, unit: linked ? linked.referral.unit || 'a' : phc.unit, mappedPhc: linked ? linked.referral.mappedPhc : phc.name,
      reason: reason.trim(), urgency, referralDate: today(), appointmentDate: today(),
      destinationFacility: `${tierName} (walk-in)`,
      notes: `Walk-in at ${tierName}: ${SOURCE_LABEL[source]}.${linked ? ` Traced to earlier case ${linked.referral.id} (${linked.patient.id}).` : ''}`,
    };
    try {
      const id = linked
        ? await createCaseForExistingPatient(linked.patient.id, draft, `Walk-in at ${tierName}`, linked.referral.id)
        : await createCase({ name: name.trim(), age: age ? Number(age) : undefined, sex: sex || undefined, phone: phone.trim() || undefined, locality: locality.trim() || undefined, pincode: pincode.trim() || undefined }, draft, `Walk-in at ${tierName}`);
      onSaved(id);
    } catch { setError('The patient could not be registered. Please retry.'); setSaving(false); }
  }}>
    <h2 id="walkin-title" className="text-lg font-bold">{t('Register walk-in patient')}</h2>
    <p className="text-xs text-muted">{t('For a patient who comes here without a referral from ASHA. The visit is recorded as today.')}</p>
    <label className="block text-sm font-semibold">{t('Name')} *<input value={name} onChange={e => { setName(e.target.value); setLinkTo(''); }} required /></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm font-semibold">{t('Age')}<input type="number" min={0} max={120} value={age} onChange={e => setAge(e.target.value)} /></label>
      <label className="block text-sm font-semibold">{t('Sex')}<select value={sex} onChange={e => setSex(e.target.value as Sex | '')}><option value="">{t('Please select')}</option><option value="F">{t('Female')}</option><option value="M">{t('Male')}</option><option value="O">{t('Other')}</option></select></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm font-semibold">{t('Phone')}<input inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); setLinkTo(''); }} /></label>
      <label className="block text-sm font-semibold">{t('Village / locality')}<input value={locality} onChange={e => { setLocality(e.target.value); setLinkTo(''); }} /></label>
    </div>
    {!linked && <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 space-y-2" data-testid="walkin-phc">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-semibold">{t('PIN code')} *<input inputMode="numeric" maxLength={6} value={pincode} onChange={e => { setPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); setPhcUnit('a'); setError(''); }} placeholder="835205" /></label>
        <label className="block text-sm font-semibold">{t('PHC')}<select value={phc.unit} disabled={!pinOk} onChange={e => setPhcUnit(e.target.value as CareUnit)}>{phcs.map(p => <option key={p.unit} value={p.unit}>{p.name} ({t('Unit')} {p.unit.toUpperCase()})</option>)}</select></label>
      </div>
      <p className="text-xs text-sky-900">{!pinOk ? t('Enter the PIN code to find the PHCs that cover it.') : known ? t('{n} PHCs cover this PIN code. The patient is mapped to one PHC and its ASHA (the first is chosen by default).', { n: phcs.length }) : t('This PIN code is not in the list yet. Choose PHC A, B or C (A by default).')}</p>
    </div>}

    {matches.length > 0 && <fieldset className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2" data-testid="walkin-matches">
      <legend className="px-1 text-sm font-bold text-amber-900">{t('Already in CareLink?')}</legend>
      <p className="text-xs text-amber-900">{t('We found a record with the same phone number, or the same name in the same village. Check with the patient before linking.')}</p>
      {matches.map(m => (
        <label key={m.referral.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm">
          <input type="radio" name="walkin-link" className="!min-h-0 !w-4 mt-1" checked={linkTo === m.referral.id} onChange={() => setLinkTo(m.referral.id)} />
          <span><strong>{m.patient.name}</strong>{m.patient.age ? `, ${m.patient.age}` : ''} · {m.patient.locality || '—'} · <span className="font-mono text-xs">{m.patient.id}</span><br /><span className="text-xs text-muted">{matchLine(m, t, formatDate)}</span></span>
        </label>
      ))}
      <label className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
        <input type="radio" name="walkin-link" className="!min-h-0 !w-4" checked={linkTo === ''} onChange={() => setLinkTo('')} />
        <span>{t('Different person: register as new')}</span>
      </label>
    </fieldset>}

    <label className="block text-sm font-semibold">{t('How did the patient come?')}<select value={source} onChange={e => setSource(e.target.value as Source)}>{(Object.keys(SOURCE_LABEL) as Source[]).map(key => <option key={key} value={key}>{t(SOURCE_LABEL[key])}</option>)}</select></label>
    <label className="block text-sm font-semibold">{t('Reason for the visit')} *<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} required /></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm font-semibold">{t('Urgency')}<select value={urgency} onChange={e => setUrgency(e.target.value as Urgency)}><option value="routine">{t('Routine')}</option><option value="soon">{t('Soon')}</option><option value="urgent">{t('Urgent')}</option></select></label>
      {linked && <p className="text-xs text-muted self-end pb-2">{t('Follow-up goes to {phc} and its ASHA, from the earlier record.', { phc: linked.referral.mappedPhc || `PHC ${(linked.referral.unit || 'a').toUpperCase()}` })}</p>}
    </div>
    {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-xs" disabled={saving} onClick={onClose}>{t('Cancel')}</button><button type="submit" className="btn btn-primary text-xs" disabled={saving}>{saving ? t('Saving…') : linked ? t('Register and link record') : t('Register patient')}</button></div>
  </form></div>;
}

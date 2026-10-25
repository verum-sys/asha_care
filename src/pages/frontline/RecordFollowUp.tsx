import { TierReferralModal } from '../../components/TierReferralModal';
import { nextCareTier, tierFollowUpOptions, type FollowUpChoice } from '../../intelligence/tierFollowUpOptions';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BackLink } from '../../components/Layout';
import { Icon } from '../../components/Icon';
import { Chip } from '../../components/StatusChip';
import { AiSummaryModal } from '../../components/AiSummaryModal';
import { addFollowUp, getCase } from '../../db/repo';
import type { ActionKey, FollowUpAction } from '../../db/types';
import { useLive } from '../../db/useLive';
import { useLang } from '../../i18n';
import { ACTION_MATCHES, analyze } from '../../intelligence/engine';

export function RecordFollowUp() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { data, loading } = useLive(() => getCase(id), [id]);

  // The suggestion comes from the URL (Take this action) or, if opened directly, from the engine.
  const suggested: ActionKey | undefined = useMemo(() => {
    const fromUrl = params.get('suggested') as ActionKey | null;
    if (fromUrl) return fromUrl;
    if (!data) return undefined;
    return analyze(data.patient, data.referral, data.followUps).action;
  }, [params, data]);
  const tier = data?.referral.tier || 'asha';
  const options = useMemo(() => tierFollowUpOptions(tier), [tier]);
  const [showReferral, setShowReferral] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState('');
  const chooseDifferent = params.get('choose') === '1';
  const matches = (suggested ? ACTION_MATCHES[suggested] : []) || [];

  const ordered = useMemo(
    () => (chooseDifferent ? options : [...options.filter((o) => matches.includes(o as FollowUpAction)), ...options.filter((o) => !matches.includes(o as FollowUpAction))]),
    [matches, chooseDifferent, options],
  );

  const [action, setAction] = useState<FollowUpChoice | ''>('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const suggestedOptions = options.filter((o) => matches.includes(o as FollowUpAction));
    if (!chooseDifferent && suggestedOptions.length === 1 && !action) setAction(suggestedOptions[0]);
  }, [matches, chooseDifferent, action, options]);

  const needsDate = action === 'rescheduled' || action === 'patient_attended';
  const canSave = !!data && !!action && options.includes(action) && (!needsDate || !!date) && (action !== 'outcome_recorded' || !!note.trim()) && !saving;

  async function save() {
    if (!action || !data || !options.includes(action)) return;
    if (action === 'refer_next_tier') { setShowReferral(true); return; }
    setSaving(true); setError('');
    try {
      await addFollowUp(id, {
        action,
        note: note.trim() || undefined,
        date: date || undefined,
        suggestedAction: suggested,
      });
      navigate(`/case/${id}`, { state: { toast: 'followup.saved' } });
    } catch { setError('Could not save this follow-up. Please retry.'); } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Loading patient record…</p>;
  if (!data) return <div><BackLink /><p>Patient record not found.</p></div>;

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h1 className="text-[1.4rem] font-bold">{t('followup.title')}</h1>
        {data && (
          <p className="text-muted">
            {data.patient.name} · {data.patient.id}
          </p>
        )}
      </div>

      {suggested && suggested !== 'none' && ordered.some(option => matches.includes(option as FollowUpAction)) && (
        <p className="flex items-start gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-brand">
          <Icon name="spark" size={18} className="mt-0.5 text-accent" />
          <span>
            {t('followup.aiSuggested', { action: `action.${suggested}` })}
            <span className="block text-[0.85rem] italic">{t('reason.youDecide')}</span>
          </span>
        </p>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset className="card">
          <legend className="px-1 text-lg font-bold">{t('followup.what')}</legend>
          <div className="mt-2 space-y-2" role="radiogroup">
            {ordered.map((o) => (
              <label
                key={o}
                className={`tap flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                  action === o ? 'border-brand bg-brand/5' : 'border-line'
                }`}
              >
                <input type="radio" name="action" value={o} checked={action === o} onChange={() => setAction(o)} className="!min-h-0 !w-5 h-5 accent-[var(--color-brand)]" />
                <span className="flex-1 font-semibold">{o === 'refer_next_tier' ? (lang === 'hi' ? `परिणाम दर्ज करें और ${nextCareTier(tier)?.toUpperCase()} को रेफर करें` : `Outcome recorded — refer to ${nextCareTier(tier)?.toUpperCase()}`) : t(`fu.${o}`)}</span>
                {matches.includes(o as FollowUpAction) && <Chip tone="info">{t('followup.suggested')}</Chip>}
              </label>
            ))}
          </div>
        </fieldset>

        {needsDate && (
          <div className="card">
            <label htmlFor="fu-date2" className="mb-1 block font-semibold">
              {action === 'patient_attended' ? 'Actual visit date' : t('followup.newDate')}
            </label>
            <input id="fu-date2" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        )}

        <div className="card">
          <label htmlFor="fu-note" className="mb-1 block font-semibold">
            {action === 'outcome_recorded' || action === 'refer_next_tier' ? t('followup.outcome') : t('followup.note')}
          </label>
          <textarea id="fu-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={action === 'outcome_recorded'} />
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block !min-h-[56px] text-lg" disabled={!canSave} data-testid="save-followup">
          {action === 'refer_next_tier' ? `Continue referral to ${nextCareTier(tier)?.toUpperCase()}` : t('followup.save')}
        </button>
      </form>
      {showReferral && <TierReferralModal referralId={id} patientName={data.patient.name} currentTier={tier} savedSummary={data.referral.aiSummaryOverride} onEditSummary={() => setShowSummary(true)} initialNotes={note} isOpen onClose={() => setShowReferral(false)} onReferred={() => navigate(`/case/${id}`, { state: { toast: 'followup.saved' } })} />}
      {showSummary && <AiSummaryModal caseRecord={data} isOpen onClose={() => setShowSummary(false)} />}
    </div>
  );
}

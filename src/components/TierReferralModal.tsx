import { useLang } from '../i18n';
import { VoiceTextarea } from './VoiceTextarea';
import React, { useState } from 'react';
import type { CareTier, PhysicalExamNotes, Urgency } from '../db/types';
import { physicalExamText } from './RecordedVitals';
import { referToNextTier } from '../db/repo';
import { Icon } from './Icon';

interface TierReferralModalProps {
  referralId: string;
  patientName: string;
  currentTier: CareTier;
  savedSummary?: string;
  /** Generated AI summary, used when no edited summary was saved. */
  aiSummary?: string;
  /** Recorded physical examination; its vitals and findings are pre-filled into the handover notes. */
  physicalExam?: PhysicalExamNotes;
  onEditSummary?: () => void;
  initialNotes?: string;
  isOpen: boolean;
  onClose: () => void;
  onReferred?: () => void;
}

export function TierReferralModal({
  referralId,
  patientName,
  currentTier,
  savedSummary,
  aiSummary,
  physicalExam,
  onEditSummary,
  initialNotes = '',
  isOpen,
  onClose,
  onReferred,
}: TierReferralModalProps) {
  const { t } = useLang();
  if (!isOpen) return null;

  const targetTier: CareTier =
    currentTier === 'asha' ? 'phc' : currentTier === 'phc' ? 'dh' : 'tcc';

  const tierNames: Record<CareTier, string> = {
    asha: 'ASHA Grassroots',
    phc: 'Primary Health Centre (PHC)',
    dh: 'District Hospital (DH)',
    tcc: 'Tertiary Care Centre (TCC Oncology)',
  };

  const defaultFacilities: Record<CareTier, string[]> = {
    asha: ['ASHA Bero'],
    phc: ['PHC Itki'], // one facility per tier; units A/B/C are no longer shown
    dh: ['Sadar District Hospital Ranchi'],
    tcc: ['RIMS Regional Cancer Centre'],
  };

  const [destinationFacility, setDestinationFacility] = useState(defaultFacilities[targetTier][0] || '');
  const [urgency, setUrgency] = useState<Urgency | ''>(''); // the clinician chooses; no default
  const [appointmentDate, setAppointmentDate] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [notes, setNotes] = useState(() => {
    const exam = physicalExamText(physicalExam);
    return [initialNotes.trim(), exam && !initialNotes.includes(exam) ? exam : ''].filter(Boolean).join('\n\n');
  });
  // At ASHA the AI summary is the handover: "Generate AI summary" puts it at the top of the notes, where it can be edited.
  const summaryText = currentTier === 'asha' ? (savedSummary?.trim() || aiSummary?.trim() || '') : '';
  const generateSummary = () => setNotes(current => (current.includes(summaryText) ? current : [summaryText, current.trim()].filter(Boolean).join('\n\n')));
  const editNotes = () => {
    const box = document.getElementById('referral-notes') as HTMLTextAreaElement | null;
    box?.focus();
    box?.setSelectionRange(box.value.length, box.value.length);
  };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urgency) { setError('Please select the referral urgency.'); return; }
    if (!appointmentDate) { setError('Please select the appointment date.'); return; }
    setSubmitting(true);
    try {
      await referToNextTier(referralId, targetTier, destinationFacility, notes.trim(), urgency, (['a', 'b', 'c'] as const)[defaultFacilities[targetTier].indexOf(destinationFacility)], appointmentDate);
      onReferred?.();
      onClose();
    } catch { setError('Referral could not be saved. Please try again.'); } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-4 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              {t('CLINICAL REFERRAL PIPELINE')}
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1 font-display">
              {t('Refer to Next Level:')} {t(tierNames[targetTier])}
            </h2>
            <p className="text-xs text-slate-500">
              {t('Escalating patient')} <strong className="text-slate-800">{patientName}</strong> from{' '}
              <span className="uppercase font-semibold">{currentTier}</span> to{' '}
              <span className="uppercase font-semibold text-emerald-700">{targetTier}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="back" size={20} className="rotate-180" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">{error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
          {/* Target Facility */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Destination')} {targetTier.toUpperCase()} {t('Facility')}
            </label>
            <select
              value={destinationFacility}
              onChange={(e) => setDestinationFacility(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500 bg-white"
            >
              {defaultFacilities[targetTier].map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Referral Urgency Level')}
            </label>
            <select
              value={urgency}
              onChange={(e) => { setUrgency(e.target.value as Urgency | ''); setError(''); }}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500 bg-white"
              required
            >
              <option value="">{t('Please select')}</option>
              <option value="routine">{t('Routine')}</option>
              <option value="soon">{t('Soon')}</option>
              <option value="urgent">{t('Urgent')}</option>
            </select>
          </div>

          {/* Appointment at the receiving facility */}
          <div>
            <label htmlFor="referral-appointment" className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Appointment Date *')}
            </label>
            <input
              id="referral-appointment"
              type="date"
              min={today}
              value={appointmentDate}
              onChange={(e) => { setAppointmentDate(e.target.value); setError(''); }}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500 bg-white"
              required
            />
          </div>


          {/* Clinical Escalation Reason */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="referral-notes" className="block text-xs font-semibold text-slate-700">
                {t('Referral Reason & Handover Notes')}
              </label>
              {summaryText && (
                <div className="flex gap-2">
                  <button type="button" onClick={generateSummary} className="btn btn-secondary !min-h-[32px] px-2.5 text-xs font-semibold">✦ {t('Generate AI summary')}</button>
                  <button type="button" onClick={editNotes} className="btn btn-secondary !min-h-[32px] px-2.5 text-xs font-semibold">✎ {t('Edit')}</button>
                </div>
              )}
            </div>
            <VoiceTextarea
              id="referral-notes"
              rows={summaryText ? 6 : 3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !urgency}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Icon name="check" size={16} />
              <span>{submitting ? 'Referring...' : `Confirm Referral to ${targetTier.toUpperCase()}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

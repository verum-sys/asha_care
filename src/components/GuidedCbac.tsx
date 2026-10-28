import { useEffect, useState, type ReactNode } from 'react';
import { useLang } from '../i18n';
import { getQuestionHint, getQuestionText, type InterviewQuestion } from '../intelligence/cbacInterviewQuestions';
import { joinAnswers, manualControlFor, type ManualOption } from '../intelligence/cbacManualOptions';
import { COOKING_FUELS, CBAC_B1_SYMPTOMS, CBAC_B2_SYMPTOMS, CBAC_B3_SYMPTOMS, PHQ2_OPTIONS, type CbacGeneralInfo, type CbacPartA, type CbacPartB, type CbacPartC, type CbacPartD } from '../intelligence/cbacTypes';
import { savedAnswerFor, type SavedAnswer } from '../intelligence/cbacSavedAnswer';
import type { Sex } from '../db/types';
import { Icon } from './Icon';

export type GuidedMode = 'choose' | 'voice' | 'manual' | 'report' | 'form';

export function GuidedStart({ onVoice, onManual, onFullForm }: { onVoice: () => void; onManual: () => void; onFullForm: () => void }) {
  const { t } = useLang();
  return <section className="card space-y-4 text-center py-8">
    <h2 className="text-lg sm:text-xl font-black text-brand">{t('How would you like to fill this form?')}</h2>
    <p className="text-sm text-muted">{t('We will ask one question at a time. You can review and edit everything at the end.')}</p>
    <div className="grid gap-3 sm:grid-cols-2 max-w-xl mx-auto">
      <button type="button" onClick={onVoice} className="btn btn-primary !min-h-[88px] flex-col gap-1 text-base font-bold">
        <Icon name="mic" size={26} /><span>{t('Use voice (audio)')}</span>
        <small className="font-medium opacity-80">{t('Listen to each question and speak the answer')}</small>
      </button>
      <button type="button" onClick={onManual} className="btn btn-secondary !min-h-[88px] flex-col gap-1 text-base font-bold">
        <Icon name="check" size={26} /><span>{t('Fill manually')}</span>
        <small className="font-medium text-muted">{t('Tap or type the answer, one question at a time')}</small>
      </button>
    </div>
    <button type="button" onClick={onFullForm} className="text-xs font-semibold text-teal-700 underline">{t('Open the full form instead')}</button>
  </section>;
}

interface QuestionProps {
  question: InterviewQuestion; index: number; total: number; mode: 'voice' | 'manual';
  /** Position inside the current section, e.g. question 1 of 3 in Section B. */
  sectionIndex: number; sectionTotal: number;
  sex: Sex | ''; age: number | '';
  /** The worker's earlier answer to this question, shown highlighted / filled in when they come back to it. */
  saved?: SavedAnswer;
  currentAnswer: string; setCurrentAnswer: (value: string) => void;
  onAnswer: (answer: string, trusted: boolean) => void;
  interpreting: boolean; answerError: string;
  canGoBack: boolean; onBack: () => void; onSkip: () => void;
  voice: { active: boolean; speaking: boolean; listening: boolean; onStart: () => void; onRepeat: () => void; onToggleMic: () => void; onStop: () => void };
  onSwitchMode: () => void;
}

const SECTION_NAMES: Record<string, string> = { A: 'Risk', B: 'Symptoms', C: 'COPD', D: 'PHQ-2' };
function sectionTitle(slide: string, t: (key: string) => string) {
  return slide === 'REFERRAL' ? t('Referral') : `${t('Section')} ${slide} · ${t(SECTION_NAMES[slide] || '')}`;
}

export function GuidedQuestionCard(props: QuestionProps) {
  const { t, lang } = useLang();
  const { question, index, total, mode, sex, age, interpreting, answerError, voice } = props;
  const control = manualControlFor(question, sex, age);
  const savedMulti = props.saved && 'multi' in props.saved ? props.saved : undefined;
  const [picked, setPicked] = useState<ManualOption[]>(() => control.kind === 'multi' && savedMulti ? control.options.filter(o => savedMulti.multi.includes(o.answer)) : []);
  const savedText = props.saved && 'text' in props.saved ? props.saved.text : '';
  const savedSingle = props.saved && 'single' in props.saved ? props.saved.single : undefined;
  // Fill the box with the earlier value when the question is revisited (the card remounts per question).
  useEffect(() => { if (savedText && !props.currentAnswer) props.setCurrentAnswer(savedText); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (option: ManualOption) => setPicked(current => current.some(o => o.answer === option.answer) ? current.filter(o => o.answer !== option.answer) : [...current, option]);
  // Next saves anything typed or ticked that differs from the earlier answer, otherwise just moves on (also for unanswered questions).
  const goNext = () => {
    const typed = props.currentAnswer.trim();
    if ((control.kind === 'text' || control.kind === 'number') && typed && typed !== savedText) return props.onAnswer(typed, false);
    if (control.kind === 'multi' && picked.length && picked.map(o => o.answer).sort().join() !== (savedMulti?.multi ?? []).slice().sort().join()) return props.onAnswer(joinAnswers(picked), true);
    props.onSkip();
  };
  const percent = Math.round((index / total) * 100);
  const submitTyped = (event: React.FormEvent) => { event.preventDefault(); if (props.currentAnswer.trim()) props.onAnswer(props.currentAnswer, false); };
  return <section className="card space-y-4" aria-live="polite">
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-bold text-brand">{sectionTitle(question.slide, t)}</span>
          <span>{t('Question')} {props.sectionIndex + 1} {t('of')} {props.sectionTotal}</span>
          <span className="font-normal">· {index + 1}/{total} {t('overall')}</span>
        </span>
        <button type="button" onClick={props.onSwitchMode} className="text-teal-700 underline">{mode === 'voice' ? t('Switch to manual') : t('Switch to voice')}</button>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} /></div>
    </div>
    <h2 className="text-lg sm:text-xl font-black text-ink leading-snug">{getQuestionText(question, lang)}</h2>
    <p className="text-xs text-muted">{getQuestionHint(question, lang)}</p>

    {mode === 'voice' && <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {!voice.active
          ? <button type="button" onClick={voice.onStart} className="btn btn-accent !min-h-[40px] text-sm"><Icon name="mic" size={16} /> {t('Start voice')}</button>
          : <>
            <button type="button" onClick={voice.onRepeat} disabled={voice.speaking || interpreting} className="btn btn-secondary !min-h-[40px] text-sm">{voice.speaking ? t('Speaking…') : t('Repeat')}</button>
            <button type="button" onClick={voice.onToggleMic} disabled={interpreting} className={`btn !min-h-[40px] text-sm ${voice.listening ? 'btn-danger' : 'btn-primary'}`}><Icon name="mic" size={16} /> {voice.listening ? t('Listening…') : t('Answer with mic')}</button>
            <button type="button" onClick={voice.onStop} className="btn btn-ghost !min-h-[40px] text-sm">{t('Stop')}</button>
          </>}
      </div>
      {props.currentAnswer && <p className="text-sm text-slate-700">“{props.currentAnswer}”</p>}
    </div>}

    {(control.kind === 'text' || control.kind === 'number') && <form onSubmit={submitTyped} className="flex gap-2">
      <label htmlFor="guided-answer" className="sr-only">{t('Answer to the current question')}</label>
      <input id="guided-answer" autoFocus={mode === 'manual'} className="flex-1 min-w-0 text-base" inputMode={control.kind === 'number' ? 'numeric' : 'text'} value={props.currentAnswer}
        onChange={event => props.setCurrentAnswer(event.target.value)} placeholder={control.kind === 'number' ? (control.unit === 'cm' ? 'cm' : control.unit === 'digits' ? t('10 digit mobile') : control.unit === 'pin' ? t('6 digit PIN code') : t('years')) : t(control.placeholder || 'Type here')} disabled={interpreting} />
    </form>}

    {control.kind === 'single' && <div className="grid gap-2 sm:grid-cols-2">
      {control.options.map(option => {
        const chosen = savedSingle === option.answer;
        return <button key={option.answer} type="button" disabled={interpreting} aria-pressed={chosen} onClick={() => props.onAnswer(option.answer, true)}
          className={`btn !min-h-[52px] text-sm sm:text-base font-semibold justify-start text-left ${chosen ? 'btn-primary ring-2 ring-brand/40' : 'btn-secondary'}`}>{chosen ? '✓ ' : ''}{t(option.label)}</button>;
      })}
    </div>}

    {control.kind === 'multi' && <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {control.options.map(option => {
          const on = picked.some(o => o.answer === option.answer);
          return <button key={option.answer} type="button" aria-pressed={on} disabled={interpreting} onClick={() => toggle(option)}
            className={`btn !min-h-[52px] text-sm font-semibold justify-start text-left ${on ? 'btn-primary' : 'btn-secondary'}`}>{on ? '✓ ' : ''}{t(option.label)}</button>;
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {control.noneAnswer && <button type="button" aria-pressed={!!savedMulti?.none} className={`btn ${savedMulti?.none ? 'btn-primary ring-2 ring-brand/40' : 'btn-secondary'}`} disabled={interpreting} onClick={() => props.onAnswer(control.noneAnswer!.answer, true)}>{savedMulti?.none ? '✓ ' : ''}{t(control.noneAnswer.label)}</button>}
      </div>
    </div>}

    {interpreting && <p role="status" className="text-xs text-teal-700">{t('Interpreting answer…')}</p>}
    {answerError && <p role="alert" className="text-sm text-danger">{t(answerError)}</p>}
    <div className="flex items-center justify-between border-t border-line pt-3">
      <button type="button" className="btn btn-secondary !min-h-[40px] text-sm" disabled={!props.canGoBack || interpreting} onClick={props.onBack}>{t('← Previous')}</button>
      <button type="button" className="btn btn-primary !min-h-[44px] !px-6 text-sm font-bold" disabled={interpreting} onClick={goNext}>{index === total - 1 ? t('View report →') : t('Next →')}</button>
    </div>
  </section>;
}

interface ReportProps {
  general: CbacGeneralInfo; partA: CbacPartA; partB: CbacPartB; partC: CbacPartC; partD: CbacPartD;
  triage: { reasons: string[]; highRiskNcd: boolean; tbSuspectAlert: boolean; symptomAlert: boolean; mentalHealthAlert: boolean };
  referral: { referralRequired: string; destinationFacility: string };
  finding: string; onFinding: (value: string) => void;
  urgency: string; onUrgency: (value: string) => void;
  /** Inline editing: each row becomes a dropdown / input / checklist. */
  editing: boolean; onToggleEdit: () => void; onField: (key: string, value: string | string[]) => void;
  /** PHC reviewing a referred patient: only name, phone and address can change. */
  locked?: boolean; existing?: boolean; onFullForm: () => void;
  /** Problems found when saving (invalid mobile, address that does not look like one). */
  contactErrors?: { phone?: string; address?: string; pincode?: string }; checkingAddress?: boolean;
  saving: boolean; onSave: () => void;
}

const SMOKE = ['Never', 'Used to consume / Sometimes now', 'Daily'];
const ALCOHOL: Record<string, string> = { never: 'Never', socially: 'Socially', weekly: 'Weekly', daily: 'Daily', yes: 'Yes' };

type Option = { value: string; label: string };
type Editor =
  | { kind: 'text' | 'number'; key: string; value: string }
  | { kind: 'select'; key: string; value: string; options: Option[] }
  | { kind: 'checklist'; key: string; options: Option[]; checked: string[] };
interface Row { label: string; view: ReactNode; editor: Editor; lockedOk?: boolean; error?: string }

/** Text/number box that commits on blur or Enter, so partial typing (e.g. "7" on the way to "73") never fails validation. */
function CommitInput({ value, type, onCommit }: { value: string; type: 'text' | 'number'; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft.trim() !== value.trim()) onCommit(draft.trim()); };
  return <input className="w-full sm:max-w-xs text-sm" type={type === 'number' ? 'text' : 'text'} inputMode={type === 'number' ? 'numeric' : 'text'} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />;
}

export function CbacReport({ general, partA, partB, partC, partD, triage, referral, finding, onFinding, urgency, onUrgency, editing, onToggleEdit, onField, locked, existing, onFullForm, contactErrors, checkingAddress, saving, onSave }: ReportProps) {
  const { t } = useLang();
  const notAnswered = <span className="text-amber-700">{t('Not answered')}</span>;
  const state = { general, partA, partB, partC, partD, bCategories: undefined, referralRequired: referral.referralRequired };
  const applicable = [...CBAC_B1_SYMPTOMS, ...(general.sex === 'F' ? CBAC_B2_SYMPTOMS : []), ...(typeof general.age === 'number' && general.age >= 60 ? CBAC_B3_SYMPTOMS : [])];
  const positives = applicable.filter(s => partB.symptoms[s.id]);
  const phq = (value?: number) => value === undefined ? notAnswered : t(PHQ2_OPTIONS.find(o => o.value === value)?.label || '');
  const choices = (id: string): Option[] => {
    const control = manualControlFor({ id } as never, general.sex, general.age);
    return control.kind === 'single' ? control.options.map(o => ({ value: o.answer, label: o.label })) : [];
  };
  const current = (id: string) => { const saved = savedAnswerFor(id, state); return saved && 'single' in saved ? saved.single : ''; };
  const select = (key: string): Editor => ({ kind: 'select', key, value: current(key), options: choices(key) });
  const text = (label: string, key: string, value: string | number | undefined, lockedOk = false, type: 'text' | 'number' = 'text'): Row =>
    ({ label, view: value === undefined || value === '' ? notAnswered : String(value), editor: { kind: type, key, value: value === undefined ? '' : String(value) }, lockedOk });
  const rows: Row[] = [
    text('Name', 'name', general.name, true),
    text('Age', 'age', general.age, false, 'number'),
    { label: 'Sex', view: general.sex ? t(general.sex === 'F' ? 'Female' : general.sex === 'M' ? 'Male' : 'Other') : notAnswered,
      editor: { kind: 'select', key: 'sex', value: general.sex, options: [{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'O', label: 'Other' }] } },
    { ...text('Phone Number', 'phone', general.phone, true), error: contactErrors?.phone },
    { ...text('Locality / Village / Ward', 'address', general.address, true), error: contactErrors?.address },
    { ...text('PIN code', 'pincode', general.pincode, true), error: contactErrors?.pincode },
    text('Village / Ward Name', 'villageWard', general.villageWard, true),
    { ...text('Waist', 'waist', partA.waistCm, false, 'number'), view: partA.waistCm !== undefined ? `${partA.waistCm} cm` : notAnswered },
    { label: 'Tobacco', view: partA.smokeScore === undefined ? notAnswered : t(SMOKE[partA.smokeScore]), editor: select('smoke') },
    { label: 'Alcohol', view: partA.alcoholScore === undefined ? notAnswered : t(partA.alcoholScore === 0 ? 'Never' : ALCOHOL[partA.alcoholFrequency || 'yes'] || 'Yes'), editor: select('alcohol') },
    { label: 'Physical activity', view: partA.physicalActivityScore === undefined ? notAnswered : t(partA.physicalActivityScore === 0 ? 'At least 150 minutes in a week' : 'Less than 150 minutes in a week'), editor: select('physicalActivity') },
    { label: 'Family history', view: partA.familyHistoryScore === undefined ? notAnswered : t(partA.familyHistoryScore ? 'Yes (Parent or Sibling)' : 'No'), editor: select('familyHistory') },
    { label: 'Symptoms reported', view: positives.length ? positives.map(s => t(s.label)).join('; ') : t('No symptoms reported'),
      editor: { kind: 'checklist', key: 'symptoms', options: applicable.map(s => ({ value: s.id, label: s.label })), checked: positives.map(s => s.id) } },
    { label: 'Cooking fuel', view: partC.cookingFuel.length ? partC.cookingFuel.map(id => t(COOKING_FUELS.find(f => f.id === id)?.label || id)).join(', ') : notAnswered,
      editor: { kind: 'checklist', key: 'fuel', options: COOKING_FUELS.map(f => ({ value: f.id, label: f.label })), checked: partC.cookingFuel } },
    { label: 'Little interest or pleasure', view: phq(partD.phq1Score), editor: select('phq1_interest') },
    { label: 'Feeling down or hopeless', view: phq(partD.phq2Score), editor: select('phq2_mood') },
    { label: 'Referral', view: !referral.referralRequired ? notAnswered : referral.referralRequired === 'yes' ? `${t('Yes — Initiate Referral')}${referral.destinationFacility ? ` · ${referral.destinationFacility}` : ''}` : t('No — Routine Community Care'),
      editor: { kind: 'select', key: 'referral', value: referral.referralRequired, options: [{ value: 'yes', label: 'Yes — Initiate Referral' }, { value: 'no', label: 'No — Routine Community Care' }] } },
  ];
  const control = (row: Row) => {
    const e = row.editor;
    if (e.kind === 'text' || e.kind === 'number') return <CommitInput value={e.value} type={e.kind} onCommit={value => onField(e.key, value)} />;
    if (e.kind === 'select') return <select aria-label={t(row.label)} className="w-full sm:max-w-xs text-sm" value={e.value} onChange={event => event.target.value && onField(e.key, event.target.value)}>
      <option value="">{t('Please select')}</option>
      {e.options.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
    </select>;
    if (e.kind !== 'checklist') return null;
    return <details className="w-full sm:max-w-md rounded-xl border border-line bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{e.checked.length ? `${e.checked.length} ${t('selected')}` : t('Please select')}</summary>
      <div className="max-h-60 overflow-y-auto border-t border-line p-2 space-y-1">
        {e.options.map(o => <label key={o.value} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
          <input type="checkbox" className="mt-0.5" checked={e.checked.includes(o.value)}
            onChange={event => onField(e.key, event.target.checked ? [...e.checked, o.value] : e.checked.filter(v => v !== o.value))} />
          <span>{t(o.label)}</span>
        </label>)}
      </div>
    </details>;
  };
  const canSave = !saving && !checkingAddress && (locked || (!!finding && !!referral.referralRequired && (referral.referralRequired !== 'yes' || !!urgency)));
  return <section className="card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
      <div><span className="eyebrow">{t('CBAC REPORT')}</span><h2 className="text-lg sm:text-xl font-black text-brand mt-1">{t('Review the report')}</h2></div>
      <button type="button" onClick={onToggleEdit} aria-pressed={editing} className={`btn !min-h-[40px] text-sm font-semibold ${editing ? 'btn-primary' : 'btn-secondary'}`}>{editing ? `✓ ${t('Done')}` : `✎ ${t('Edit')}`}</button>
    </div>
    {editing && <p className="text-xs text-muted">{locked ? t('Name, phone and address can be corrected here. The rest of the CBAC is read-only at PHC.') : t('Tap a field to change it. Fields with options open as a dropdown.')}</p>}
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-teal-50 border border-teal-100 p-3"><div className="text-xs text-muted">{t('Part A Risk Score:')}</div><div className="text-2xl font-black text-brand">{partA.totalScore} <span className="text-sm font-semibold text-muted">{t('out of')} 12</span></div></div>
      <div className="rounded-xl bg-teal-50 border border-teal-100 p-3"><div className="text-xs text-muted">{t('Part D PHQ-2:')}</div><div className="text-2xl font-black text-brand">{partD.totalScore} <span className="text-sm font-semibold text-muted">{t('out of')} 6</span></div></div>
    </div>
    {triage.reasons.length > 0
      ? <div className="rounded-xl border border-warn/40 bg-warn-soft/50 p-3"><h3 className="text-sm font-bold">{t('Clinical Triage Alerts:')}</h3><ul className="mt-1 text-xs space-y-1">{triage.reasons.map(r => <li key={r}>• {r}</li>)}</ul></div>
      : <p className="text-sm text-ok font-semibold">{t('No critical flags · Routine annual screening')}</p>}
    <dl className="divide-y divide-line/70 text-sm">
      {rows.map(row => {
        const editable = editing && (!locked || row.lockedOk);
        return <div key={row.label} className={`flex gap-3 py-2 ${editable ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'justify-between'}`}>
          <dt className="text-muted">{t(row.label)}</dt>
          <dd className={editable ? 'sm:flex sm:justify-end sm:flex-1' : 'text-right font-semibold'}>{editable ? control(row) : row.view}</dd>
          {row.error && <p role="alert" className="basis-full text-right text-xs text-danger">{t(row.error)}</p>}
        </div>;
      })}
    </dl>
    <div className="space-y-1 border-t border-line pt-3">
      <label htmlFor="report-finding" className="block text-sm font-bold">{t('Screening Finding / Clinical Assessment')} *</label>
      <select id="report-finding" value={finding} disabled={locked} onChange={event => onFinding(event.target.value)} className="w-full">
        <option value="">{t('Please select')}</option>
        <option value="negative">{t('Normal / Negative (Low Risk)')}</option>
        <option value="positive">{t('Suspected / Positive (High Risk Flagged)')}</option>
        <option value="needs_review">{t('Needs CHO / Medical Officer Review')}</option>
      </select>
      {!finding && !locked && <p className="text-xs text-amber-700">{t('Select the screening finding to save.')}</p>}
      {referral.referralRequired === 'yes' && <>
        <label htmlFor="report-urgency" className="block text-sm font-bold pt-2">{t('Urgency *')}</label>
        <select id="report-urgency" value={urgency} disabled={locked} onChange={event => onUrgency(event.target.value)} className="w-full">
          <option value="">{t('Please select')}</option>
          <option value="routine">{t('Routine')}</option>
          <option value="soon">{t('Soon')}</option>
          <option value="urgent">{t('Urgent')}</option>
        </select>
      </>}
      {!referral.referralRequired && !locked && <p className="text-xs text-amber-700">{t('Answer whether a referral is needed (Edit) to save.')}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onToggleEdit} aria-pressed={editing} className={`btn !min-h-[44px] ${editing ? 'btn-primary' : 'btn-secondary'}`}>{editing ? `✓ ${t('Done')}` : `✎ ${t('Edit')}`}</button>
        <button type="button" onClick={onFullForm} className="text-xs font-semibold text-teal-700 underline">{t('Open the full form instead')}</button>
      </div>
      <button type="button" onClick={onSave} disabled={!canSave} className="btn btn-primary !min-h-[44px] font-bold"><Icon name="check" size={18} /> {checkingAddress ? t('Checking address…') : saving ? t('Saving…') : existing ? t('Save changes') : referral.referralRequired === 'yes' ? t('Confirm CBAC & Create Referral') : t('Save CBAC Assessment')}</button>
    </div>
  </section>;
}

import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { getQuestionHint, getQuestionText, type InterviewQuestion } from '../intelligence/cbacInterviewQuestions';
import { joinAnswers, manualControlFor, type ManualOption } from '../intelligence/cbacManualOptions';
import { COOKING_FUELS, CBAC_B1_SYMPTOMS, CBAC_B2_SYMPTOMS, CBAC_B3_SYMPTOMS, PHQ2_OPTIONS, type CbacGeneralInfo, type CbacPartA, type CbacPartB, type CbacPartC, type CbacPartD } from '../intelligence/cbacTypes';
import type { SavedAnswer } from '../intelligence/cbacSavedAnswer';
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
        onChange={event => props.setCurrentAnswer(event.target.value)} placeholder={control.kind === 'number' ? (control.unit === 'cm' ? 'cm' : t('years')) : t('Type here')} disabled={interpreting} />
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
  saving: boolean; onEdit: () => void; onSave: () => void;
}

const SMOKE = ['Never', 'Used to consume / Sometimes now', 'Daily'];
const ALCOHOL: Record<string, string> = { never: 'Never', socially: 'Socially', weekly: 'Weekly', daily: 'Daily', yes: 'Yes' };

export function CbacReport({ general, partA, partB, partC, partD, triage, referral, finding, onFinding, urgency, onUrgency, saving, onEdit, onSave }: ReportProps) {
  const { t } = useLang();
  const notAnswered = <span className="text-amber-700">{t('Not answered')}</span>;
  const positives = [...CBAC_B1_SYMPTOMS, ...CBAC_B2_SYMPTOMS, ...CBAC_B3_SYMPTOMS].filter(s => partB.symptoms[s.id]);
  const phq = (value?: number) => value === undefined ? notAnswered : t(PHQ2_OPTIONS.find(o => o.value === value)?.label || '');
  const rows: [string, React.ReactNode][] = [
    ['Name', general.name || notAnswered],
    ['Age', general.age === '' ? notAnswered : `${general.age} ${t('yrs')}`],
    ['Sex', general.sex ? t(general.sex === 'F' ? 'Female' : general.sex === 'M' ? 'Male' : 'Other') : notAnswered],
    ['Waist', partA.waistCm !== undefined ? `${partA.waistCm} cm` : notAnswered],
    ['Tobacco', partA.smokeScore === undefined ? notAnswered : t(SMOKE[partA.smokeScore])],
    ['Alcohol', partA.alcoholScore === undefined ? notAnswered : t(partA.alcoholScore === 0 ? 'Never' : ALCOHOL[partA.alcoholFrequency || 'yes'] || 'Yes')],
    ['Physical activity', partA.physicalActivityScore === undefined ? notAnswered : t(partA.physicalActivityScore === 0 ? 'At least 150 minutes in a week' : 'Less than 150 minutes in a week')],
    ['Family history', partA.familyHistoryScore === undefined ? notAnswered : t(partA.familyHistoryScore ? 'Yes (Parent or Sibling)' : 'No')],
    ['Symptoms reported', positives.length ? positives.map(s => t(s.label)).join('; ') : t('No symptoms reported')],
    ['Cooking fuel', partC.cookingFuel.length ? partC.cookingFuel.map(id => t(COOKING_FUELS.find(f => f.id === id)?.label || id)).join(', ') : notAnswered],
    ['Little interest or pleasure', phq(partD.phq1Score)],
    ['Feeling down or hopeless', phq(partD.phq2Score)],
    ['Referral', !referral.referralRequired ? notAnswered : referral.referralRequired === 'yes' ? `${t('Yes — Initiate Referral')}${referral.destinationFacility ? ` · ${referral.destinationFacility}` : ''}` : t('No — Routine Community Care')],
  ];
  return <section className="card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
      <div><span className="eyebrow">{t('CBAC REPORT')}</span><h2 className="text-lg sm:text-xl font-black text-brand mt-1">{t('Review the report')}</h2></div>
      <button type="button" onClick={onEdit} className="btn btn-secondary !min-h-[40px] text-sm font-semibold">✎ {t('Edit')}</button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-teal-50 border border-teal-100 p-3"><div className="text-xs text-muted">{t('Part A Risk Score:')}</div><div className="text-2xl font-black text-brand">{partA.totalScore} <span className="text-sm font-semibold text-muted">{t('out of')} 12</span></div></div>
      <div className="rounded-xl bg-teal-50 border border-teal-100 p-3"><div className="text-xs text-muted">{t('Part D PHQ-2:')}</div><div className="text-2xl font-black text-brand">{partD.totalScore} <span className="text-sm font-semibold text-muted">{t('out of')} 6</span></div></div>
    </div>
    {triage.reasons.length > 0
      ? <div className="rounded-xl border border-warn/40 bg-warn-soft/50 p-3"><h3 className="text-sm font-bold">{t('Clinical Triage Alerts:')}</h3><ul className="mt-1 text-xs space-y-1">{triage.reasons.map(r => <li key={r}>• {r}</li>)}</ul></div>
      : <p className="text-sm text-ok font-semibold">{t('No critical flags · Routine annual screening')}</p>}
    <dl className="divide-y divide-line/70 text-sm">
      {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-2"><dt className="text-muted">{t(label)}</dt><dd className="text-right font-semibold">{value}</dd></div>)}
    </dl>
    <div className="space-y-1 border-t border-line pt-3">
      <label htmlFor="report-finding" className="block text-sm font-bold">{t('Screening Finding / Clinical Assessment')} *</label>
      <select id="report-finding" value={finding} onChange={event => onFinding(event.target.value)} className="w-full">
        <option value="">{t('Please select')}</option>
        <option value="negative">{t('Normal / Negative (Low Risk)')}</option>
        <option value="positive">{t('Suspected / Positive (High Risk Flagged)')}</option>
        <option value="needs_review">{t('Needs CHO / Medical Officer Review')}</option>
      </select>
      {!finding && <p className="text-xs text-amber-700">{t('Select the screening finding to save.')}</p>}
      {referral.referralRequired === 'yes' && <>
        <label htmlFor="report-urgency" className="block text-sm font-bold pt-2">{t('Urgency *')}</label>
        <select id="report-urgency" value={urgency} onChange={event => onUrgency(event.target.value)} className="w-full">
          <option value="">{t('Please select')}</option>
          <option value="routine">{t('Routine')}</option>
          <option value="soon">{t('Soon')}</option>
          <option value="urgent">{t('Urgent')}</option>
        </select>
      </>}
      {!referral.referralRequired && <p className="text-xs text-amber-700">{t('Answer whether a referral is needed (Edit) to save.')}</p>}
    </div>
    <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
      <button type="button" onClick={onEdit} className="btn btn-secondary !min-h-[44px]">✎ {t('Edit')}</button>
      <button type="button" onClick={onSave} disabled={saving || !finding || !referral.referralRequired || (referral.referralRequired === 'yes' && !urgency)} className="btn btn-primary !min-h-[44px] font-bold"><Icon name="check" size={18} /> {saving ? t('Saving…') : referral.referralRequired === 'yes' ? t('Confirm CBAC & Create Referral') : t('Save CBAC Assessment')}</button>
    </div>
  </section>;
}

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CbacReport, GuidedQuestionCard } from './GuidedCbac';
import { buildInterviewQuestions } from '../intelligence/cbacPartBInterview';
import { CBAC_B1_SYMPTOMS } from '../intelligence/cbacTypes';

const questions = buildInterviewQuestions('F', 45, ['tb']);
const baseProps = {
  index: 0, total: questions.length, sectionIndex: 0, sectionTotal: 8, mode: 'manual' as const, sex: 'F' as const, age: 45 as const, currentAnswer: '', setCurrentAnswer: vi.fn(),
  onAnswer: vi.fn(), interpreting: false, answerError: '', canGoBack: false, onBack: vi.fn(), onSkip: vi.fn(), onSwitchMode: vi.fn(),
  voice: { active: false, speaking: false, listening: false, onStart: vi.fn(), onRepeat: vi.fn(), onToggleMic: vi.fn(), onStop: vi.fn() },
};

describe('guided question card', () => {
  it('shows one question with tap options for choice questions', () => {
    const html = renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'smoke')!} />);
    expect(html).toContain('Do you consume smoke or smokeless tobacco');
    expect(html).toContain('Never');
    expect(html).toContain('Daily');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Section A');
    expect(html).toContain('Next →');
  });
  it('uses a text box for name and numeric keypad for age', () => {
    expect(renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'name')!} />)).toContain('id="guided-answer"');
    expect(renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'age')!} />)).toContain('inputMode="numeric"');
  });
  it('offers multi-select with a none option for Part B categories', () => {
    const html = renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'b_categories')!} />);
    expect(html).toContain('TB or cough');
    expect(html).toContain('None of these');
    expect(html).not.toContain('Continue');
    expect(html).toContain('Next →');
  });
  it('shows voice controls only in voice mode', () => {
    const q = questions[0];
    expect(renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={q} />)).not.toContain('Start voice');
    expect(renderToStaticMarkup(<GuidedQuestionCard {...baseProps} mode="voice" question={q} />)).toContain('Start voice');
  });
});

describe('returning to an answered question', () => {
  it('highlights the earlier choice and fills earlier multi-select picks', () => {
    const smoke = renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'smoke')!} saved={{ single: 'Daily' }} />);
    expect(smoke).toMatch(/aria-pressed="true"[^>]*>✓ <!-- -->Daily|aria-pressed="true"[^>]*>✓ Daily/);
    expect(smoke).toContain('aria-pressed="false"');
    const cats = renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'b_categories')!} saved={{ multi: ['TB or cough'] }} />);
    expect(cats).toMatch(/aria-pressed="true"[^>]*>✓ <!-- -->TB or cough|aria-pressed="true"[^>]*>✓ TB or cough/);
    const none = renderToStaticMarkup(<GuidedQuestionCard {...baseProps} question={questions.find(q => q.id === 'b_categories')!} saved={{ multi: [], none: true }} />);
    expect(none).toMatch(/aria-pressed="true"[^>]*>✓ <!-- -->None of these|aria-pressed="true"[^>]*>✓ None of these/);
  });
});

describe('CBAC report', () => {
  const general = { name: 'Sunita Devi', age: 52, sex: 'F' } as never;
  const html = renderToStaticMarkup(<CbacReport general={general}
    partA={{ totalScore: 6, waistCm: 92, smokeScore: 0, alcoholScore: 1, alcoholFrequency: 'weekly', physicalActivityScore: 1, familyHistoryScore: 2, ageScore: 3 } as never}
    partB={{ symptoms: { [CBAC_B1_SYMPTOMS[1].id]: true } }} partC={{ cookingFuel: ['firewood'], occupationalExposure: [] } as never}
    partD={{ phq1Score: 1, phq2Score: 2, totalScore: 3 } as never}
    triage={{ reasons: ['High NCD Risk'], highRiskNcd: true, tbSuspectAlert: true, symptomAlert: true, mentalHealthAlert: false }}
    referral={{ referralRequired: 'yes', destinationFacility: 'PHC Bero' }} finding="" onFinding={() => {}} urgency="" onUrgency={() => {}} saving={false} onEdit={() => {}} onSave={() => {}} />);
  it('summarises answers, scores and alerts with an Edit option', () => {
    expect(html).toContain('Review the report');
    expect(html).toContain('Sunita Devi');
    expect(html).toContain('92 cm');
    expect(html).toContain('Coughing more than 2 weeks');
    expect(html).toMatch(/text-2xl font-black text-brand">6[\s\S]*?out of[\s\S]*?12/);
    expect(html).toContain('PHC Bero');
    expect(html).toContain('✎');
    expect(html).toContain('Confirm CBAC &amp; Create Referral');
  });
  it('does not pre-select a screening finding and blocks saving until one is chosen', () => {
    expect(html).toContain('<option value="" selected="">Please select</option>');
    expect(html).toContain('Select the screening finding to save.');
    expect(html).toMatch(/disabled=""[^>]*>[^<]*<svg|disabled=""[^>]*class="btn btn-primary/);
  });
  it('flags unanswered items instead of hiding them', () => {
    const empty = renderToStaticMarkup(<CbacReport general={{ name: '', age: '', sex: '' } as never} partA={{ totalScore: 0 } as never} partB={{ symptoms: {} }} partC={{ cookingFuel: [], occupationalExposure: [] } as never} partD={{ totalScore: 0 } as never}
      triage={{ reasons: [], highRiskNcd: false, tbSuspectAlert: false, symptomAlert: false, mentalHealthAlert: false }} referral={{ referralRequired: 'no', destinationFacility: '' }} finding="negative" onFinding={() => {}} urgency="" onUrgency={() => {}} saving={false} onEdit={() => {}} onSave={() => {}} />);
    expect(empty).toContain('Not answered');
    expect(empty).toContain('No symptoms reported');
  });
});

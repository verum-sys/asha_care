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
    referral={{ referralRequired: 'yes', destinationFacility: 'PHC Bero' }} finding="" onFinding={() => {}} urgency="" onUrgency={() => {}} saving={false} editing={false} onToggleEdit={() => {}} onField={() => {}} onFullForm={() => {}} onSave={() => {}} />);
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
      triage={{ reasons: [], highRiskNcd: false, tbSuspectAlert: false, symptomAlert: false, mentalHealthAlert: false }} referral={{ referralRequired: 'no', destinationFacility: '' }} finding="negative" onFinding={() => {}} urgency="" onUrgency={() => {}} saving={false} editing={false} onToggleEdit={() => {}} onField={() => {}} onFullForm={() => {}} onSave={() => {}} />);
    expect(empty).toContain('Not answered');
    expect(empty).toContain('No symptoms reported');
  });
});

describe('CBAC report inline editing', () => {
  const props = {
    general: { name: 'Sunita', age: 52, sex: 'F', phone: '9876543210', address: 'Bero', villageWard: 'Bero' } as never,
    partA: { totalScore: 4, smokeScore: 1, waistCm: 90 } as never, partB: { symptoms: { night_sweats: true } }, partC: { cookingFuel: ['lpg'], occupationalExposure: [] } as never,
    partD: { phq1Score: 1, totalScore: 1 } as never,
    triage: { reasons: [], highRiskNcd: false, tbSuspectAlert: false, symptomAlert: false, mentalHealthAlert: false },
    referral: { referralRequired: 'no', destinationFacility: '' }, finding: 'negative', onFinding: () => {}, urgency: '', onUrgency: () => {},
    onToggleEdit: () => {}, onField: () => {}, onFullForm: () => {}, saving: false, onSave: () => {}, existing: true,
  };
  it('shows plain values until Edit is pressed', () => {
    const html = renderToStaticMarkup(<CbacReport {...props} editing={false} />);
    expect(html).not.toContain('<select aria-label="Tobacco"');
    expect(html).toContain('Sunita');
  });
  it('turns fields with options into dropdowns, text fields into inputs and lists into checklists', () => {
    const html = renderToStaticMarkup(<CbacReport {...props} editing />);
    expect(html).toContain('<select aria-label="Tobacco"');
    expect(html).toMatch(/<option value="Sometimes" selected="">Used to consume \/ Sometimes now<\/option>/);
    expect(html).toContain('<select aria-label="Referral"');
    expect(html).toContain('value="Sunita"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Done');
  });
  it('shows mobile and address problems under their rows', () => {
    const html = renderToStaticMarkup(<CbacReport {...props} editing={false} contactErrors={{ phone: 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.', address: 'Enter a real address, such as the village, ward or locality.' }} />);
    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).toContain('Enter a valid 10-digit mobile number');
    expect(html).toContain('Enter a real address');
  });
  it('only lets PHC change name, phone and address when locked', () => {
    const html = renderToStaticMarkup(<CbacReport {...props} editing locked />);
    expect(html).toContain('value="Sunita"');
    expect(html).toContain('value="9876543210"');
    expect(html).not.toContain('<select aria-label="Tobacco"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('read-only at PHC');
  });
});


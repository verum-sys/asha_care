import { describe, expect, it } from 'vitest';
import { savedAnswerFor } from './cbacSavedAnswer';
import { manualControlFor } from './cbacManualOptions';
import { buildInterviewQuestions } from './cbacPartBInterview';
import { parseCbacInterviewAnswer } from './cbacInterviewAnswers';

const base = {
  general: { name: 'Sunita', age: 52, sex: 'F' } as never,
  partA: { totalScore: 0 } as never, partB: { symptoms: {} }, partC: { cookingFuel: [], occupationalExposure: [] } as never, partD: { totalScore: 0 } as never,
  bCategories: undefined as never, referralRequired: '',
};

describe('saved answers shown when returning to a question', () => {
  it('fills typed values', () => {
    expect(savedAnswerFor('name', base)).toEqual({ text: 'Sunita' });
    expect(savedAnswerFor('age', base)).toEqual({ text: '52' });
    expect(savedAnswerFor('waist', { ...base, partA: { waistCm: 88 } as never })).toEqual({ text: '88' });
    expect(savedAnswerFor('waist', base)).toBeUndefined();
  });
  it('maps stored scores back to the option that was tapped', () => {
    const a = (partA: object) => ({ ...base, partA: partA as never });
    expect(savedAnswerFor('smoke', a({ smokeScore: 1 }))).toEqual({ single: 'Sometimes' });
    expect(savedAnswerFor('alcohol', a({ alcoholScore: 1, alcoholFrequency: 'weekly' }))).toEqual({ single: 'Weekly' });
    expect(savedAnswerFor('alcohol', a({ alcoholScore: 0 }))).toEqual({ single: 'Never' });
    expect(savedAnswerFor('physicalActivity', a({ physicalActivityScore: 1 }))).toEqual({ single: 'Less than 150 minutes per week' });
    expect(savedAnswerFor('familyHistory', a({ familyHistoryScore: 2 }))).toEqual({ single: 'Yes' });
    expect(savedAnswerFor('b:night_sweats', { ...base, partB: { symptoms: { night_sweats: false } } })).toEqual({ single: 'No' });
    expect(savedAnswerFor('b:night_sweats', base)).toBeUndefined();
    expect(savedAnswerFor('phq2_mood', { ...base, partD: { phq2Score: 3 } as never })).toEqual({ single: 'Nearly every day' });
    expect(savedAnswerFor('initiate_referral', { ...base, referralRequired: 'no' })).toEqual({ single: 'No, screening only' });
  });
  it('restores multi-select choices and the "none" choice', () => {
    expect(savedAnswerFor('b_categories', { ...base, bCategories: ['tb', 'mouth'] })).toEqual({ multi: ['TB or cough', 'mouth or oral'] });
    expect(savedAnswerFor('b_categories', { ...base, bCategories: [] })).toEqual({ multi: [], none: true });
    expect(savedAnswerFor('cooking_fuel', { ...base, partC: { cookingFuel: ['lpg', 'coal'], occupationalExposure: [] } as never })).toEqual({ multi: ['LPG', 'Coal'] });
  });
  it('every saved single answer is one of that question’s options (so it can be highlighted)', () => {
    const questions = buildInterviewQuestions('F', 65, ['tb', 'mouth']);
    for (const q of questions) {
      const control = manualControlFor(q, 'F', 65);
      if (control.kind !== 'single') continue;
      for (const option of control.options) {
        const parsed = parseCbacInterviewAnswer(q.id, option.answer, 'F', 65);
        if (!parsed.ok) continue;
        const u = parsed.updates;
        const saved = savedAnswerFor(q.id, {
          ...base, general: { ...(base.general as object), sex: u.generalUpdates.sex ?? 'F' } as never,
          partA: { ...u.partAUpdates } as never, partB: { symptoms: { ...u.partBUpdates } }, partD: { phq1Score: u.partDUpdates.phq1Score, phq2Score: u.partDUpdates.phq2Score, totalScore: 0 } as never,
        });
        expect(saved && 'single' in saved ? saved.single : undefined, `${q.id}:${option.answer}`).toBe(option.answer);
      }
    }
  });
});

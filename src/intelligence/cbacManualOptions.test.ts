import { describe, expect, it } from 'vitest';
import { buildInterviewQuestions } from './cbacPartBInterview';
import { manualControlFor, joinAnswers, type ManualOption } from './cbacManualOptions';
import { parseCbacInterviewAnswer } from './cbacInterviewAnswers';
import { parseReferralDecision } from './cbacReferralInterview';
import { COOKING_FUELS } from './cbacTypes';

const all = buildInterviewQuestions('F', 65, ['tb', 'eyes_ears', 'mouth', 'skin_nerve', 'women', 'elderly']);

describe('manual answer options are understood locally without AI', () => {
  it('every single-choice option parses for its question', () => {
    for (const question of all) {
      const control = manualControlFor(question, 'F', 65);
      if (control.kind !== 'single' || question.id === 'initiate_referral') continue;
      for (const option of control.options) {
        const result = parseCbacInterviewAnswer(question.id, option.answer, 'F', 65);
        expect(result.ok, `${question.id}: ${option.answer}`).toBe(true);
      }
    }
  });
  it('maps activity and smoking options to the right scores', () => {
    const get = (id: string, answer: string) => { const r = parseCbacInterviewAnswer(id, answer, 'F', 65); return r.ok ? r.updates.partAUpdates : undefined; };
    expect(get('physicalActivity', '150 minutes per week')?.physicalActivityScore).toBe(0);
    expect(get('physicalActivity', 'Less than 150 minutes per week')?.physicalActivityScore).toBe(1);
    expect(get('smoke', 'Sometimes')?.smokeScore).toBe(1);
    expect(get('smoke', 'Daily')?.smokeScore).toBe(2);
    expect(get('familyHistory', 'Yes')?.familyHistoryScore).toBe(2);
  });
  it('accepts each cooking fuel on its own and refuses two at once', () => {
    const all6 = COOKING_FUELS.map(f => ({ label: f.label, answer: f.label }));
    for (const fuel of all6) {
      const r = parseCbacInterviewAnswer('cooking_fuel', fuel.answer, 'F', 40);
      expect(r.ok && r.updates.partCUpdates.cookingFuel?.length, fuel.answer).toBeGreaterThan(0);
    }
    expect(parseCbacInterviewAnswer('cooking_fuel', joinAnswers(all6.slice(0, 3)), 'F', 40).ok).toBe(false);
  });
  it('offers Part B categories as a single choice, each understood alone, plus none; two together are refused', () => {
    const control = manualControlFor(all.find(q => q.id === 'b_categories')!, 'F', 65);
    if (control.kind !== 'single') throw new Error('expected single');
    for (const option of control.options) {
      const r = parseCbacInterviewAnswer('b_categories', option.answer, 'F', 65);
      expect(r.ok && r.categories?.length, option.answer).toBe(option.answer === 'none' ? 0 : 1);
    }
    const combined = parseCbacInterviewAnswer('b_categories', joinAnswers(control.options.slice(0, 2) as ManualOption[]), 'F', 65);
    expect(combined.ok).toBe(false);
  });
  it('referral choices are understood', () => {
    const control = manualControlFor(all[0], 'F', 65);
    expect(control.kind).toBe('text');
    expect(parseReferralDecision('Yes, initiate referral')).toBe('yes');
    expect(parseReferralDecision('No, screening only')).toBe('no');
  });
});

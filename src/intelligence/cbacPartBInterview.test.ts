import { describe, expect, it } from 'vitest';
import { buildInterviewQuestions, parsePartBCategories, parseYesNo } from './cbacPartBInterview';
import { parseCbacInterviewAnswer } from './cbacInterviewAnswers';

const ids = (qs: { id: string }[]) => qs.map(q => q.id);

describe('Part B category interview', () => {
  it('goes from Part A straight to the Part B category question, then Part C', () => {
    const list = ids(buildInterviewQuestions('M', 30, undefined));
    const family = list.indexOf('familyHistory');
    expect(list[family + 1]).toBe('b_categories');
    expect(list[family + 2]).toBe('cooking_fuel');
  });
  it('asks only the chosen sections', () => {
    const list = ids(buildInterviewQuestions('M', 30, ['mouth']));
    expect(list).toContain('b:pain_chewing');
    expect(list).not.toContain('b:cough_two_weeks');
    expect(list).not.toContain('b:cloudy_vision');
    const tb = ids(buildInterviewQuestions('M', 30, ['tb']));
    expect(tb.filter(id => id.startsWith('b:'))).toHaveLength(9);
  });
  it('hides women and elderly sections when not applicable', () => {
    expect(ids(buildInterviewQuestions('M', 30, ['women', 'elderly'])).some(id => id.startsWith('b:'))).toBe(false);
    expect(ids(buildInterviewQuestions('F', 65, ['women', 'elderly'])).filter(id => id.startsWith('b:'))).toHaveLength(11);
  });
  it.each([['TB', ['tb']], ['I have cough and mouth problem', ['tb', 'mouth']], ['मुंह और आंख', ['eyes_ears', 'mouth']], ['none', []], ['कोई नहीं', []]])('maps %s', (said, expected) => {
    expect(parsePartBCategories(said, 'M', 30)?.sort()).toEqual([...expected].sort());
  });
  it('does not guess for unrelated speech', () => expect(parsePartBCategories('banana', 'M', 30)).toBeUndefined());
  it.each([['yes', true], ['haan', true], ['हाँ', true], ['nahi', false], ['No.', false]])('yes/no %s', (said, expected) => expect(parseYesNo(said)).toBe(expected));
  it.each(['maybe', 'yes but no', 'I think so'])('rejects hedged %s', said => expect(parseYesNo(said)).toBeUndefined());
  it('records a symptom answer on its own field only', () => {
    const r = parseCbacInterviewAnswer('b:night_sweats', 'yes', 'M', 30);
    expect(r.ok && r.updates.partBUpdates).toEqual({ night_sweats: true });
  });
  it('returns the chosen categories', () => {
    const r = parseCbacInterviewAnswer('b_categories', 'TB and skin', 'M', 30);
    expect(r.ok && r.categories).toEqual(['tb', 'skin_nerve']);
  });
});

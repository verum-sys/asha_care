import { describe, expect, it } from 'vitest';
import { ALCOHOL_OPTIONS, parseAlcoholFrequency, alcoholScoreFor } from './cbacAlcohol';
import { parseCbacInterviewAnswer } from './cbacInterviewAnswers';
import { calculatePartAScore, parseCbacText } from './cbacIntelligence';
describe('alcohol frequency', () => {
  it('offers distinct frequency choices even when CBAC scores are equal', () => {
    expect(ALCOHOL_OPTIONS.map(option => option.value)).toEqual(['never', 'socially', 'weekly', 'daily', 'unspecified']);
    expect(ALCOHOL_OPTIONS.map(option => option.score)).toEqual([0, 1, 1, 1, 1]);
  });
  it.each(['everyday', 'Everyday', 'every day', 'every-day', 'every  day', 'daily', 'I drink everyday', 'रोज़ाना'])('accepts daily speech: %s', answer => {
    expect(parseAlcoholFrequency(answer)).toBe('daily');
    const result = parseCbacInterviewAnswer('alcohol', answer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.updates.partAUpdates).toEqual({ alcoholFrequency: 'daily', alcoholScore: 1 });
  });
  it.each([['Socially', 'socially'], ['occasionally', 'socially'], ['I drink at parties', 'socially'], ['कभी-कभी', 'socially'], ['weekly', 'weekly'], ['on weekends', 'weekly'], ['once a week', 'weekly'], ['never', 'never'], ['No alcohol', 'never']])('records the binary consumption score for %s', (answer, frequency) => {
    const result = parseCbacInterviewAnswer('alcohol', answer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.updates.partAUpdates).toEqual({ alcoholFrequency: frequency, alcoholScore: frequency === 'never' ? 0 : 1 });
  });
  it.each(['not sure', 'not everyday', 'daily and socially'])('asks for a frequency when unclear: %s', answer => {
    expect(parseCbacInterviewAnswer('alcohol', answer).ok).toBe(false);
  });
  it('updates the cumulative total when daily is corrected to socially', () => {
    const base = { ageScore: 3, smokeScore: 1, alcoholScore: alcoholScoreFor('daily') };
    expect(calculatePartAScore(base)).toBe(5);
    expect(calculatePartAScore({ ...base, alcoholScore: alcoholScoreFor('socially') })).toBe(5);
  });
  it('supports daily and social frequency in free-text records too', () => {
    expect(parseCbacText('I drink alcohol everyday').partAUpdates.alcoholFrequency).toBe('daily');
    expect(parseCbacText('I drink socially').partAUpdates.alcoholFrequency).toBe('socially');
  });
  it('keeps walking frequency separate from alcohol frequency in a patient note', () => {
    const parsed = parseCbacText('Never smokes, no alcohol, walks daily');
    expect(parsed.partAUpdates.alcoholFrequency).toBe('never');
    expect(parsed.partAUpdates.alcoholScore).toBe(0);
  });
  it('accepts everyday in other frequency questions', () => {
    const smoke = parseCbacInterviewAnswer('smoke', 'everyday');
    const mood = parseCbacInterviewAnswer('phq2_mood', 'nearly everyday');
    expect(smoke.ok && smoke.updates.partAUpdates.smokeScore).toBe(2);
    expect(mood.ok && mood.updates.partDUpdates.phq2Score).toBe(3);
  });
});

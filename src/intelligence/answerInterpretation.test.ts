import { afterEach, describe, expect, it, vi } from 'vitest';
import { interpretInterviewAnswer, validateInterpretation } from './answerInterpretation';
import { parseCbacInterviewAnswer } from './cbacInterviewAnswers';
const token = async () => 'test-session';
afterEach(() => vi.unstubAllGlobals());
describe('natural language interpretation', () => {
  it.each(['150 minutes', '2.5 hours', 'two point five hours', 'two and a half hours', 'one hour and thirty minutes plus one hour', '30 minutes five days a week'])('normalizes activity %s to at least 150 minutes', answer => {
    const result = parseCbacInterviewAnswer('physicalActivity', answer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.updates.partAUpdates.physicalActivityScore).toBe(0);
  });
  it.each([['2 hours', 120, 1], ['half an hour daily', 210, 0], ['forty five minutes per week', 45, 1], ['30 minutes 3 days per week', 90, 1]])('calculates weekly activity: %s', (answer, minutes, score) => {
    const result = parseCbacInterviewAnswer('physicalActivity', answer);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.updates.partAUpdates).toMatchObject({ activityMinutesPerWeek: minutes, physicalActivityScore: score });
  });
  it.each(['Socially', 'occasionally', 'Yes', 'Weekly', 'daily'])('marks alcohol %s as consumption = 1', answer => {
    const parsed = parseCbacInterviewAnswer('alcohol', answer);
    expect(parsed.ok && parsed.updates.partAUpdates.alcoholScore).toBe(1);
  });
  it('uses local rules without a provider call when the answer is clear', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await interpretInterviewAnswer('physicalActivity', '2.5 hours', 'M', token)).ok).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('maps a paraphrase through AI without changing other fields', async () => {
    const fetcher = vi.fn(async (_url: string, _options: { body: string }) => ({ ok: true, json: async () => ({ normalizedAnswer: 'Socially', confidence: 0.95, needsClarification: false, explanation: 'Occasional consumption' }) }));
    vi.stubGlobal('fetch', fetcher);
    const result = await interpretInterviewAnswer('alcohol', 'Only raise a glass at weddings', 'M', token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updates.partAUpdates).toEqual({ alcoholFrequency: 'socially', alcoholScore: 1 });
      expect(result.updates.generalUpdates).toEqual({});
    }
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ questionId: 'alcohol', answer: 'Only raise a glass at weddings' });
  });
  it.each([
    { normalizedAnswer: 'Yes', confidence: 0.5, needsClarification: false, explanation: 'Unclear' },
    { normalizedAnswer: 'Yes', confidence: 0.99, needsClarification: true, explanation: 'Ask' },
    { normalizedAnswer: 'Male', confidence: 1, needsClarification: false, explanation: 'Wrong field' },
    { patches: { age: 90 } },
  ])('does not apply uncertain, invalid, or wrong-field model output', async response => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => response })));
    const result = await interpretInterviewAnswer('alcohol', 'It depends', 'M', token);
    expect(result.ok).toBe(false);
  });
  it('retains manual clarification when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await interpretInterviewAnswer('alcohol', 'It depends', 'M', token)).ok).toBe(false);
  });
  it('rejects unbounded or malformed model output', () => {
    expect(validateInterpretation({ normalizedAnswer: 'Yes', confidence: 2, needsClarification: false, explanation: '' })).toBe(false);
  });
});

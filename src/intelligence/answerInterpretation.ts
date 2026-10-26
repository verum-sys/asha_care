import { CBAC_INTERVIEW_QUESTIONS } from './cbacInterviewQuestions';
import { activityMinutesPerWeek } from './cbacActivity';
import { parseCbacInterviewAnswer, type InterviewAnswerResult } from './cbacInterviewAnswers';
import { B_CATEGORIES_ID, B_SYMPTOM_PREFIX } from './cbacPartBInterview';
import type { Sex } from '../db/types';
export interface Interpretation { normalizedAnswer: string; confidence: number; needsClarification: boolean; explanation: string; }
export function validateInterpretation(value: unknown): value is Interpretation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.normalizedAnswer === 'string' && v.normalizedAnswer.length <= 500 && typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1 && typeof v.needsClarification === 'boolean' && typeof v.explanation === 'string' && v.explanation.length <= 500;
}
export async function interpretInterviewAnswer(questionId: string, answer: string, sex: Sex | '', getToken: () => Promise<string | null>, signal?: AbortSignal, age: number | '' = '', alternatives: string[] = []): Promise<InterviewAnswerResult> {
  const local = parseCbacInterviewAnswer(questionId, answer, sex, age);
  const normalized = answer.toLowerCase().trim().replace(/[.!?]$/, '');
  const isPartB = questionId === B_CATEGORIES_ID || questionId.startsWith(B_SYMPTOM_PREFIX);
  const isSample = CBAC_INTERVIEW_QUESTIONS.find(question => question.id === questionId)?.sampleResponses.some(sample => sample.toLowerCase() === normalized);
  const simple = /^(?:yes|no|none|never|daily|every[ -]?day|sometimes|occasionally|socially|weekly|past|other|male|mail|female|femail|nearly every[ -]?day|not at all|several days|more than half the days|हाँ|हां|नहीं|कभी नहीं|कभी-कभी)$/i.test(normalized);
  const numeric = (questionId === 'waist' && /^\d+(?:\.\d+)?\s*(?:cm|centimeters?)?$/.test(normalized)) || (questionId === 'physicalActivity' && activityMinutesPerWeek(answer) !== undefined && !/\b(?:but|not|don.t|do not|less|under)\b/.test(normalized));
  if ((local.ok && (isSample || simple || numeric || isPartB)) || questionId === 'name' || questionId === 'age') return local;
  try {
    const token = await getToken();
    if (!token) return { ok: false, error: 'Please sign in to interpret this wording, or select a quick answer.' };
    const response = await fetch('/api/interpret-answer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ questionId, answer, ...(alternatives.length ? { alternatives: alternatives.slice(0, 5) } : {}) }), signal });
    if (!response.ok) return { ok: false, error: local.ok ? 'Please clarify this answer. AI interpretation is unavailable; use a quick answer or edit the form.' : local.error };
    const interpreted: unknown = await response.json();
    if (!validateInterpretation(interpreted) || interpreted.needsClarification || interpreted.confidence < 0.85) return { ok: false, error: 'Please clarify this answer or select a quick answer. No fields were changed.' };
    const parsed = parseCbacInterviewAnswer(questionId, interpreted.normalizedAnswer, sex, age);
    if (!parsed.ok) return { ok: false, error: 'Please clarify this answer or select a quick answer. No fields were changed.' };
    parsed.updates.explanations.push({ field: questionId, detail: `AI interpreted as: ${interpreted.normalizedAnswer}. Review this selection.` });
    return parsed;
  } catch { return { ok: false, error: 'AI interpretation is unavailable. Select a quick answer or enter the form value directly.' }; }
}

import type { CbacPartA, CbacPartB, CbacPartC, CbacPartD } from './cbacTypes';
import { CBAC_B1_SYMPTOMS, CBAC_B2_SYMPTOMS, CBAC_B3_SYMPTOMS } from './cbacTypes';
import { getPartAScoreBreakdown } from './cbacScoreBreakdown';

/** Local draft: records supplied findings without sending patient data to a provider. */
export function generateWorkerNotes(input: {
  partA: CbacPartA; partB: CbacPartB; partC: CbacPartC; partD: CbacPartD;
  reasons: string[]; referralRequired: string; urgency: string;
}): string {
  const { partA, partB, partC, partD } = input;
  const score = getPartAScoreBreakdown(partA);
  const lines = [`CBAC screening: Part A risk score ${score.total}/12 (${score.answered}/6 risk questions answered${score.answered < 6 ? '; incomplete assessment' : ''}).`];
  const symptoms = [...CBAC_B1_SYMPTOMS, ...CBAC_B2_SYMPTOMS, ...CBAC_B3_SYMPTOMS].filter(item => partB.symptoms[item.id] === true).map(item => item.label);
  lines.push(symptoms.length ? `Reported positive symptoms: ${symptoms.join('; ')}.` : 'No positive symptoms selected; verify symptom screening is complete.');
  if (partC.cookingFuel.length) lines.push(`Recorded cooking fuel: ${partC.cookingFuel.join(', ')}.`);
  if (partC.occupationalExposure.length) lines.push(`Recorded occupational exposure: ${partC.occupationalExposure.join(', ')}.`);
  const phqCount = [partD.phq1Score, partD.phq2Score].filter(value => value !== undefined).length;
  if (phqCount) lines.push(`PHQ-2 screening score: ${(partD.phq1Score ?? 0) + (partD.phq2Score ?? 0)}/6 (${phqCount}/2 questions answered${phqCount < 2 ? '; incomplete' : ''}).`);
  if (input.reasons.length) lines.push(`Screening flags (not confirmed diagnoses): ${input.reasons.join('; ')}.`);
  lines.push(input.referralRequired === 'yes' ? `Referral planned; priority: ${input.urgency}. Confirm destination and arrangements before saving.` : 'Referral is not selected in the current plan.');
  lines.push('Draft for worker review.');
  return lines.join('\n');
}

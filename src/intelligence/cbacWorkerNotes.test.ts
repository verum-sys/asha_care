import { describe, expect, it } from 'vitest';
import { generateWorkerNotes } from './cbacWorkerNotes';
const base = {
  partA: { totalScore: 0 }, partB: { symptoms: {} }, partC: { cookingFuel: [], occupationalExposure: [] }, partD: { totalScore: 0 },
  reasons: [], referralRequired: 'no', urgency: 'routine',
};
describe('local worker notes', () => {
  it('marks unanswered screening as incomplete rather than healthy', () => {
    const draft = generateWorkerNotes(base);
    expect(draft).toContain('0/6 risk questions answered; incomplete');
    expect(draft).toContain('verify symptom screening is complete');
    expect(draft).not.toContain('PHQ-2 screening score');
    expect(draft).toContain('Draft for worker review');
  });
  it('uses supplied scores, positive symptoms and planned referral without claiming acceptance', () => {
    const draft = generateWorkerNotes({ ...base, partA: { ageScore: 3, smokeScore: 2, totalScore: 5 }, partB: { symptoms: { cough_two_weeks: true, blood_in_sputum: false } }, partD: { phq1Score: 2, totalScore: 2 }, reasons: ['TB suspect'], referralRequired: 'yes' });
    expect(draft).toContain('risk score 5/12');
    expect(draft).toContain('Coughing more than 2 weeks');
    expect(draft).not.toContain('Blood in sputum');
    expect(draft).toContain('1/2 questions answered; incomplete');
    expect(draft).toContain('not confirmed diagnoses');
    expect(draft).toContain('Referral planned');
    expect(draft).not.toContain('accepted');
  });
});

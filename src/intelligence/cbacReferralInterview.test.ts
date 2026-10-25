import { describe, expect, it } from 'vitest';
import { parseReferralDecision, referralInterviewQuestion } from './cbacReferralInterview';

describe('ASHA referral voice confirmation', () => {
  it('announces the score and PHC recommendation before asking permission', () => {
    const question = referralInterviewQuestion(6, true, true);
    expect(question.slide).toBe('REFERRAL');
    expect(question.promptEn).toContain('6 out of 12');
    expect(question.promptEn).toContain('recommend referral to PHC');
    expect(question.promptEn).toContain('Would you like to initiate');
  });
  it('distinguishes a low score and incomplete risk assessment', () => {
    expect(referralInterviewQuestion(2, false, true).promptEn).toContain('does not automatically flag');
    expect(referralInterviewQuestion(2, false, false).promptEn).toContain('incomplete');
  });
  it.each(['yes', 'Yes, initiate referral', 'yes please', 'हाँ', 'हां'])('accepts explicit confirmation: %s', answer => {
    expect(parseReferralDecision(answer)).toBe('yes');
  });
  it.each(['no', 'No, screening only', 'not now', "don't refer", 'नहीं'])('respects refusal: %s', answer => {
    expect(parseReferralDecision(answer)).toBe('no');
  });
  it.each(['maybe', 'yes or no', 'no initiate referral', 'I have a score of six', ''])('asks again for uncertain speech: %s', answer => {
    expect(parseReferralDecision(answer)).toBeUndefined();
  });
});

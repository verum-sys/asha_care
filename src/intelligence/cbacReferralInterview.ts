import type { InterviewQuestion } from './cbacInterviewQuestions';

export function referralInterviewQuestion(score: number, recommended: boolean, complete: boolean): InterviewQuestion {
  const summary = complete ? `The Part A risk score is ${score} out of 12.` : `The current Part A score is ${score} out of 12; some risk answers are incomplete.`;
  return {
    id: 'initiate_referral', field: 'referralRequired', slide: 'REFERRAL',
    promptEn: `${summary} ${recommended ? 'Screening flags recommend referral to PHC.' : 'The current screening does not automatically flag a referral.'} Would you like to initiate a referral to PHC?`,
    promptHi: `भाग ए का ${complete ? 'कुल' : 'अभी का'} जोखिम स्कोर 12 में से ${score} है। ${recommended ? 'जांच के आधार पर पीएचसी रेफरल की सलाह है।' : 'अभी की जांच में रेफरल का संकेत नहीं है।'} क्या आप पीएचसी रेफरल शुरू करना चाहते हैं?`,
    hintEn: 'Say yes to prepare the referral, or no to keep screening only. Review and save the form to finish.',
    hintHi: 'रेफरल तैयार करने के लिए हाँ या केवल जांच के लिए नहीं कहें। फिर फॉर्म जांच कर सेव करें।',
    sampleResponses: ['Yes, initiate referral', 'No, screening only'],
  };
}

/** Ambiguous or conflicting speech must never initiate a referral. */
export function parseReferralDecision(answer: string): 'yes' | 'no' | undefined {
  const text = answer.trim().toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(no|no thanks|not now|later|do not refer|don't refer|do not initiate referral|no screening only|screening only|नहीं|अभी नहीं|केवल जांच)$/.test(text)) return 'no';
  if (/^(yes|yes please|yes initiate referral|initiate referral|start referral|refer to phc|yes refer to phc|हाँ|हां|जी हाँ|रेफरल शुरू करें)$/.test(text)) return 'yes';
  return undefined;
}

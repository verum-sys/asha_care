import type { CareTier } from '../db/types';
import type { Lang } from './index';

/**
 * ASHA and PHC work with community members; the word "patient" is used from the District Hospital (DH) and
 * Tertiary Care Centre (TCC) onwards, where people are undergoing treatment. Applied to every translated string.
 */
export const usesCommunityMember = (tier: CareTier | undefined) => !tier || tier === 'asha' || tier === 'phc';

const TITLE_CASE_WORDS = /\b[A-Z][a-z]+/g;

export function applyTerms(text: string, lang: Lang, tier: CareTier | undefined): string {
  if (!usesCommunityMember(tier)) return text;
  if (lang === 'hi') return text.replace(/मरीज़ों|मरीजों/g, 'समुदाय सदस्यों').replace(/मरीज़|मरीज/g, 'समुदाय सदस्य');
  // In a Title Case label ("Patient Full Name *") the noun is capitalised too: "Community Member Full Name *".
  const titleCase = (text.match(TITLE_CASE_WORDS) || []).length >= 3;
  return text.replace(/\b(patient)(s?)\b/gi, (_, word: string, plural: string) => {
    const member = titleCase || word === word.toUpperCase() && word.length > 1 ? 'Member' : 'member';
    const noun = `Community ${member}${plural.toLowerCase() ? 's' : ''}`;
    if (word === word.toUpperCase() && word.length > 1) return noun.toUpperCase();
    return word[0] === word[0].toUpperCase() ? noun : noun[0].toLowerCase() + noun.slice(1);
  });
}

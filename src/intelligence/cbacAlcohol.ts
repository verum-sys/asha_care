import type { AlcoholFrequency } from './cbacTypes';
export const ALCOHOL_OPTIONS: { value: AlcoholFrequency; label: string; score: number }[] = [
  { value: 'never', label: 'Never / no alcohol', score: 0 },
  { value: 'socially', label: 'Socially / occasionally', score: 0 },
  { value: 'weekly', label: 'Weekly / on weekends', score: 0 },
  { value: 'daily', label: 'Daily', score: 1 },
];
// CBAC asks about daily consumption: retain its existing binary scoring.
export const alcoholScoreFor = (frequency: AlcoholFrequency) => frequency === 'daily' ? 1 : 0;
export function parseAlcoholFrequency(answer: string): AlcoholFrequency | undefined {
  const text = answer.trim().toLowerCase().replace(/\bevery[\s-]*day\b/g, 'every day');
  const daily = /\b(?:daily|every day|each day|har din)\b|रोज|प्रतिदिन/.test(text);
  const notDaily = /\b(?:not|don.t|do not|never)\b.*\b(?:daily|every day)\b|रोज.*नहीं/.test(text);
  const social = /\b(?:social(?:ly)?|occasional(?:ly)?|sometimes|rarely|parties|at parties|kabhi kabhi)\b|कभी.?कभी|पार्टी/.test(text);
  const weekly = /\b(?:weekly|weekends?|a week|per week|every week|once a week|twice a week)\b|हफ्ते|सप्ताह/.test(text);
  if ((daily && !notDaily && (social || weekly)) || (social && weekly)) return undefined;
  if (/\b(?:not|never)\s+(?:social(?:ly)?|occasional(?:ly)?|weekly)\b/.test(text)) return undefined;
  if (social) return 'socially';
  if (weekly) return 'weekly';
  if (notDaily) return undefined; // Non-daily alone doesn't identify a frequency.
  if (/^(?:no|none|never)[.!]?$|\b(?:no alcohol|never drinks?|doesn.t drink|do not drink|don.t drink|sharab nahi|no liquor)\b|नहीं/.test(text)) return 'never';
  if (daily) return 'daily';
  return undefined;
}

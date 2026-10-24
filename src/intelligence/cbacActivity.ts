/** Normalize an answer to the weekly 150-minute activity question. */
export function activityMinutesPerWeek(answer: string): number | undefined {
  if (/\b(?:monthly|month|year|not|don.t|do not|never)\b/i.test(answer)) return undefined;
  let text = answer.toLowerCase().replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - '०'.charCodeAt(0)));
  text = text.replace(/two and (?:a )?half/g, '2.5').replace(/one and (?:a )?half/g, '1.5').replace(/half an hour/g, '0.5 hours').replace(/an hour/g, '1 hour');
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, zero: 0, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60 };
  if (/\bhundred\b/.test(text)) return undefined; // Let the language interpreter handle complex number words.
  text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|zero|ten|fifteen|twenty|thirty|forty|fortyfive|sixty)\b/g, word => String(words[word]));
  text = text.replace(/\b([2-9]0)\s+([1-9])\b/g, (_, tens, units) => String(Number(tens) + Number(units)));
  text = text.replace(/\b(\d+)\s+point\s+(\d+)\b/g, '$1.$2');
  if (/^\d+(?:\.\d+)?$/.test(text.trim())) { const value = Number(text); return value <= 10080 ? value : undefined; }
  const chunks = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|घंटे?|घण्टे?|मिनट)/g)];
  if (!chunks.length || /-\s*\d/.test(text)) return undefined;
  let minutes = chunks.reduce((sum, match) => sum + Number(match[1]) * (/hour|hr|घंट|घण्ट/.test(match[2]) ? 60 : 1), 0);
  const days = text.match(/([1-7])\s*days?\s*(?:(?:a|per|each|in a)\s*)?week/);
  if (days) minutes *= Number(days[1]);
  else if (/\b(?:daily|every[ -]?day|per day|a day)\b|रोज/.test(text)) minutes *= 7;
  return Number.isFinite(minutes) && minutes <= 10080 ? minutes : undefined;
}

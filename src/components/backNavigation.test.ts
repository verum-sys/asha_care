import { describe, expect, it } from 'vitest';
import { backDestination } from './backNavigation';
describe('back navigation', () => {
  it('returns to the actual previous in-app entry for any nested page', () => {
    expect(backDestination({ idx: 1 })).toBe(-1);
    expect(backDestination({ idx: 5 })).toBe(-1);
  });
  it.each([null, undefined, {}, { idx: 0 }, { idx: -1 }, { idx: '2' }, { idx: NaN }, { idx: 1.5 }])('falls back to the starting page for a direct entry: %j', state => {
    expect(backDestination(state)).toBe('/');
  });
});

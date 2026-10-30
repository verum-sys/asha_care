import { describe, expect, it } from 'vitest';
import { nextCareTier, tierFollowUpOptions } from './tierFollowUpOptions';
describe('care-stage follow-up options', () => {
  it.each(['asha', 'phc', 'dh', 'tcc'] as const)('offers only appointment rescheduling for %s', tier => {
    expect(tierFollowUpOptions(tier)).toEqual(['rescheduled']);
  });
  it('knows the next care tier', () => {
    expect(nextCareTier('phc')).toBe('dh');
    expect(nextCareTier('dh')).toBe('tcc');
    expect(nextCareTier('tcc')).toBeUndefined();
  });
});

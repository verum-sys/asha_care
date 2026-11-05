import { describe, expect, it } from 'vitest';
import { isPincode, phcsForPincode } from './phcDirectory';

describe('PIN code to PHC', () => {
  it('lists the PHCs for a known PIN code, PHC A first', () => {
    const { phcs, known } = phcsForPincode('835214');
    expect(known).toBe(true);
    expect(phcs.map(p => p.unit)).toEqual(['a', 'b', 'c']);
  });
  it('offers PHC A, B and C for a PIN code that is not listed, with A first', () => {
    const { phcs, known } = phcsForPincode('110001');
    expect(known).toBe(false);
    expect(phcs[0]).toEqual({ unit: 'a', name: 'PHC A' });
  });
  it('accepts only 6-digit Indian PIN codes', () => {
    expect(isPincode('835205')).toBe(true);
    expect(isPincode('035205')).toBe(false);
    expect(isPincode('83520')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { cbacReturnPath } from './cbacNavigation';
describe('CBAC return navigation', () => {
  it('returns to a module without a unit filter', () => {
    expect(cbacReturnPath('current', { returnTo: '/tier/phc' }, 'phc', null)).toBe('/tier/phc');
    expect(cbacReturnPath(undefined, null, 'phc', null)).toBe('/tier/phc');
  });
  it.each(['asha', 'phc', 'dh', 'tcc'])('returns to the original %s module and selected unit', tier => {
    const origin = `/tier/${tier}?unit=b`;
    expect(cbacReturnPath('current-patient', { returnTo: origin }, tier, 'b')).toBe(origin);
  });
  it('returns to the current patient when opened from their record', () => {
    expect(cbacReturnPath('current-patient', { returnTo: '/case/current-patient' }, 'phc', 'a')).toBe('/case/current-patient');
  });
  it('never returns to a different patient stored in navigation state', () => {
    expect(cbacReturnPath('current-patient', { returnTo: '/case/REF-0007' }, null, null)).toBe('/case/current-patient');
  });
  it('returns new assessments to their own module', () => {
    expect(cbacReturnPath(undefined, null, 'phc', 'c')).toBe('/tier/phc?unit=c');
  });
  it('uses a safe fallback for direct links', () => {
    expect(cbacReturnPath('current-patient', null, null, null)).toBe('/case/current-patient');
    expect(cbacReturnPath(undefined, { returnTo: 'https://example.com' }, null, null)).toBe('/');
  });
});

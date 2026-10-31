import { describe, expect, it } from 'vitest';
import { primaryCaseAction } from './caseActions';

describe('primaryCaseAction', () => {
  it('ASHA refers a case she holds', () => expect(primaryCaseAction({ viewTier: 'asha', holderTier: 'asha', attendance: 'unknown' })).toBe('refer'));
  it('records attendance first at PHC and DH', () => {
    expect(primaryCaseAction({ viewTier: 'phc', holderTier: 'phc', attendance: 'unknown' })).toBe('attendance');
    expect(primaryCaseAction({ viewTier: 'dh', holderTier: 'dh', attendance: 'not_attended' })).toBe('attendance');
  });
  it('refers on once the patient has attended', () => {
    expect(primaryCaseAction({ viewTier: 'phc', holderTier: 'phc', attendance: 'attended' })).toBe('refer');
    expect(primaryCaseAction({ viewTier: 'dh', holderTier: 'dh', attendance: 'attended' })).toBe('refer');
  });
  it('TCC records attendance, then follow-up (there is nowhere further to refer)', () => {
    expect(primaryCaseAction({ viewTier: 'tcc', holderTier: 'tcc', attendance: 'unknown' })).toBe('attendance');
    expect(primaryCaseAction({ viewTier: 'tcc', holderTier: 'tcc', attendance: 'attended' })).toBe('followUp');
  });
  it('a team that already handed the case on only follows up', () => {
    expect(primaryCaseAction({ viewTier: 'asha', holderTier: 'phc', attendance: 'unknown' })).toBe('followUp');
    expect(primaryCaseAction({ viewTier: 'phc', holderTier: 'tcc', attendance: 'attended' })).toBe('followUp');
  });
});

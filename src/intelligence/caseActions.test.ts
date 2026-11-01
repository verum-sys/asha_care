import { describe, expect, it } from 'vitest';
import { primaryCaseAction, referralBlockers } from './caseActions';

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

describe('referral requirements at PHC and DH', () => {
  it('needs attendance and the physical exam before referring on', () => {
    expect(referralBlockers({ tier: 'phc', attendance: 'unknown', hasExam: false })).toEqual(['attendance', 'exam']);
    expect(referralBlockers({ tier: 'dh', attendance: 'attended', hasExam: false })).toEqual(['exam']);
    expect(referralBlockers({ tier: 'phc', attendance: 'not_attended', hasExam: true })).toEqual(['attendance']);
    expect(referralBlockers({ tier: 'phc', attendance: 'attended', hasExam: true })).toEqual([]);
  });
  it('ASHA and TCC have no such step', () => {
    expect(referralBlockers({ tier: 'asha', attendance: 'unknown', hasExam: false })).toEqual([]);
    expect(referralBlockers({ tier: 'tcc', attendance: 'unknown', hasExam: false })).toEqual([]);
  });
  it('asks for the exam once the patient has attended', () => {
    expect(primaryCaseAction({ viewTier: 'phc', holderTier: 'phc', attendance: 'attended', hasExam: false })).toBe('exam');
    expect(primaryCaseAction({ viewTier: 'phc', holderTier: 'phc', attendance: 'attended', hasExam: true })).toBe('refer');
  });
});

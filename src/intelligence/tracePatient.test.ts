import { describe, expect, it } from 'vitest';
import { makePatient, makeReferral } from '../db/factory';
import type { CaseRecord } from '../db/repo';
import { traceMatches } from './tracePatient';

const rec = (id: string, name: string, phone: string | undefined, locality: string, updatedAt = '2026-11-01T10:00:00.000Z', patientId = `CL-${id}`): CaseRecord => ({
  patient: makePatient({ id: patientId, name, phone, locality }),
  referral: makeReferral({ id: `REF-${id}`, patientId, referralDate: '2026-11-01', updatedAt }),
  followUps: [], facilityEvents: [],
});

describe('tracing a walk-in to an existing record', () => {
  const cases = [rec('1', 'Sunita Devi', '9835012277', 'Bero Village'), rec('2', 'Sunita Devi', undefined, 'Itki Block'), rec('3', 'Kamla Bai', '+91 70041 28933', 'Mandar')];
  it('matches the same 10-digit phone, whatever the formatting', () => {
    expect(traceMatches(cases, { phone: '7004128933' }).map(c => c.patient.id)).toEqual(['CL-3']);
  });
  it('matches the same name in the same village, typed loosely', () => {
    expect(traceMatches(cases, { name: '  sunita  DEVI', locality: 'bero gaon' }).map(c => c.patient.id)).toEqual(['CL-1']);
  });
  it('never matches on a name alone or a partial phone number', () => {
    expect(traceMatches(cases, { name: 'Sunita Devi' })).toEqual([]);
    expect(traceMatches(cases, { name: 'Sunita Devi', locality: 'village' })).toEqual([]);
    expect(traceMatches(cases, { phone: '98350' })).toEqual([]);
  });
  it('lists each person once, with their latest case', () => {
    const twice = [...cases, rec('4', 'Sunita Devi', '9835012277', 'Bero Village', '2026-11-03T10:00:00.000Z', 'CL-1')];
    const found = traceMatches(twice, { phone: '9835012277' });
    expect(found).toHaveLength(1);
    expect(found[0].referral.id).toBe('REF-4');
  });
});

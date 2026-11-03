import { describe, expect, it } from 'vitest';
import { makePatient, makeReferral } from '../db/factory';
import type { CaseRecord } from '../db/repo';
import { buildReport, stageAt } from './caseReport';
import { buildXlsx } from './xlsx';

const cbac = {
  general: { date: '2026-11-01', ashaName: 'Asha Devi', mpwAnmName: '', villageWard: 'Bero', subCentre: 'SC Bero', phcUphc: 'PHC Itki', name: 'Mary', age: 45, sex: 'F', address: '', identifierType: 'Aadhaar', identifierNumber: '1234 5678 9012', hasStateInsurance: false, insuranceDetails: '', phone: '', phoneOwner: 'self', hasDisability: false, disabilityDetails: '' },
  partA: { totalScore: 6, smokeScore: 2 }, partB: { symptoms: { mouth_ulcers_unhealed: true, cloudy_vision: false } }, partC: { cookingFuel: ['firewood'], occupationalExposure: [] }, partD: { totalScore: 1 },
  highRiskNcd: true, symptomAlert: true, tbSuspectAlert: false, tbContactAlert: false, mentalHealthAlert: false, completedAt: '2026-11-01T10:00:00.000Z',
} as const;

/** Screened by ASHA, examined at PHC, now at DH with a DH exam and biopsy. */
function journey(): CaseRecord {
  const referral = makeReferral({
    id: 'REF-1', patientId: 'CL-1', referralDate: '2026-11-01', tier: 'dh', unit: 'a', urgency: 'soon', reason: 'Oral ulcer',
    screening: { completed: true, referralRequired: 'yes', cbac: cbac as never },
    worker: { appointmentDate: '2026-11-10' },
    physicalExam: { oralCavityFindings: 'DH: indurated ulcer 2 cm' },
    dhNotes: 'DH specialist: biopsy advised',
    biopsyReports: [{ id: 'b1', title: 'Biopsy', fileName: 'b.pdf', fileSize: '1 MB', fileType: 'pdf', category: 'biopsy', uploadedAt: '2026-11-03T09:00:00.000Z', uploadedBy: 'DH', tier: 'dh' }],
    reports: [{ id: 'l1', title: 'CBC', fileName: 'cbc.pdf', fileSize: '1 MB', fileType: 'pdf', category: 'general', uploadedAt: '2026-11-02T09:00:00.000Z', uploadedBy: 'PHC', tier: 'phc' }],
    clinicalHandovers: [
      { fromTier: 'asha', toTier: 'phc', at: '2026-11-01T12:00:00.000Z', visitStatus: {} },
      { fromTier: 'phc', toTier: 'dh', at: '2026-11-02T12:00:00.000Z', physicalExam: { oralCavityFindings: 'PHC: white patch' }, visitStatus: { attendance: 'attended', attendedDate: '2026-11-02' } },
    ],
    createdAt: '2026-11-01T09:00:00.000Z',
  });
  return {
    patient: makePatient({ id: 'CL-1', name: 'Mary', age: 45, sex: 'F' }), referral,
    followUps: [
      { id: 'f1', referralId: 'REF-1', at: '2026-11-01T11:00:00.000Z', action: 'contacted_patient', note: 'ASHA call', syncStatus: 'synced' },
      { id: 'f2', referralId: 'REF-1', at: '2026-11-02T10:00:00.000Z', action: 'other', note: 'PHC visit', syncStatus: 'synced' },
      { id: 'f3', referralId: 'REF-1', at: '2026-11-03T10:00:00.000Z', action: 'other', note: 'DH visit', syncStatus: 'synced' },
    ],
    facilityEvents: [],
  };
}

const text = (sheets: ReturnType<typeof buildReport>) => JSON.stringify(sheets);

describe('case reports', () => {
  it('takes a tier\'s stage from its handover once the case has moved on', () => {
    const c = journey();
    expect(stageAt(c, 'phc')?.exam?.oralCavityFindings).toBe('PHC: white patch');
    expect(stageAt(c, 'dh')?.exam?.oralCavityFindings).toBe('DH: indurated ulcer 2 cm');
    expect(stageAt(c, 'tcc')).toBeUndefined();
  });

  it('gives PHC only its own stage, timeline and reports', () => {
    const out = text(buildReport([journey()], 'phc'));
    expect(out).toContain('PHC: white patch');
    expect(out).toContain('PHC visit');
    expect(out).toContain('CBC');
    expect(out).not.toContain('DH: indurated ulcer');
    expect(out).not.toContain('DH specialist');
    expect(out).not.toContain('DH visit');
    expect(out).not.toContain('Biopsy');
  });

  it('leaves the CBAC screening out of DH and TCC reports', () => {
    expect(buildReport([journey()], 'dh').map(s => s.name)).not.toContain('CBAC screening');
    expect(buildReport([journey()], 'phc').map(s => s.name)).toContain('CBAC screening');
  });

  it('gives the program report every stage and never an identity number', () => {
    const sheets = buildReport([journey()], 'all');
    expect(sheets.map(s => s.name)).toEqual(['Overview', 'Stages (all tiers)', 'CBAC screening', 'Timeline', 'Reports']);
    expect(sheets[1].rows).toHaveLength(4); // header + ASHA, PHC, DH
    const out = text(sheets);
    expect(out).toContain('ASHA > PHC > DH');
    expect(out).toContain('Any ulcers in mouth that has not healed in two weeks');
    expect(out).not.toContain('1234 5678 9012');
    expect(buildXlsx(sheets).length).toBeGreaterThan(1000);
  });
});

describe('program analytics', () => {
  it('counts how far patients got, attendance per level and closed loops', async () => {
    const { computeAnalytics } = await import('./analytics');
    const closed = journey();
    closed.referral = { ...closed.referral, id: 'REF-2', tier: 'tcc', unit: 'b', clinicalHandovers: [...closed.referral.clinicalHandovers!, { fromTier: 'dh', toTier: 'tcc', at: '2026-11-03T12:00:00.000Z', visitStatus: { attendance: 'attended' } }], ashaFollowUpDate: '2026-12-01', worker: { attendance: 'attended' }, createdAt: '2026-11-03T09:00:00.000Z' };
    const a = computeAnalytics([journey(), closed], 'all', '2026-11-04');
    expect(a.total).toBe(2);
    expect(a.reached).toEqual({ asha: 2, phc: 2, dh: 2, tcc: 1 });
    expect(a.current).toEqual({ asha: 0, phc: 0, dh: 1, tcc: 1 });
    expect(a.attendance.phc.attended).toBe(2);
    expect(a.attendance.tcc.attended).toBe(1);
    expect(a.loopsClosed).toBe(1);
    expect(a.highRisk).toBe(2);
    expect(a.riskScores[6]).toBe(2);
    expect(a.weekly.at(-1)?.count).toBe(2);
    expect(computeAnalytics([journey(), closed], 'b', '2026-11-04').total).toBe(1);
  });
});

describe('patient report', () => {
  it('gives a summary sheet plus details, limited to the tier looking at it', async () => {
    const { buildPatientReport } = await import('./caseReport');
    const phc = buildPatientReport(journey(), 'phc');
    expect(phc.map(s => s.name)).toEqual(['Patient summary', 'PHC cases', 'CBAC screening', 'Timeline', 'Reports']);
    const out = JSON.stringify(phc);
    expect(out).toContain('PHC: white patch');
    expect(out).toContain('PHC only');
    expect(out).not.toContain('DH: indurated');
    const all = JSON.stringify(buildPatientReport(journey(), 'all'));
    expect(all).toContain('DH: indurated');
    expect(all).toContain('ASHA > PHC > DH');
    expect(all).not.toContain('1234 5678 9012');
  });
});

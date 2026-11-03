import { describe, expect, it } from 'vitest';
import { buildDemoScenarios, DEMO_NAMES } from './demoCases';
import { stageAt, tiersVisited } from '../export/caseReport';
import { actionLocks, referralBlockers } from '../intelligence/caseActions';
import { reportFileBlob } from '../intelligence/reportFile';

const today = '2026-11-04';
const built = buildDemoScenarios(today, 'a').map((make, i) => make({ patientId: `CL-D${i}`, referralId: `REF-D${i}` }));
const record = (i: number) => ({ ...built[i], facilityEvents: [] });

describe('demo scenarios at TCC', () => {
  it('has the three scenarios, all at TCC with the visit today, names marked as demo', () => {
    expect(built.map(b => b.patient.name)).toEqual([...DEMO_NAMES]);
    for (const b of built) {
      expect(b.referral.tier).toBe('tcc');
      expect(b.referral.worker.appointmentDate).toBe(today);
      expect(b.patient.name).toMatch(/\(demo\)$/);
      // TCC can record attendance today: nothing is locked.
      expect(actionLocks({ viewTier: 'tcc', holderTier: 'tcc', appointmentDate: today, today, referred: true }).attendance).toBeUndefined();
    }
  });
  it('detected early: screened, through PHC and DH, early biopsy result', () => {
    const c = record(0);
    expect(tiersVisited(c)).toEqual(['asha', 'phc', 'dh', 'tcc']);
    expect(c.referral.screening?.cbac?.partA.totalScore).toBe(6);
    expect(stageAt(c, 'phc')?.visit.attendance).toBe('attended');
    expect(c.referral.biopsyReports?.[0].findings).toContain('No invasive carcinoma');
  });
  it('detected late: two missed PHC visits before reaching care, advanced disease', () => {
    const c = record(1);
    expect(c.followUps.filter(f => f.action === 'patient_not_attended')).toHaveLength(2);
    expect(c.referral.radiologyReports).toHaveLength(1);
    expect(c.referral.dhNotes).toContain('T3 N1');
  });
  it('missed early: walked into TCC, no screening, nothing before TCC', () => {
    const c = record(2);
    expect(tiersVisited(c)).toEqual(['tcc']);
    expect(c.referral.screening).toBeUndefined();
    expect(c.referral.referringWorker.startsWith('Walk-in')).toBe(true);
    expect(referralBlockers({ tier: 'tcc', attendance: 'unknown', hasExam: false })).toEqual([]);
  });
  it('attaches real PDF files to the demo reports', async () => {
    const blob = await reportFileBlob(built[0].referral.biopsyReports![0]);
    const text = new TextDecoder().decode(new Uint8Array(await blob!.arrayBuffer()));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('moderate epithelial dysplasia');
  });
});

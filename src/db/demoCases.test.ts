import { describe, expect, it } from 'vitest';
import { buildDemoScenarios, DEMO_NAMES, DEMO_VERSION, isDemoCase } from './demoCases';
import { tiersVisited } from '../export/caseReport';
import { isDirectAt } from '../intelligence/pathway';
import { reportFileBlob } from '../intelligence/reportFile';

const today = '2026-11-05';
const built = buildDemoScenarios(today, 'a').map((make, i) => make({ patientId: `CL-D${i}`, referralId: `REF-D${i}` }));
const record = (i: number) => ({ ...built[i], facilityEvents: [] });

describe('demo cases for the video', () => {
  it('has two clean cases at TCC with the visit today and no demo labels on screen', () => {
    expect(built.map(b => b.patient.name)).toEqual([...DEMO_NAMES]);
    for (const b of built) {
      expect(b.referral.tier).toBe('tcc');
      expect(b.referral.worker.appointmentDate).toBe(today);
      expect(b.patient.name).not.toMatch(/demo/i);
      expect(b.referral.demo).toBe(DEMO_VERSION);
    }
  });
  it('the referral came the ideal path with structured handovers, dated vitals and reviewed report values', () => {
    const c = record(0);
    expect(tiersVisited(c)).toEqual(['asha', 'phc', 'dh', 'tcc']);
    expect(isDirectAt(c.referral, 'tcc')).toBe(false);
    expect(c.referral.vitalsLog?.map(v => v.tier)).toEqual(['phc', 'dh']);
    const dh = c.referral.clinicalHandovers!.find(h => h.fromTier === 'dh')!;
    expect(dh.structuredSummary?.reports.map(r => r.category)).toEqual(['general', 'biopsy', 'radiology']);
    const phc = c.referral.clinicalHandovers!.find(h => h.fromTier === 'phc')!;
    expect(phc.structuredSummary?.reports.map(r => r.category)).toEqual(['general']);
    expect(c.referral.biopsyReports?.[0].aiFields?.['Depth of invasion']).toBe('2 mm');
  });
  it('the direct patient walked into TCC, is mapped to her PHC, and has no attendance step', () => {
    const c = record(1);
    expect(tiersVisited(c)).toEqual(['tcc']);
    expect(isDirectAt(c.referral, 'tcc')).toBe(true);
    expect(c.referral.mappedPhc).toBe('PHC Mandar');
    expect(c.patient.pincode).toBe('835214');
  });
  it('recognises old and current demo cases so they can be replaced', () => {
    expect(isDemoCase({ patient: { name: 'Meena Devi (demo)' }, referral: { referringWorker: 'ASHA' } })).toBe(true);
    expect(isDemoCase({ patient: { name: 'X' }, referral: { referringWorker: 'ASHA (demo scenario)' } })).toBe(true);
    expect(isDemoCase({ patient: { name: 'X' }, referral: { referringWorker: 'ASHA', demo: 'v2' } })).toBe(true);
    expect(isDemoCase({ patient: { name: 'Real Person' }, referral: { referringWorker: 'ASHA-1001' } })).toBe(false);
  });
  it('attaches real PDFs with clean report text', async () => {
    const blob = await reportFileBlob(built[0].referral.biopsyReports![0]);
    const text = new TextDecoder().decode(new Uint8Array(await blob!.arrayBuffer()));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Depth of invasion: 2 mm');
    expect(text).not.toMatch(/synthetic|demo/i);
  });
});

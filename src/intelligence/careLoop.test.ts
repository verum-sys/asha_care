import { describe, expect, it } from 'vitest';
import { reportFindingsText } from '../components/TierReferralModal';
import { ashaAppointment, ashaNoteLines } from './ashaNote';
import type { ReportAttachment } from '../db/types';

const report = (category: ReportAttachment['category'], title: string, findings?: string) =>
  ({ id: title, title, category, findings, fileName: '', fileSize: '', fileType: 'application/pdf', uploadedAt: '', uploadedBy: '' }) as ReportAttachment;
const reports = [report('general', 'CBC', 'Hb 8.2 low; WBC 14,000 high'), report('biopsy', 'Oral biopsy', 'Squamous cell carcinoma'), report('radiology', 'Chest X-ray')];

describe('referral summary report findings', () => {
  it('PHC hands over its lab (CBC) findings only', () => {
    expect(reportFindingsText('phc', reports)).toBe('Lab report – CBC: Hb 8.2 low; WBC 14,000 high');
  });
  it('DH also hands over biopsy and radiology, noting a PDF without findings', () => {
    const text = reportFindingsText('dh', reports);
    expect(text).toContain('Biopsy report – Oral biopsy: Squamous cell carcinoma');
    expect(text).toContain('Radiology report – Chest X-ray: PDF attached, no findings entered.');
  });
  it('ASHA and TCC add no report findings', () => {
    expect(reportFindingsText('asha', reports)).toBe('');
    expect(reportFindingsText('tcc', reports)).toBe('');
  });
});

describe('TCC closes the loop back to ASHA', () => {
  const t = (key: string, params?: Record<string, string | number>) => key.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? ''));
  const record = (extra: object) => ({
    patient: { name: 'Sunita' },
    referral: { referralDate: '2026-10-20', destinationFacility: 'PHC Itki', worker: { appointmentDate: '2026-11-02' }, facility: {}, screening: { referralRequired: 'yes', cbac: { partA: { totalScore: 5 }, partD: { totalScore: 1 } } }, ...extra },
    followUps: [],
  }) as never;
  it('ASHA follows the date TCC sent back, and sees only that', () => {
    const r = record({ ashaFollowUpDate: '2026-12-01' });
    expect(ashaAppointment((r as { referral: never }).referral)).toBe('2026-12-01');
    const lines = ashaNoteLines(r, t, d => d);
    expect(lines.at(-1)).toBe('Next follow-up from TCC on 2026-12-01.');
    expect(lines.join(' ')).not.toContain('PHC Itki');
  });
  it('before the loop closes ASHA follows the current appointment', () => {
    expect(ashaNoteLines(record({}), t, d => d).join(' ')).toContain('Will go to PHC Itki on 2026-11-02.');
  });
});

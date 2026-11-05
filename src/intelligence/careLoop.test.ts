import { describe, expect, it } from 'vitest';
import { buildStructuredSummary } from './structuredSummary';
import { ashaAppointment, ashaNoteLines } from './ashaNote';
import type { ReportAttachment } from '../db/types';

const report = (category: ReportAttachment['category'], title: string, findings?: string) =>
  ({ id: title, title, category, findings, fileName: '', fileSize: '', fileType: 'application/pdf', uploadedAt: '', uploadedBy: '' }) as ReportAttachment;
const reports = [report('general', 'CBC', 'Hb 8.2 low; WBC 14,000 high'), report('biopsy', 'Oral biopsy', 'Squamous cell carcinoma'), report('radiology', 'Chest X-ray')];

describe('structured handover: which reports each tier passes on', () => {
  const split = { reports: reports.filter(r => r.category === 'general'), biopsyReports: reports.filter(r => r.category === 'biopsy'), radiologyReports: reports.filter(r => r.category === 'radiology') };
  it('PHC passes its lab (CBC) report only, with its findings', () => {
    const s = buildStructuredSummary(split, 'phc');
    expect(s.reports.map(r => r.title)).toEqual(['CBC']);
    expect(s.reports[0].findings).toBe('Hb 8.2 low; WBC 14,000 high');
  });
  it('DH passes lab, biopsy and radiology, including a PDF with no findings', () => {
    const s = buildStructuredSummary(split, 'dh');
    expect(s.reports.map(r => r.title)).toEqual(['CBC', 'Oral biopsy', 'Chest X-ray']);
    expect(s.reports[2].findings).toBeUndefined();
  });
  it('ASHA and TCC pass no reports on (TCC treats and passes nothing on)', () => {
    expect(buildStructuredSummary(split, 'asha').reports).toEqual([]);
    expect(buildStructuredSummary(split, 'tcc').reports).toEqual([]);
  });
  it('lists the examination values and findings', () => {
    const s = buildStructuredSummary({ physicalExam: { bpSystolic: 130, bpDiastolic: 85, pulseRate: 80, oralCavityFindings: 'Ulcer 2 cm', recordedAt: '2026-11-04T10:00:00Z' } }, 'phc');
    expect(s.exam).toEqual([{ label: 'BP', value: '130/85 mmHg' }, { label: 'Pulse', value: '80 bpm' }, { label: 'Oral cavity', value: 'Ulcer 2 cm' }]);
    expect(s.vitalsAt).toBe('2026-11-04T10:00:00Z');
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

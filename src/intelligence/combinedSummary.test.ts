import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { combineReports } from './combinedSummary';
import { CombinedReportSummary } from '../components/CombinedReportSummary';
import type { ReportAttachment } from '../db/types';

const base = { fileName: 'x.pdf', fileSize: '', fileType: 'application/pdf', uploadedAt: '', uploadedBy: '' };
const lab: ReportAttachment = { ...base, id: 'l', category: 'general', title: 'CBC', aiFields: { 'Report type': 'CBC', 'Abnormal results': 'Hb 10.6 g/dL (low)', Comment: 'Not stated' }, aiTests: [{ name: 'Hb', value: '10.6', unit: 'g/dL', flag: 'low' }, { name: 'WBC', value: '7000', flag: 'normal' }], aiPlain: 'Mild anaemia.' };
const biopsy: ReportAttachment = { ...base, id: 'b', category: 'biopsy', title: 'Biopsy', aiFields: { Site: 'Left buccal mucosa', 'Depth of invasion': '2 mm', Margins: 'Not stated' }, aiPlain: 'Early cancer in the cheek.' };
const radiology: ReportAttachment = { ...base, id: 'r', category: 'radiology', title: 'CT' };

describe('summary of all reports', () => {
  it('puts biopsy values first, skips "Not stated", lists out-of-range tests and reports still to read', () => {
    const s = combineReports([lab, radiology, biopsy]);
    expect(s.rows.map(r => r.label)).toEqual(['Site', 'Depth of invasion', 'Abnormal results']);
    expect(s.flagged.map(x => x.name)).toEqual(['Hb']);
    expect(s.plain.map(p => p.text)).toEqual(['Early cancer in the cheek.', 'Mild anaemia.']);
    expect(s.missing.map(r => r.id)).toEqual(['r']);
  });
  it('shows the combined table and offers to summarise the remaining reports', () => {
    const html = renderToStaticMarkup(createElement(CombinedReportSummary, { referralId: 'x', reports: [lab, radiology, biopsy], patient: { name: 'A', phone: '', id: 'p' } }));
    expect(html).toContain('Summary of all reports');
    expect(html).toContain('2 mm');
    expect(html).toContain('Summarise the remaining reports');
    expect(html).toContain('2 of 3 reports summarised');
  });
  it('offers Summarise all reports when none is summarised, and nothing when there are no reports', () => {
    const plain = [{ ...radiology }, { ...lab, aiFields: undefined }];
    expect(renderToStaticMarkup(createElement(CombinedReportSummary, { referralId: 'x', reports: plain, patient: { name: 'A', phone: '', id: 'p' } }))).toContain('Summarise all reports');
    expect(renderToStaticMarkup(createElement(CombinedReportSummary, { referralId: 'x', reports: [], patient: { name: 'A', phone: '', id: 'p' } }))).toBe('');
  });
});

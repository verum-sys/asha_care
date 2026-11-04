import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TierReferralModal } from './TierReferralModal';

const render = (props: object = {}) => renderToStaticMarkup(<TierReferralModal referralId="r" patientName="Sunita" currentTier="phc" isOpen onClose={() => {}} {...props} />);

describe('referral handover notes', () => {
  it('sends the examination as a structured overview, not as text in the notes', () => {
    const html = render({ physicalExam: { bpSystolic: 138, bpDiastolic: 88, systemicExam: 'Chest clear' } });
    expect(html).toContain('data-testid="handover-preview"');
    expect(html).toContain('138/88 mmHg');
    expect(html).toContain('Chest clear');
    expect(html).not.toMatch(/<textarea[^>]*>[^<]*Chest clear/);
  });
  it('keeps a typed note in the notes box', () => {
    expect(render({ initialNotes: 'Patient reports night sweats' })).toMatch(/<textarea[^>]*>Patient reports night sweats/);
  });
  it('passes PHC lab reports with their structured values; DH passes biopsy and radiology too', () => {
    const reports = [
      { id: 'l', category: 'general', title: 'CBC', fileName: 'c.pdf', fileSize: '', fileType: 'application/pdf', uploadedAt: '', uploadedBy: '', aiFields: { 'Abnormal results': 'Hb 10.6 g/dL (low)' } },
      { id: 'b', category: 'biopsy', title: 'Biopsy', fileName: 'b.pdf', fileSize: '', fileType: 'application/pdf', uploadedAt: '', uploadedBy: '', aiPlain: 'The biopsy found cancer in the cheek.' },
    ];
    const phc = render({ currentTier: 'phc', reports });
    expect(phc).toContain('Hb 10.6 g/dL (low)');
    expect(phc).not.toContain('The biopsy found cancer');
    expect(render({ currentTier: 'dh', reports })).toContain('The biopsy found cancer in the cheek.');
  });
  it('says so when nothing was recorded', () => {
    expect(render()).toContain('No examination or reports recorded yet.');
  });
  it('starts urgency on Please select', () => {
    expect(render()).toContain('<option value="" selected="">Please select</option>');
  });
  it('offers Generate AI summary and Edit for the handover notes only when referring from ASHA', () => {
    const asha = render({ currentTier: 'asha', aiSummary: 'Generated text' });
    expect(asha).toContain('Generate AI summary');
    expect(asha).toContain('id="referral-notes"');
    expect(asha).not.toMatch(/<textarea[^>]*>Generated text/); // only filled when the worker taps Generate
    for (const currentTier of ['phc', 'dh']) expect(render({ currentTier, aiSummary: 'Generated text' })).not.toContain('Generate AI summary');
  });
});


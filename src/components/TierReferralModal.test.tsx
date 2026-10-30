import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TierReferralModal } from './TierReferralModal';

const render = (props: object = {}) => renderToStaticMarkup(<TierReferralModal referralId="r" patientName="Sunita" currentTier="phc" isOpen onClose={() => {}} {...props} />);

describe('referral handover notes', () => {
  it('pre-fills the recorded physical examination', () => {
    const html = render({ physicalExam: { bpSystolic: 138, bpDiastolic: 88, systemicExam: 'Chest clear' } });
    expect(html).toContain('Physical examination: BP 138/88 mmHg');
    expect(html).toContain('Systemic: Chest clear');
  });
  it('keeps a typed note first and does not duplicate the examination', () => {
    const exam = { pulseRate: 80 };
    const html = render({ initialNotes: 'Patient reports night sweats', physicalExam: exam });
    expect(html.indexOf('Patient reports night sweats')).toBeLessThan(html.indexOf('Physical examination: Pulse 80 bpm'));
    const twice = render({ initialNotes: 'Physical examination: Pulse 80 bpm', physicalExam: exam });
    expect(twice.match(/Physical examination: Pulse 80 bpm/g)).toHaveLength(1);
  });
  it('leaves the box empty when no examination was recorded', () => {
    expect(render()).not.toContain('Physical examination:');
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


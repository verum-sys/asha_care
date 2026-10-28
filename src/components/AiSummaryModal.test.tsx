import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiSummaryModal } from './AiSummaryModal';
import { ClinicalHandovers } from './ClinicalHandovers';
import { makePatient, makeReferral } from '../db/factory';
describe('editable summary and handover display', () => {
  it('opens the saved edited summary rather than replacing it with a generated draft', () => {
    const record = { patient: makePatient({ id: 'p', name: 'Current patient' }), referral: makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-25', aiSummaryOverride: 'Edited PHC handover' }), followUps: [], facilityEvents: [] };
    const html = renderToStaticMarkup(<AiSummaryModal caseRecord={record} isOpen onClose={() => {}} />);
    expect(html).toContain('textarea');
    expect(html).toContain('Edited PHC handover');
    expect(html).toContain('Save summary');
    expect(html).not.toContain('readOnly');
  });
  it('shows prior-stage notes to the receiving team, and the AI summary at the ASHA stage', () => {
    const html = renderToStaticMarkup(<ClinicalHandovers handovers={[{ fromTier: 'asha', toTier: 'dh', at: '2026-10-25T00:00:00Z', notes: 'PHC notes passed forward', physicalExam: { generalFindings: 'PHC exam finding' }, aiSummary: 'Reviewed summary' }]} />);
    expect(html).toContain('PHC notes passed forward');
    expect(html).toContain('PHC exam finding');
    expect(html).toContain('Reviewed summary');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisitStatusModal } from './VisitStatusModal';
import { ReportAttachmentModal } from './ReportAttachmentModal';
import { makeReferral } from '../db/factory';
describe('editable saved forms', () => {
  it('records attendance only, showing the appointment from the referral without editing it', () => {
    const referral = makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', worker: { appointmentDate: '2026-10-20', attendance: 'not_attended', facilityResponse: 'accepted' } });
    const html = renderToStaticMarkup(<VisitStatusModal referral={referral} onClose={() => {}} />);
    expect(html).toContain('Attendance');
    expect(html).toContain('Attended');
    expect(html).toContain('Missed appointment');
    expect(html).toContain('Not yet recorded');
    expect(html).toMatch(/aria-checked="true"[^>]*>✓ <!-- -->Missed appointment|aria-checked="true"[^>]*>✓ Missed appointment/);
    expect(html).toContain('Appointment date');
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('Acceptance');
    expect(html).not.toContain('value="accepted"');
    expect(html).toContain('Save attendance');
  });
  it('loads existing report details for editing and enables save without reuploading', () => {
    const attachment = { id: 'report', title: 'Existing report', findings: 'Existing findings', fileName: 'old.pdf', fileSize: '1 MB', fileType: 'application/pdf', category: 'general' as const, uploadedAt: '2026-10-25', uploadedBy: 'Worker', fileUrl: '/old.pdf' };
    const html = renderToStaticMarkup(<ReportAttachmentModal referralId="r" category="general" initialAttachment={attachment} isOpen onClose={() => {}} />);
    expect(html).toContain('Existing report');
    expect(html).toContain('Existing findings');
    expect(html).not.toContain('disabled=""');
  });
});

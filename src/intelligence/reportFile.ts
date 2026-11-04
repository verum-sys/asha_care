import type { ReportAttachment } from '../db/types';

/** The uploaded file behind a report, or null when only typed findings were saved (older demo records). */
export async function reportFileBlob(report: Pick<ReportAttachment, 'dataUrl' | 'fileUrl' | 'fileType'>): Promise<Blob | null> {
  if (report.dataUrl?.startsWith('data:')) {
    const comma = report.dataUrl.indexOf(',');
    const header = report.dataUrl.slice(5, comma);
    const type = header.split(';')[0] || report.fileType || 'application/pdf';
    const payload = report.dataUrl.slice(comma + 1);
    if (header.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type });
    }
    return new Blob([decodeURIComponent(payload)], { type });
  }
  if (report.fileUrl && /^(https?:|blob:)/.test(report.fileUrl)) {
    const response = await fetch(report.fileUrl);
    if (!response.ok) throw new Error('Report file unavailable');
    return response.blob();
  }
  return null;
}

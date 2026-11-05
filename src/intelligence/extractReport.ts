import type { LabTest, Patient, ReportAttachment, ReportFields } from '../db/types';
import { readReportText, redactPatient } from './reportText';
import { cleanFields, cleanTests, fieldsText } from './reportFields';

const MAX_CHARS = 11500;
export type ReadStage = { stage: 'opening' | 'reading' | 'ocr' | 'ai'; page?: number; pages?: number; percent?: number };
export interface ExtractedReport { fields: ReportFields; tests: LabTest[]; plain: string; source: 'text' | 'ocr'; text: string }

/**
 * Reads one report on this device (OCR for scanned pages) and asks the AI to fill its fixed fields. Only the report
 * text, without the patient's name, phone or ID, leaves the device.
 */
export async function extractReport(report: ReportAttachment, patient: Pick<Patient, 'name' | 'phone' | 'id'>, token: string, onStage?: (s: ReadStage) => void): Promise<ExtractedReport> {
  const read = await readReportText(report, (stage, d) => onStage?.({ stage: stage === 'ocr' ? 'ocr' : stage === 'reading' ? 'reading' : 'opening', ...d }));
  const text = redactPatient(read.text, patient);
  if (text.replace(/\s/g, '').length < 20) throw new Error('No readable text was found in this report.');
  onStage?.({ stage: 'ai' });
  const response = await fetch('/api/interpret-answer', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'report-summary', kind: report.category, context: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[report text cut here]` : text }),
    signal: AbortSignal.timeout(35000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.fields) throw new Error(data.error || 'Structured report unavailable. Please retry.');
  return { fields: cleanFields(report.category, data.fields), tests: cleanTests(data.tests), plain: typeof data.plain === 'string' ? data.plain.trim() : '', source: read.source, text: read.text };
}

/** The report with its structured values saved on it. */
export function withExtraction(report: ReportAttachment, x: Pick<ExtractedReport, 'fields' | 'tests' | 'plain' | 'source'>): ReportAttachment {
  return { ...report, aiFields: x.fields, aiTests: x.tests, aiPlain: x.plain || undefined, aiSummary: fieldsText(x.fields, x.tests), aiSummaryAt: new Date().toISOString(), aiSummarySource: x.source };
}

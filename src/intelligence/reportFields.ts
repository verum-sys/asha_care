import type { LabTest, ReportAttachment, ReportFields } from '../db/types';

/**
 * The fixed fields read from each kind of report, in display order. The structured report is these fields filled
 * with the report's own values ("Not stated" when the report does not say), never free text.
 */
export const REPORT_FIELDS: Record<ReportAttachment['category'], string[]> = {
  biopsy: ['Site', 'Specimen', 'Diagnosis (as written)', 'Differentiation / grade', 'Depth of invasion', 'Perineural invasion', 'Lymphovascular invasion', 'Margins', 'Other points'],
  radiology: ['Study', 'Lesion site', 'Lesion size', 'Extension', 'Bone involvement', 'Lymph nodes', 'Impression (as written)', 'Other points'],
  general: ['Report type', 'Abnormal results', 'Comment'],
};

export const NOT_STATED = 'Not stated';

/** Keeps only the known fields, as short strings, with "Not stated" for anything missing. */
export function cleanFields(kind: ReportAttachment['category'], raw: unknown): ReportFields {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const out: ReportFields = {};
  for (const field of REPORT_FIELDS[kind]) {
    const value = source[field];
    out[field] = typeof value === 'string' && value.trim() ? value.trim().slice(0, 400) : NOT_STATED;
  }
  return out;
}

export function cleanTests(raw: unknown): LabTest[] {
  if (!Array.isArray(raw)) return [];
  const flags = ['high', 'low', 'abnormal', 'normal'] as const;
  return raw.slice(0, 40).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const t = item as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, 80) : '');
    if (!s(t.name) || !s(t.value)) return [];
    const flag = flags.find(f => f === String(t.flag ?? '').toLowerCase()) ?? '';
    return [{ name: s(t.name), value: s(t.value), unit: s(t.unit) || undefined, range: s(t.range) || undefined, flag }];
  });
}

/** The structured report as plain text lines (for exports and older screens). */
export function fieldsText(fields?: ReportFields, tests?: LabTest[]): string {
  const lines = Object.entries(fields ?? {}).filter(([, v]) => v && v !== NOT_STATED).map(([k, v]) => `${k}: ${v}`);
  for (const t of tests ?? []) lines.push(`${t.name}: ${t.value}${t.unit ? ` ${t.unit}` : ''}${t.range ? ` (range ${t.range})` : ''}${t.flag && t.flag !== 'normal' ? ` [${t.flag}]` : ''}`);
  return lines.join('\n');
}

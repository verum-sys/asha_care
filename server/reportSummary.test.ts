import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportSummaryMessages, summariseReport } from './reportSummary';
afterEach(() => vi.unstubAllGlobals());
const reply = (content: unknown) => vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) }));
describe('structured reports', () => {
  it('asks for fixed fields per report type, values only, nothing guessed, no advice or identifiers', () => {
    const [system, user] = reportSummaryMessages('Impression: SCC', 'biopsy');
    expect(system.content).toContain('"Depth of invasion"');
    expect(system.content).toContain('"Perineural invasion"');
    expect(system.content).toContain('never add, guess or infer');
    expect(system.content).toContain('Not stated');
    expect(system.content).toContain('No treatment advice');
    expect(system.content).toContain('No patient names');
    expect(system.content).toContain('untrusted data');
    expect(user.content).toBe('Impression: SCC');
    expect(reportSummaryMessages('x', 'radiology')[0].content).toContain('"Lymph nodes"');
    expect(reportSummaryMessages('x', 'general')[0].content).toContain('List every test result');
  });
  it('keeps only the known fields, fills gaps with Not stated, and drops tests for non-lab reports', async () => {
    vi.stubGlobal('fetch', reply({ fields: { 'Diagnosis (as written)': 'Squamous cell carcinoma', 'Depth of invasion': '6 mm', 'Made up field': 'x' }, tests: [{ name: 'Hb', value: '10' }], plain: 'The biopsy found cancer.' }));
    const r = await summariseReport('Impression: SCC', 'biopsy', 'k', 'm');
    expect(r.fields['Diagnosis (as written)']).toBe('Squamous cell carcinoma');
    expect(r.fields['Margins']).toBe('Not stated');
    expect(r.fields).not.toHaveProperty('Made up field');
    expect(r.tests).toEqual([]);
    expect(r.plain).toBe('The biopsy found cancer.');
    expect(r.summary).toContain('Depth of invasion: 6 mm');
  });
  it('reads lab tests with flags', async () => {
    vi.stubGlobal('fetch', reply({ fields: { 'Abnormal results': 'Hb low' }, tests: [{ name: 'Haemoglobin', value: '10.6', unit: 'g/dL', range: '13-17', flag: 'LOW' }, { name: '', value: '1' }], plain: 'Blood count is a little low.' }));
    const r = await summariseReport('Hb 10.6', 'general', 'k', 'm');
    expect(r.tests).toEqual([{ name: 'Haemoglobin', value: '10.6', unit: 'g/dL', range: '13-17', flag: 'low' }]);
  });
  it('says so when the text is not a medical report, and rejects empty or failed responses', async () => {
    vi.stubGlobal('fetch', reply({ error: 'not_a_report' }));
    await expect(summariseReport('hello', 'biopsy', 'k', 'm')).rejects.toThrow('not_a_report');
    vi.stubGlobal('fetch', reply({ fields: {} }));
    await expect(summariseReport('Impression: SCC', 'biopsy', 'k', 'm')).rejects.toThrow('Invalid summary');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(summariseReport('Impression: SCC', 'biopsy', 'k', 'm')).rejects.toThrow('unavailable');
  });
});

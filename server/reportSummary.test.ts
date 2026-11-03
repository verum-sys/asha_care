import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportSummaryMessages, summariseReport } from './reportSummary';
afterEach(() => vi.unstubAllGlobals());
const reply = (content: unknown) => vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) }));
describe('report summaries', () => {
  it('keeps the model to what the report says, with no treatment advice or identifiers', () => {
    const [system, user] = reportSummaryMessages('Impression: SCC', 'biopsy');
    expect(system.content).toContain('histopathology');
    expect(system.content).toContain('never add, guess or infer a diagnosis');
    expect(system.content).toContain('Do not give treatment advice');
    expect(system.content).toContain('Do not include patient names');
    expect(system.content).toContain('untrusted data');
    expect(user.content).toBe('Impression: SCC');
  });
  it('returns a checked summary', async () => {
    vi.stubGlobal('fetch', reply({ summary: 'Report type: biopsy\nDiagnosis or impression (as written): SCC\nAI draft - check against the original report.' }));
    await expect(summariseReport('Impression: SCC', 'biopsy', 'k', 'm')).resolves.toContain('SCC');
  });
  it('says so when the text is not a medical report', async () => {
    vi.stubGlobal('fetch', reply({ summary: '', error: 'not_a_report' }));
    await expect(summariseReport('hello', 'biopsy', 'k', 'm')).rejects.toThrow('not_a_report');
  });
  it('rejects empty or failed responses', async () => {
    vi.stubGlobal('fetch', reply({}));
    await expect(summariseReport('Impression: SCC', 'biopsy', 'k', 'm')).rejects.toThrow('Invalid summary');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(summariseReport('Impression: SCC', 'biopsy', 'k', 'm')).rejects.toThrow('unavailable');
  });
});

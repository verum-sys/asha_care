import { afterEach, describe, expect, it, vi } from 'vitest';
import { clinicalNotesMessages, generateClinicalNotes } from './clinicalNotes';
afterEach(() => vi.unstubAllGlobals());
describe('Groq clinical notes', () => {
  it('limits the model to supplied facts and reviewable drafts', () => {
    const messages = clinicalNotesMessages('Risk score 5/12');
    expect(messages[0].content).toContain('Never invent vitals');
    expect(messages[0].content).toContain('not confirmed diagnoses');
    expect(messages[1].content).toBe('Risk score 5/12');
  });
  it('returns validated provider notes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ notes: 'Screening score 5/12. Draft for worker review.' }) } }] }) })));
    await expect(generateClinicalNotes('Risk score 5/12', 'test-key', 'test-model')).resolves.toContain('5/12');
  });
  it('rejects invalid provider output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) })));
    await expect(generateClinicalNotes('Risk score 5/12', 'test-key', 'test-model')).rejects.toThrow('Invalid notes');
  });
});

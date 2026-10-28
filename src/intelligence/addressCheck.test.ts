import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAddressWithAi } from './addressCheck';
afterEach(() => vi.unstubAllGlobals());
const token = async () => 'token';
const answer = (body: unknown, ok = true) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));
describe('AI address check (client)', () => {
  it('blocks only a confident "not an address"', async () => {
    answer({ looksLikeAddress: false, confidence: 0.95, reason: '' });
    expect(await checkAddressWithAi('kjhsdf', token)).toBe('bad');
    answer({ looksLikeAddress: false, confidence: 0.5, reason: '' });
    expect(await checkAddressWithAi('Itki', token)).toBe('ok');
    answer({ looksLikeAddress: true, confidence: 0.95, reason: '' });
    expect(await checkAddressWithAi('Bero village', token)).toBe('ok');
  });
  it('never blocks registration when the check cannot run', async () => {
    expect(await checkAddressWithAi('Bero', async () => null)).toBe('unknown');
    answer({}, false);
    expect(await checkAddressWithAi('Bero', token)).toBe('unknown');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await checkAddressWithAi('Bero', token)).toBe('unknown');
    vi.stubGlobal('navigator', { onLine: false });
    expect(await checkAddressWithAi('Bero', token)).toBe('unknown');
  });
  it('sends only the address text', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ looksLikeAddress: true, confidence: 0.9, reason: '' }) }));
    vi.stubGlobal('fetch', fetcher);
    await checkAddressWithAi('  Bero village ', token);
    expect(JSON.parse((fetcher.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ task: 'validate-address', context: 'Bero village' });
  });
});

export type AddressVerdict = 'ok' | 'bad' | 'unknown';

/**
 * Asks the AI whether text looks like an address. Only a confident "no" blocks the form; offline, signed out
 * or an unavailable service returns 'unknown' so registration still works in the field.
 */
export async function checkAddressWithAi(address: string, getToken: () => Promise<string | null>, signal?: AbortSignal): Promise<AddressVerdict> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'unknown';
    const token = await getToken();
    if (!token) return 'unknown';
    const response = await fetch('/api/interpret-answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task: 'validate-address', context: address.trim() }), signal,
    });
    if (!response.ok) return 'unknown';
    const verdict: unknown = await response.json();
    const v = verdict as { looksLikeAddress?: unknown; confidence?: unknown };
    if (typeof v.looksLikeAddress !== 'boolean' || typeof v.confidence !== 'number') return 'unknown';
    return !v.looksLikeAddress && v.confidence >= 0.8 ? 'bad' : 'ok';
  } catch { return 'unknown'; }
}

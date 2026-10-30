/**
 * Backend selection and auth for sync.
 * With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, the app syncs to Supabase.
 * Without them it uses the simulated on-device server (remoteLocal.ts), as before.
 */
export const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export function isRemoteEnabled(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Demo records are seeded on a fresh device only in local mode, or when VITE_SEED_DEMO=1. */
export function shouldSeedDemo(): boolean {
  return !isRemoteEnabled() || import.meta.env.VITE_SEED_DEMO === '1';
}

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;

/** Set by RemoteTokenBridge once Clerk has loaded; returns the Clerk session token Supabase verifies. */
export function setRemoteTokenProvider(fn: TokenProvider): void {
  tokenProvider = fn;
}

export function getRemoteToken(): Promise<string | null> {
  return tokenProvider();
}

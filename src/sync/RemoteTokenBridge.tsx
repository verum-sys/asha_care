import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setRemoteTokenProvider } from './config';

/** Gives the sync layer the Clerk session token. Render once, inside ClerkProvider. */
export function RemoteTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setRemoteTokenProvider(() => getToken());
  }, [getToken]);
  return null;
}

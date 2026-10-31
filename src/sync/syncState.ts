/** What the always-visible sync pill says. Pure, so every state can be tested. */
export type SyncPillState = 'offline' | 'sending' | 'signin' | 'failed' | 'waiting' | 'saved';

export interface SyncPillInput {
  online: boolean;
  syncing: boolean;
  syncFailed: boolean;
  needsSignIn: boolean;
  pending: number;
}

export function syncPillState({ online, syncing, syncFailed, needsSignIn, pending }: SyncPillInput): SyncPillState {
  if (!online) return 'offline';
  if (syncing) return 'sending';
  // Only worth a warning when something is actually waiting to be sent.
  if (needsSignIn && pending > 0) return 'signin';
  if (syncFailed) return 'failed';
  if (pending > 0) return 'waiting';
  return 'saved';
}

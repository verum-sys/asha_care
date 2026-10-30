/**
 * The one door to the server. Everything else imports from here.
 * Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, otherwise the simulated
 * on-device server. Both backends have the same function signatures.
 */
import { isRemoteEnabled } from './config';
import * as local from './remoteLocal';
import * as supabase from './remoteSupabase';

export type { FacilityActionInput, RemoteCase } from './remoteLocal';
export type { PulledCases } from './remoteSupabase';
export { NotSignedInError } from './remoteSupabase';

const backend = () => (isRemoteEnabled() ? supabase : local);

export const pushRecords: typeof local.pushRecords = (...args) => backend().pushRecords(...args);
export const pullFacilityUpdates: typeof local.pullFacilityUpdates = (...args) => backend().pullFacilityUpdates(...args);
export const listRemoteCases: typeof local.listRemoteCases = () => backend().listRemoteCases();
export const getRemoteCase: typeof local.getRemoteCase = (...args) => backend().getRemoteCase(...args);
export const facilityAct: typeof local.facilityAct = (...args) => backend().facilityAct(...args);

/** Cases changed on the server since `since`. Supabase only; the simulated server has nothing to pull. */
export const pullCases: typeof supabase.pullCases = (since) =>
  isRemoteEnabled() ? supabase.pullCases(since) : Promise.resolve({ patients: [], referrals: [], followUps: [], events: [], cursor: since });

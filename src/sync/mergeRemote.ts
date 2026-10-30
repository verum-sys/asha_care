/**
 * Apply cases pulled from the server to this device's IndexedDB.
 * Rules: records with unsent local edits are never overwritten (the push goes first and the server
 * decides last-write-wins); otherwise the newer `updatedAt` wins. `facility` always comes from the server.
 */
import { getDB } from '../db/db';
import type { PulledCases } from './remote';

export async function mergePulledCases(pulled: PulledCases): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(['patients', 'referrals', 'followups', 'facility_events'], 'readwrite');
  let changed = 0;

  for (const remote of pulled.patients) {
    const local = await tx.objectStore('patients').get(remote.id);
    if (!local || (local.syncStatus !== 'pending' && remote.updatedAt > local.updatedAt)) {
      await tx.objectStore('patients').put(remote);
      changed++;
    }
  }

  for (const remote of pulled.referrals) {
    const local = await tx.objectStore('referrals').get(remote.id);
    if (!local) {
      await tx.objectStore('referrals').put(remote);
      changed++;
    } else if (local.syncStatus !== 'pending' && remote.updatedAt > local.updatedAt) {
      await tx.objectStore('referrals').put(remote);
      changed++;
    } else if (local.facility.updatedAt !== remote.facility.updatedAt) {
      // Same or newer local data: keep it, but take the facility-owned facts from the server.
      await tx.objectStore('referrals').put({ ...local, facility: remote.facility });
      changed++;
    }
  }

  for (const followUp of pulled.followUps) {
    if (!(await tx.objectStore('followups').get(followUp.id))) {
      await tx.objectStore('followups').put(followUp);
      changed++;
    }
  }
  for (const event of pulled.events) {
    if (!(await tx.objectStore('facility_events').get(event.id))) {
      await tx.objectStore('facility_events').put(event);
      changed++;
    }
  }

  await tx.done;
  return changed;
}

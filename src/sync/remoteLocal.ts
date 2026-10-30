/**
 * SIMULATED SERVER for the single-device demo (used when VITE_SUPABASE_URL is not set).
 *
 * Backed by `remote_*` IndexedDB stores so the demo works with no backend at all.
 * The real backend is `remoteSupabase.ts`; `remote.ts` picks one. Keep both in step.
 *
 * Ownership rule that keeps sync conflict-free: the frontline device owns patient fields,
 * referral details and `referral.worker`; the facility owns `referral.facility`.
 */
import { getDB, notifyChange, uid } from '../db/db';
import type { FacilityEvent, FacilityFacts, FollowUp, Patient, Referral } from '../db/types';

export interface RemoteCase {
  patient: Patient;
  referral: Referral;
  followUps: FollowUp[];
  events: FacilityEvent[];
}

/** Upsert records from the field. Facility-owned facts already on the server are preserved. */
export async function pushRecords(patients: Patient[], referrals: Referral[], followUps: FollowUp[], at: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['remote_patients', 'remote_referrals', 'remote_followups'], 'readwrite');
  for (const p of patients) await tx.objectStore('remote_patients').put({ ...p, syncStatus: 'synced' });
  for (const r of referrals) {
    const existing = await tx.objectStore('remote_referrals').get(r.id);
    await tx
      .objectStore('remote_referrals')
      .put({ ...r, facility: existing && (existing.tier || 'asha') === (r.tier || 'asha') ? existing.facility : r.facility, syncStatus: 'synced', lastSyncedAt: at });
  }
  for (const f of followUps) await tx.objectStore('remote_followups').put({ ...f, syncStatus: 'synced' });
  await tx.done;
}

/** Facility-owned facts + facility events for the given referrals (what the field device pulls). */
export async function pullFacilityUpdates(referralIds: string[]): Promise<{ facility: Map<string, FacilityFacts>; events: FacilityEvent[] }> {
  const db = await getDB();
  const facility = new Map<string, FacilityFacts>();
  const events: FacilityEvent[] = [];
  for (const id of referralIds) {
    const r = await db.get('remote_referrals', id);
    if (r) facility.set(id, r.facility);
    events.push(...(await db.getAllFromIndex('remote_facility_events', 'byReferral', id)));
  }
  return { facility, events };
}

// ---------------- Facility interface (assumed online; reads/writes the server directly) ----------------

export async function listRemoteCases(): Promise<RemoteCase[]> {
  const db = await getDB();
  const [patients, referrals, followUps, events] = await Promise.all([
    db.getAll('remote_patients'),
    db.getAll('remote_referrals'),
    db.getAll('remote_followups'),
    db.getAll('remote_facility_events'),
  ]);
  const byId = new Map(patients.map((p) => [p.id, p]));
  return referrals
    .filter((r) => byId.has(r.patientId))
    .map((r) => ({
      patient: byId.get(r.patientId)!,
      referral: r,
      followUps: followUps.filter((f) => f.referralId === r.id),
      events: events.filter((e) => e.referralId === r.id),
    }))
    .sort((a, b) => (a.referral.referralDate < b.referral.referralDate ? 1 : -1));
}

export async function getRemoteCase(referralId: string): Promise<RemoteCase | undefined> {
  return (await listRemoteCases()).find((c) => c.referral.id === referralId);
}

export type FacilityActionInput =
  | { kind: 'acknowledged' | 'accepted' | 'declined' | 'info_requested' | 'attended' | 'not_attended'; text?: string }
  | { kind: 'scheduled'; date: string; text?: string }
  | { kind: 'completed'; followUpRequired: boolean; followUpPlan?: string; text?: string }
  | { kind: 'note'; text: string };

/** Pure: how one facility action changes the facility-owned facts. Shared by the local and Supabase backends. */
export function applyFacilityAction(current: FacilityFacts, input: FacilityActionInput, at: string): { facility: FacilityFacts; eventText?: string } {
  const f: FacilityFacts = { ...current, notes: [...current.notes] };

  switch (input.kind) {
    case 'acknowledged':
      if (f.response === 'none') f.response = 'received';
      break;
    case 'accepted':
      f.response = 'accepted';
      f.completed = false;
      break;
    case 'declined':
      f.response = 'declined';
      f.appointmentDate = undefined;
      break;
    case 'info_requested':
      f.response = 'info_requested';
      break;
    case 'scheduled':
      f.response = 'accepted';
      f.appointmentDate = input.date;
      f.attendance = 'unknown';
      break;
    case 'attended':
      f.attendance = 'attended';
      break;
    case 'not_attended':
      f.attendance = 'not_attended';
      break;
    case 'completed':
      if (f.attendance === 'unknown') f.attendance = 'attended';
      f.completed = true;
      f.followUpRequired = input.followUpRequired;
      f.followUpPlan = input.followUpPlan || undefined;
      break;
  }
  const eventText = input.kind === 'scheduled' ? input.date + (input.text ? ` · ${input.text}` : '') : input.text;
  if (input.text) f.notes.push({ at, text: input.text });
  f.updatedAt = at;
  return { facility: f, eventText };
}

export async function facilityAct(referralId: string, input: FacilityActionInput): Promise<void> {
  const db = await getDB();
  const r = await db.get('remote_referrals', referralId);
  if (!r) throw new Error('Referral not on server');
  const at = new Date().toISOString();
  const { facility, eventText } = applyFacilityAction(r.facility, input, at);

  const event: FacilityEvent = { id: uid('fe-'), referralId, at, kind: input.kind, text: eventText };
  const tx = db.transaction(['remote_referrals', 'remote_facility_events'], 'readwrite');
  await tx.objectStore('remote_referrals').put({ ...r, facility });
  await tx.objectStore('remote_facility_events').put(event);
  await tx.done;
  notifyChange();
}

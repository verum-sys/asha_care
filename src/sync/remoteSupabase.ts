/**
 * Real backend: Supabase over its REST API (PostgREST). No SDK, just fetch.
 * Tables and rules are in supabase/schema.sql. Auth is the Clerk session token (see config.ts).
 *
 * Same shape as remoteLocal.ts, so remote.ts can pick either one.
 */
import { notifyChange, uid } from '../db/db';
import type { FacilityEvent, FacilityFacts, FollowUp, Patient, Referral } from '../db/types';
import { getRemoteToken, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { applyFacilityAction, type FacilityActionInput, type RemoteCase } from './remoteLocal';

/** Thrown when there is no signed-in session yet; sync treats it as "try again later", not a failure. */
export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in');
  }
}

type Method = 'GET' | 'POST' | 'PATCH';
const PAGE = 500;

async function rest<T = void>(method: Method, path: string, body?: unknown, prefer?: string): Promise<T> {
  const token = await getRemoteToken();
  if (!token) throw new NotSignedInError();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GET every row of a query, a page at a time (the server caps one response). */
async function fetchAll<T>(table: string, query: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await rest<T[]>('GET', `${table}?${query}&order=server_updated_at.asc,id.asc&limit=${PAGE}&offset=${offset}`);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const enc = encodeURIComponent;
const inList = (ids: string[]) => `(${ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`;
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface PatientRow { id: string; data: Patient; server_updated_at: string }
interface ReferralRow { id: string; data: Referral; facility: FacilityFacts; server_updated_at: string }
interface FollowUpRow { id: string; data: FollowUp; server_updated_at: string }
interface EventRow { id: string; data: FacilityEvent; server_updated_at: string }

const toPatient = (r: PatientRow): Patient => ({ ...r.data, syncStatus: 'synced' });
/** The facility column is the source of truth for facility-owned facts. */
const toReferral = (r: ReferralRow): Referral => ({ ...r.data, facility: r.facility, syncStatus: 'synced' });
const toFollowUp = (r: FollowUpRow): FollowUp => ({ ...r.data, syncStatus: 'synced' });

const upsert = (table: string, rows: object[]) =>
  rows.length ? rest('POST', `${table}?on_conflict=id`, rows, 'resolution=merge-duplicates,return=minimal') : Promise.resolve();

/**
 * Upsert records from the field. The payload never includes `facility`, so facility-owned facts
 * already on the server are preserved (the database resets them when the tier changes).
 */
export async function pushRecords(patients: Patient[], referrals: Referral[], followUps: FollowUp[], at: string): Promise<void> {
  await upsert('patients', patients.map((p) => ({ id: p.id, data: { ...p, syncStatus: 'synced' }, updated_at: p.updatedAt })));
  await upsert(
    'referrals',
    referrals.map((r) => ({
      id: r.id,
      patient_id: r.patientId,
      tier: r.tier || 'asha',
      urgency: r.urgency,
      data: { ...r, syncStatus: 'synced', lastSyncedAt: at },
      updated_at: r.updatedAt,
    })),
  );
  await upsert('followups', followUps.map((f) => ({ id: f.id, referral_id: f.referralId, at: f.at, data: { ...f, syncStatus: 'synced' } })));
}

/** Facility-owned facts + facility events for the given referrals (what the field device pulls). */
export async function pullFacilityUpdates(referralIds: string[]): Promise<{ facility: Map<string, FacilityFacts>; events: FacilityEvent[] }> {
  const facility = new Map<string, FacilityFacts>();
  const events: FacilityEvent[] = [];
  for (const ids of chunk(referralIds, 80)) {
    const list = inList(ids);
    for (const r of await rest<{ id: string; facility: FacilityFacts }[]>('GET', `referrals?select=id,facility&id=in.${enc(list)}`)) facility.set(r.id, r.facility);
    for (const e of await fetchAll<EventRow>('facility_events', `select=id,data,server_updated_at&referral_id=in.${enc(list)}`)) events.push(e.data);
  }
  return { facility, events };
}

export interface PulledCases {
  patients: Patient[];
  referrals: Referral[];
  followUps: FollowUp[];
  events: FacilityEvent[];
  /** Pass back as `since` on the next pull. */
  cursor: string | undefined;
}

/** Everything that changed on the server since `since` (all cases, not just ones this device created). */
export async function pullCases(since?: string): Promise<PulledCases> {
  // Re-read a short overlap so a row committed just after the last pull is not missed; merging is idempotent.
  const from = since ? new Date(Date.parse(since) - 10_000).toISOString() : undefined;
  const filter = from ? `&server_updated_at=gt.${enc(from)}` : '';
  const [patients, referrals, followUps, events] = await Promise.all([
    fetchAll<PatientRow>('patients', `select=id,data,server_updated_at${filter}`),
    fetchAll<ReferralRow>('referrals', `select=id,data,facility,server_updated_at${filter}`),
    fetchAll<FollowUpRow>('followups', `select=id,data,server_updated_at${filter}`),
    fetchAll<EventRow>('facility_events', `select=id,data,server_updated_at${filter}`),
  ]);
  const stamps = [...patients, ...referrals, ...followUps, ...events].map((r) => r.server_updated_at).sort();
  return {
    patients: patients.map(toPatient),
    referrals: referrals.map(toReferral),
    followUps: followUps.map(toFollowUp),
    events: events.map((e) => e.data),
    cursor: stamps.length ? stamps[stamps.length - 1] : since,
  };
}

// ---------------- Facility interface (assumed online; reads/writes the server directly) ----------------

export async function listRemoteCases(): Promise<RemoteCase[]> {
  const [patients, referrals, followUps, events] = await Promise.all([
    fetchAll<PatientRow>('patients', 'select=id,data,server_updated_at'),
    fetchAll<ReferralRow>('referrals', 'select=id,data,facility,server_updated_at'),
    fetchAll<FollowUpRow>('followups', 'select=id,data,server_updated_at'),
    fetchAll<EventRow>('facility_events', 'select=id,data,server_updated_at'),
  ]);
  const byId = new Map(patients.map((p) => [p.id, toPatient(p)]));
  return referrals
    .map(toReferral)
    .filter((r) => byId.has(r.patientId))
    .map((r) => ({
      patient: byId.get(r.patientId)!,
      referral: r,
      followUps: followUps.filter((f) => f.data.referralId === r.id).map(toFollowUp),
      events: events.filter((e) => e.data.referralId === r.id).map((e) => e.data),
    }))
    .sort((a, b) => (a.referral.referralDate < b.referral.referralDate ? 1 : -1));
}

export async function getRemoteCase(referralId: string): Promise<RemoteCase | undefined> {
  const [row] = await rest<ReferralRow[]>('GET', `referrals?select=id,data,facility,server_updated_at&id=eq.${enc(referralId)}`);
  if (!row) return undefined;
  const referral = toReferral(row);
  const [patient] = await rest<PatientRow[]>('GET', `patients?select=id,data,server_updated_at&id=eq.${enc(referral.patientId)}`);
  if (!patient) return undefined;
  const [followUps, events] = await Promise.all([
    fetchAll<FollowUpRow>('followups', `select=id,data,server_updated_at&referral_id=eq.${enc(referralId)}`),
    fetchAll<EventRow>('facility_events', `select=id,data,server_updated_at&referral_id=eq.${enc(referralId)}`),
  ]);
  return { patient: toPatient(patient), referral, followUps: followUps.map(toFollowUp), events: events.map((e) => e.data) };
}

export async function facilityAct(referralId: string, input: FacilityActionInput): Promise<void> {
  const [row] = await rest<{ facility: FacilityFacts }[]>('GET', `referrals?select=facility&id=eq.${enc(referralId)}`);
  if (!row) throw new Error('Referral not on server');
  const at = new Date().toISOString();
  const { facility, eventText } = applyFacilityAction(row.facility, input, at);
  const event: FacilityEvent = { id: uid('fe-'), referralId, at, kind: input.kind, text: eventText };
  await rest('PATCH', `referrals?id=eq.${enc(referralId)}`, { facility }, 'return=minimal');
  await rest('POST', 'facility_events', [{ id: event.id, referral_id: referralId, at, data: event }], 'return=minimal');
  notifyChange();
}

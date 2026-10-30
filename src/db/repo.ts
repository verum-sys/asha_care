import { today } from '../intelligence/dates';
/**
 * Frontline repository. Every write lands in IndexedDB first, is marked `pending`,
 * and is queued in the outbox for the next sync. Nothing here touches the network.
 */
import { getDB, getMeta, notifyChange, setMeta, uid } from './db';
import { emptyFacility } from './factory';
import type {
  ActionKey,
  Attendance,
  AppointmentCertainty,
  CareTier,
  CareUnit,
  FacilityEvent,
  FacilityResponse,
  FollowUp,
  FollowUpAction,
  Intention,
  OutboxItem,
  Patient,
  PhysicalExamNotes,
  Referral,
  ReportAttachment,
  SyncEvent,
  TierNote,
  Urgency,
} from './types';

export interface CaseRecord {
  patient: Patient;
  referral: Referral;
  followUps: FollowUp[];
  facilityEvents: FacilityEvent[];
}

async function nextId(kind: 'patient' | 'referral'): Promise<string> {
  const key = `counter_${kind}`;
  const n = ((await getMeta<number>(key)) ?? 0) + 1;
  await setMeta(key, n);
  return `${kind === 'patient' ? 'CL' : 'REF'}-${String(n).padStart(4, '0')}`;
}

function outboxItem(entity: OutboxItem['entity'], entityId: string): OutboxItem {
  return { id: `${entity}:${entityId}`, entity, entityId, at: new Date().toISOString() };
}

export async function listCases(): Promise<CaseRecord[]> {
  const db = await getDB();
  const [patients, referrals, followUps, events] = await Promise.all([
    db.getAll('patients'),
    db.getAll('referrals'),
    db.getAll('followups'),
    db.getAll('facility_events'),
  ]);
  const byId = new Map(patients.map((p) => [p.id, p]));
  return referrals
    .filter((r) => byId.has(r.patientId))
    .map((r) => ({
      patient: byId.get(r.patientId)!,
      referral: r,
      followUps: followUps.filter((f) => f.referralId === r.id),
      facilityEvents: events.filter((e) => e.referralId === r.id),
    }));
}

export async function getCase(referralId: string): Promise<CaseRecord | undefined> {
  const db = await getDB();
  const referral = await db.get('referrals', referralId);
  if (!referral) return undefined;
  const patient = await db.get('patients', referral.patientId);
  if (!patient) return undefined;
  const followUps = await db.getAllFromIndex('followups', 'byReferral', referralId);
  const facilityEvents = await db.getAllFromIndex('facility_events', 'byReferral', referralId);
  return { patient, referral, followUps, facilityEvents };
}

export type PatientDraft = Pick<Patient, 'name' | 'age' | 'sex' | 'phone' | 'locality' | 'pincode'>;
export type ReferralDraft = Pick<
  Referral,
  'reason' | 'destinationFacility' | 'referralDate' | 'urgency' | 'notes' | 'patientIntention' | 'screening'
> & {
  appointmentDate?: string;
  facilityResponse?: FacilityResponse;
  appointmentCertainty?: AppointmentCertainty;
  tier?: CareTier;
  unit?: CareUnit;
  physicalExam?: PhysicalExamNotes;
  dhNotes?: string;
  tccNotes?: string;
  tierNotes?: TierNote[];
  reports?: ReportAttachment[];
  biopsyReports?: ReportAttachment[];
  radiologyReports?: ReportAttachment[];
  aiSummaryOverride?: string;
};

export async function createCase(p: PatientDraft, r: ReferralDraft, referringWorker: string): Promise<string> {
  const db = await getDB();
  const now = new Date().toISOString();
  const patientId = await nextId('patient');
  const referralId = await nextId('referral');
  const patient: Patient = { ...p, id: patientId, createdAt: now, updatedAt: now, syncStatus: 'pending' };
  const { appointmentDate, facilityResponse, appointmentCertainty, ...rest } = r;
  const referral: Referral = {
    ...rest,
    id: referralId,
    patientId,
    referringWorker,
    tier: rest.tier || 'asha',
    unit: rest.unit || 'a',
    worker: {
      appointmentDate: appointmentDate || undefined,
      facilityResponse,
      appointmentCertainty,
    },
    facility: emptyFacility(),
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  };
  const tx = db.transaction(['patients', 'referrals', 'outbox'], 'readwrite');
  await tx.objectStore('patients').put(patient);
  await tx.objectStore('referrals').put(referral);
  await tx.objectStore('outbox').put(outboxItem('patient', patientId));
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.done;
  notifyChange();
  return referralId;
}

export async function updateCase(referralId: string, p: PatientDraft, r: ReferralDraft, suggestedAction?: ActionKey): Promise<void> {
  const db = await getDB();
  const current = await getCase(referralId);
  if (!current) throw new Error('Case not found');
  const now = new Date().toISOString();
  const { appointmentDate, facilityResponse, ...rest } = r;
  const patient: Patient = { ...current.patient, ...p, updatedAt: now, syncStatus: 'pending' };
  const referral: Referral = {
    ...current.referral,
    ...rest,
    worker: {
      ...current.referral.worker,
      appointmentDate: appointmentDate || current.referral.worker.appointmentDate,
      facilityResponse: facilityResponse ?? current.referral.worker.facilityResponse,
    },
    updatedAt: now,
    syncStatus: 'pending',
  };
  const fu: FollowUp = { id: uid('fu-'), referralId, at: now, action: 'details_completed', suggestedAction, syncStatus: 'pending' };
  const tx = db.transaction(['patients', 'referrals', 'followups', 'outbox'], 'readwrite');
  await tx.objectStore('patients').put(patient);
  await tx.objectStore('referrals').put(referral);
  await tx.objectStore('followups').put(fu);
  await tx.objectStore('outbox').put(outboxItem('patient', patient.id));
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.objectStore('outbox').put(outboxItem('followup', fu.id));
  await tx.done;
  notifyChange();
}

export interface FollowUpInput {
  action: FollowUpAction;
  note?: string;
  date?: string;
  response?: FacilityResponse;
  intention?: Intention;
  suggestedAction?: ActionKey;
}

/** Record what the worker did, and fold what they learned into the frontline-owned facts. */
export async function addFollowUp(referralId: string, input: FollowUpInput): Promise<void> {
  const db = await getDB();
  const referral = await db.get('referrals', referralId);
  if (!referral) throw new Error('Referral not found');
  if (input.action === 'outcome_recorded' && referral.tier !== 'tcc') throw new Error('Only TCC can close the care loop; refer to the next care tier instead');
  if (input.action === 'info_sent_to_facility' && referral.tier === 'tcc') throw new Error('TCC is the final care stage');
  const now = new Date().toISOString();
  const w = { ...referral.worker };
  let intention = referral.patientIntention;

  switch (input.action) {
    case 'facility_contacted':
      if (input.response && input.response !== 'none') w.facilityResponse = input.response;
      if (input.date) w.appointmentDate = input.date;
      break;
    case 'appointment_confirmed':
      if (input.date) w.appointmentDate = input.date;
      if (!w.facilityResponse || w.facilityResponse === 'none') w.facilityResponse = 'accepted';
      intention = 'will_attend';
      break;
    case 'rescheduled':
      if (input.date) w.appointmentDate = input.date;
      w.attendance = undefined;
      w.attendedDate = undefined;
      break;
    case 'contacted_patient':
      if (input.intention) intention = input.intention;
      break;
    case 'patient_attended':
      w.attendance = 'attended';
      w.attendedDate = input.date || today();
      break;
    case 'patient_not_attended':
      w.attendance = 'not_attended';
      w.attendedDate = undefined;
      break;
    case 'outcome_recorded':
      w.outcomeRecorded = true;
      w.outcomeNote = input.note;
      break;
  }

  const fu: FollowUp = {
    id: uid('fu-'),
    referralId,
    at: now,
    action: input.action,
    note: input.note || undefined,
    data: { date: input.action === 'patient_attended' ? w.attendedDate : input.date, response: input.response, intention: input.intention, tier: referral.tier || 'asha' },
    suggestedAction: input.suggestedAction,
    syncStatus: 'pending',
  };
  const updated: Referral = { ...referral, worker: w, patientIntention: intention, updatedAt: now, syncStatus: 'pending' };

  const tx = db.transaction(['referrals', 'followups', 'outbox'], 'readwrite');
  await tx.objectStore('referrals').put(updated);
  await tx.objectStore('followups').put(fu);
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.objectStore('outbox').put(outboxItem('followup', fu.id));
  await tx.done;
  notifyChange();
}

export async function outboxCount(): Promise<number> {
  return (await getDB()).count('outbox');
}

export async function listSyncEvents(): Promise<SyncEvent[]> {
  const all = await (await getDB()).getAll('sync_events');
  return all.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function updateCaseClinical(
  referralId: string,
  updates: Partial<Pick<Referral, 'tier' | 'unit' | 'physicalExam' | 'dhNotes' | 'tccNotes' | 'reports' | 'biopsyReports' | 'radiologyReports' | 'aiSummaryOverride' | 'notes'>>
): Promise<void> {
  const db = await getDB();
  const current = await db.get('referrals', referralId);
  if (!current) throw new Error('Referral not found');
  const now = new Date().toISOString();
  const updated: Referral = {
    ...current,
    ...updates,
    updatedAt: now,
    syncStatus: 'pending',
  };
  const tx = db.transaction(['referrals', 'outbox'], 'readwrite');
  await tx.objectStore('referrals').put(updated);
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.done;
  notifyChange();
}

export async function addCaseAttachment(
  referralId: string,
  attachment: ReportAttachment
): Promise<void> {
  const db = await getDB();
  const current = await db.get('referrals', referralId);
  if (!current) throw new Error('Referral not found');
  const now = new Date().toISOString();
  const cat = attachment.category;
  const updated: Referral = {
    ...current,
    reports: cat === 'general' ? [...(current.reports || []), attachment] : current.reports,
    biopsyReports: cat === 'biopsy' ? [...(current.biopsyReports || []), attachment] : current.biopsyReports,
    radiologyReports: cat === 'radiology' ? [...(current.radiologyReports || []), attachment] : current.radiologyReports,
    updatedAt: now,
    syncStatus: 'pending',
  };
  const fu: FollowUp = {
    id: uid('fu-'),
    referralId,
    at: now,
    action: 'details_completed',
    note: `Attached ${cat} report: ${attachment.title} (${attachment.fileName})`,
    syncStatus: 'pending',
  };
  const tx = db.transaction(['referrals', 'followups', 'outbox'], 'readwrite');
  await tx.objectStore('referrals').put(updated);
  await tx.objectStore('followups').put(fu);
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.objectStore('outbox').put(outboxItem('followup', fu.id));
  await tx.done;
  notifyChange();
}

export async function referToNextTier(
  referralId: string,
  targetTier: CareTier,
  destinationFacility: string,
  notes?: string,
  urgency?: Urgency,
  targetUnit?: CareUnit,
  appointmentDate?: string
): Promise<void> {
  const db = await getDB();
  const current = await db.get('referrals', referralId);
  if (!current) throw new Error('Referral not found');
  const now = new Date().toISOString();
  const updated: Referral = {
    ...current,
    clinicalHandovers: [...(current.clinicalHandovers || []), {
      fromTier: current.tier || 'asha', toTier: targetTier, at: now,
      physicalExam: current.physicalExam,
      notes: [current.notes, notes].filter(Boolean).join('\n'),
      dhNotes: current.dhNotes,
      aiSummary: current.aiSummaryOverride,
      visitStatus: current.worker, facilityStatus: current.facility,
    }],
    // The new tier starts with fresh visit facts; the appointment set while referring is its first fact.
    worker: appointmentDate ? { appointmentDate } : {},
    facility: emptyFacility(),
    tier: targetTier,
    unit: targetUnit || current.unit,
    destinationFacility: destinationFacility || current.destinationFacility,
    urgency: urgency || current.urgency,
    notes: notes ? (current.notes ? `${current.notes}\n[Referral to ${targetTier.toUpperCase()}]: ${notes}` : notes) : current.notes,
    updatedAt: now,
    syncStatus: 'pending',
  };
  const fu: FollowUp = {
    id: uid('fu-'),
    referralId,
    at: now,
    action: 'referral_sent',
    note: `Escalated case to ${targetTier.toUpperCase()}: ${destinationFacility}.${appointmentDate ? ` Appointment ${appointmentDate}.` : ''} ${notes || ''}`,
    syncStatus: 'pending',
  };
  const tx = db.transaction(['referrals', 'followups', 'outbox'], 'readwrite');
  await tx.objectStore('referrals').put(updated);
  await tx.objectStore('followups').put(fu);
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.objectStore('outbox').put(outboxItem('followup', fu.id));
  await tx.done;
  notifyChange();
}

/** Update recorded acceptance/attendance without discarding prior follow-up history. */
export async function updateVisitDetails(referralId: string, input: { response?: FacilityResponse; date?: string; attendance: Attendance; note: string }): Promise<void> {
  const db = await getDB();
  const current = await db.get('referrals', referralId);
  if (!current) throw new Error('Referral not found');
  const now = new Date().toISOString();
  // Acceptance and appointment date are only changed when supplied; recording attendance alone leaves them as they are.
  const date = input.date === undefined ? current.worker.appointmentDate ?? '' : input.date;
  const response = input.response ?? current.worker.facilityResponse ?? current.facility.response;
  const certainty = input.date === undefined ? current.worker.appointmentCertainty : input.date ? 'confirmed' as const : undefined;
  const updated: Referral = { ...current, worker: { ...current.worker, facilityResponse: response, appointmentDate: date || undefined, appointmentCertainty: certainty, attendance: input.attendance, attendedDate: input.attendance === 'attended' ? current.worker.attendedDate || today() : undefined }, updatedAt: now, syncStatus: 'pending' };
  const followUp: FollowUp = { id: uid('fu-'), referralId, at: now, action: 'other', data: { tier: current.tier || 'asha', attendance: input.attendance, date: updated.worker.attendedDate || date || undefined }, note: `Visit updated: ${response}; appointment ${date || 'not set'}; attendance ${input.attendance}.${input.note ? ` ${input.note}` : ''}`, syncStatus: 'pending' };
  const tx = db.transaction(['referrals', 'followups', 'outbox'], 'readwrite');
  await tx.objectStore('referrals').put(updated);
  await tx.objectStore('followups').put(followUp);
  await tx.objectStore('outbox').put(outboxItem('referral', referralId));
  await tx.objectStore('outbox').put(outboxItem('followup', followUp.id));
  await tx.done;
  notifyChange();
}

export async function updateCaseAttachment(referralId: string, attachment: ReportAttachment): Promise<void> {
  const db = await getDB();
  const current = await db.get('referrals', referralId);
  if (!current) throw new Error('Referral not found');
  const field = attachment.category === 'general' ? 'reports' : attachment.category === 'biopsy' ? 'biopsyReports' : 'radiologyReports';
  if (!current[field]?.some(report => report.id === attachment.id)) throw new Error('Report not found');
  await updateCaseClinical(referralId, { [field]: current[field]!.map(report => report.id === attachment.id ? attachment : report) });
}

import type { CaseRecord } from '../db/repo';
import type { Attendance, CareTier, ClinicalHandover, FacilityFacts, PhysicalExamNotes, ReportAttachment, WorkerFacts } from '../db/types';
import { CBAC_B1_SYMPTOMS, CBAC_B2_SYMPTOMS, CBAC_B3_SYMPTOMS } from '../intelligence/cbacTypes';
import { today } from '../intelligence/dates';
import { downloadXlsx, type Cell, type Sheet } from './xlsx';

/** 'all' is the program manager's report; a tier exports only what happened while the case was at that tier. */
export type ReportScope = CareTier | 'all';

const TIERS: CareTier[] = ['asha', 'phc', 'dh', 'tcc'];
const TIER_NAME: Record<CareTier, string> = { asha: 'ASHA', phc: 'PHC', dh: 'DH', tcc: 'TCC' };
const ATTENDANCE: Record<Attendance, string> = { unknown: 'Not yet recorded', attended: 'Attended', not_attended: 'Missed appointment' };
const SYMPTOM_LABEL = new Map([...CBAC_B1_SYMPTOMS, ...CBAC_B2_SYMPTOMS, ...CBAC_B3_SYMPTOMS].map(s => [s.id, s.label]));

const yesNo = (v: boolean | undefined) => (v === undefined ? '' : v ? 'Yes' : 'No');
const dateTime = (iso?: string) => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** What one tier recorded for a case: live if the case is still there, otherwise the handover saved when it left. */
export interface Stage {
  tier: CareTier;
  arrived: string;
  left?: ClinicalHandover;
  visit: WorkerFacts;
  facility?: FacilityFacts;
  exam?: PhysicalExamNotes;
  notes?: string;
  dhNotes?: string;
  tccNotes?: string;
  summary?: string;
}

export function tiersVisited(c: CaseRecord): CareTier[] {
  const path = (c.referral.clinicalHandovers ?? []).map(h => h.fromTier);
  const current = c.referral.tier || 'asha';
  return [...new Set([...path, current])];
}

export function stageAt(c: CaseRecord, tier: CareTier): Stage | undefined {
  const r = c.referral;
  const handovers = r.clinicalHandovers ?? [];
  const current = r.tier || 'asha';
  const left = [...handovers].reverse().find(h => h.fromTier === tier);
  const held = current === tier;
  if (!held && !left) return undefined;
  const arrived = [...handovers].reverse().find(h => h.toTier === tier)?.at ?? r.createdAt;
  if (held) {
    return { tier, arrived, visit: r.worker, facility: r.facility, exam: r.physicalExam, notes: r.notes, dhNotes: r.dhNotes, tccNotes: r.tccNotes, summary: r.aiSummaryOverride };
  }
  return { tier, arrived, left, visit: left!.visitStatus ?? {}, facility: left!.facilityStatus, exam: left!.physicalExam, notes: left!.notes, dhNotes: left!.dhNotes, summary: left!.aiSummary };
}

const allReports = (c: CaseRecord): ReportAttachment[] => [...(c.referral.reports ?? []), ...(c.referral.biopsyReports ?? []), ...(c.referral.radiologyReports ?? [])];

/** Reports attached at this tier. Older reports carry no tier; they count for the tier holding the case. */
function reportsAt(c: CaseRecord, tier: CareTier): ReportAttachment[] {
  const current = c.referral.tier || 'asha';
  return allReports(c).filter(rep => (rep.tier ?? current) === tier);
}

const patientCells = (c: CaseRecord): Cell[] => [c.patient.id, c.patient.name?.trim() || 'Community member', c.patient.age, c.patient.sex, c.patient.phone, c.patient.locality, c.patient.pincode];
const PATIENT_HEAD = ['Patient ID', 'Name', 'Age', 'Sex', 'Phone', 'Village / locality', 'PIN code'];

const STAGE_HEAD = [
  ...PATIENT_HEAD, 'Referral ID', 'Unit', 'Tier', 'Status at this tier', 'Arrived at this tier', 'Urgency', 'Referral reason', 'Destination facility',
  'Appointment date', 'Attendance', 'Attended on',
  'BP systolic', 'BP diastolic', 'Pulse', 'SpO2 %', 'Temperature', 'Height cm', 'Weight kg', 'BMI',
  'General findings', 'Systemic examination', 'Oral cavity findings', 'Breast findings', 'Cervical findings', 'Examined by', 'Examined at',
  'Clinical notes', 'DH notes', 'TCC notes', 'Summary', 'Reports attached here',
  'Referred on to', 'Referred on (date)', 'Next ASHA follow-up', 'Instructions for ASHA', 'Care loop closed', 'Last updated', 'Sync status',
];

function stageRow(c: CaseRecord, s: Stage): Cell[] {
  const r = c.referral;
  const e = s.exam ?? {};
  const attendance = s.visit.attendance ?? s.facility?.attendance ?? 'unknown';
  const status = s.left ? `Referred to ${TIER_NAME[s.left.toTier]}` : s.tier === 'tcc' && r.ashaFollowUpDate ? 'Loop closed, follow-up with ASHA' : `At ${TIER_NAME[s.tier]}`;
  const atTcc = s.tier === 'tcc' && !s.left;
  return [
    ...patientCells(c), r.id, (r.unit || 'a').toUpperCase(), TIER_NAME[s.tier], status, dateTime(s.arrived), r.urgency, r.reason, r.destinationFacility,
    s.visit.appointmentDate ?? s.facility?.appointmentDate, ATTENDANCE[attendance], s.visit.attendedDate,
    e.bpSystolic, e.bpDiastolic, e.pulseRate, e.spo2, e.temperature, e.heightCm, e.weightKg, e.bmi,
    e.generalFindings, e.systemicExam, e.oralCavityFindings, e.breastExamFindings, e.cervicalExamFindings, e.recordedBy, dateTime(e.recordedAt),
    s.notes, s.tier === 'dh' || s.tier === 'tcc' ? s.dhNotes : '', s.tier === 'tcc' ? s.tccNotes : '', s.summary, reportsAt(c, s.tier).length,
    s.left ? TIER_NAME[s.left.toTier] : '', s.left ? dateTime(s.left.at) : '',
    atTcc || s.tier === 'asha' ? r.ashaFollowUpDate : '', atTcc || s.tier === 'asha' ? r.ashaFollowUpNote : '', atTcc ? yesNo(!!r.worker.outcomeRecorded) : '', dateTime(r.updatedAt), r.syncStatus,
  ];
}

const CBAC_HEAD = [
  ...PATIENT_HEAD, 'Referral ID', 'Screened on', 'ASHA name', 'Village / ward', 'Sub-centre', 'PHC / UPHC',
  'Age score', 'Smoking score', 'Alcohol score', 'Alcohol frequency', 'Waist cm', 'Waist score', 'Activity min / week', 'Activity score', 'Family history score',
  'Part A total (of 12)', 'High NCD risk', 'Symptoms reported', 'Symptom alert', 'TB suspect', 'TB contact', 'Cooking fuel', 'Occupational exposure',
  'PHQ-2 total (of 6)', 'Mental health alert', 'Referral required', 'Screening area', 'Screening finding',
];

function cbacRow(c: CaseRecord): Cell[] | undefined {
  const s = c.referral.screening;
  const cb = s?.cbac;
  if (!cb) return undefined;
  const symptoms = Object.entries(cb.partB?.symptoms ?? {}).filter(([, yes]) => yes).map(([id]) => SYMPTOM_LABEL.get(id) ?? id);
  // Identity document numbers are deliberately left out of every export.
  return [
    ...patientCells(c), c.referral.id, dateTime(cb.completedAt || cb.general?.date), cb.general?.ashaName, cb.general?.villageWard, cb.general?.subCentre, cb.general?.phcUphc,
    cb.partA.ageScore, cb.partA.smokeScore, cb.partA.alcoholScore, cb.partA.alcoholFrequency, cb.partA.waistCm, cb.partA.waistScore, cb.partA.activityMinutesPerWeek, cb.partA.physicalActivityScore, cb.partA.familyHistoryScore,
    cb.partA.totalScore, yesNo(cb.highRiskNcd), symptoms.join('; '), yesNo(cb.symptomAlert), yesNo(cb.tbSuspectAlert), yesNo(cb.tbContactAlert),
    (cb.partC?.cookingFuel ?? []).join(', '), (cb.partC?.occupationalExposure ?? []).join(', '),
    cb.partD?.totalScore, yesNo(cb.mentalHealthAlert), s?.referralRequired, s?.area, s?.finding,
  ];
}

const TIMELINE_HEAD = ['Patient ID', 'Name', 'Referral ID', 'Date and time', 'Tier', 'Action', 'Details'];
const REPORT_HEAD = ['Patient ID', 'Name', 'Referral ID', 'Tier', 'Type', 'Title', 'File name', 'File size', 'Uploaded on', 'Uploaded by', 'Findings', 'AI summary (draft, unverified)', 'AI summary made on'];
const REPORT_TYPE = { general: 'Lab', biopsy: 'Biopsy', radiology: 'Radiology' } as const;

function timelineRows(c: CaseRecord, scope: ReportScope): Cell[][] {
  let from = '', to = '￿';
  if (scope !== 'all') {
    const stage = stageAt(c, scope);
    if (!stage) return [];
    from = stage.arrived;
    if (stage.left) to = stage.left.at;
  }
  return [...c.followUps]
    .filter(f => f.at >= from && f.at <= to)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(f => [c.patient.id, c.patient.name?.trim() || 'Community member', c.referral.id, dateTime(f.at), f.data?.tier ? TIER_NAME[f.data.tier] : '', f.action.replace(/_/g, ' '), f.note]);
}

function reportRows(c: CaseRecord, scope: ReportScope): Cell[][] {
  const current = c.referral.tier || 'asha';
  const list = scope === 'all' ? allReports(c) : reportsAt(c, scope);
  return list.map(rep => [c.patient.id, c.patient.name?.trim() || 'Community member', c.referral.id, TIER_NAME[rep.tier ?? current], REPORT_TYPE[rep.category], rep.title, rep.fileName, rep.fileSize, dateTime(rep.uploadedAt), rep.uploadedBy, rep.findings, rep.aiSummary, dateTime(rep.aiSummaryAt)]);
}

const OVERVIEW_HEAD = [...PATIENT_HEAD, 'Referral ID', 'Unit', 'Current tier', 'Care path', 'Urgency', 'Referral date', 'CBAC score (of 12)', 'High NCD risk', 'Current appointment', 'Current attendance', 'Reports', 'Next ASHA follow-up', 'Care loop closed', 'Walk-in', 'Earlier linked case', 'Created', 'Last updated'];

function overviewRow(c: CaseRecord): Cell[] {
  const r = c.referral;
  const cb = r.screening?.cbac;
  return [
    ...patientCells(c), r.id, (r.unit || 'a').toUpperCase(), TIER_NAME[r.tier || 'asha'], tiersVisited(c).map(t => TIER_NAME[t]).join(' > '), r.urgency, r.referralDate,
    cb?.partA.totalScore, yesNo(cb?.highRiskNcd), r.worker.appointmentDate ?? r.facility.appointmentDate, ATTENDANCE[r.worker.attendance ?? r.facility.attendance],
    allReports(c).length, r.ashaFollowUpDate, yesNo((r.tier || 'asha') === 'tcc' ? !!r.ashaFollowUpDate : undefined), yesNo(r.referringWorker?.startsWith('Walk-in')), r.linkedReferralId, dateTime(r.createdAt), dateTime(r.updatedAt),
  ];
}

/** The sheets of a report. A tier sees only its own stage; DH and TCC do not receive the CBAC screening. */
export function buildReport(cases: CaseRecord[], scope: ReportScope): Sheet[] {
  const ordered = [...cases].sort((a, b) => a.patient.id.localeCompare(b.patient.id));
  const tiers = scope === 'all' ? TIERS : [scope];
  const stages: Cell[][] = [];
  for (const c of ordered) for (const tier of tiers) { const s = stageAt(c, tier); if (s) stages.push(stageRow(c, s)); }
  const withCbac = scope === 'all' || scope === 'asha' || scope === 'phc';
  const sheets: Sheet[] = [];
  if (scope === 'all') sheets.push({ name: 'Overview', rows: [OVERVIEW_HEAD, ...ordered.map(overviewRow)] });
  sheets.push({ name: scope === 'all' ? 'Stages (all tiers)' : `${TIER_NAME[scope]} cases`, rows: [STAGE_HEAD, ...stages] });
  if (withCbac) sheets.push({ name: 'CBAC screening', rows: [CBAC_HEAD, ...ordered.map(cbacRow).filter((r): r is Cell[] => !!r)] });
  sheets.push({ name: 'Timeline', rows: [TIMELINE_HEAD, ...ordered.flatMap(c => timelineRows(c, scope))] });
  sheets.push({ name: 'Reports', rows: [REPORT_HEAD, ...ordered.flatMap(c => reportRows(c, scope))] });
  return sheets;
}

export function exportReport(cases: CaseRecord[], scope: ReportScope): void {
  const label = scope === 'all' ? 'Program' : TIER_NAME[scope];
  downloadXlsx(`CareLink-${label}-report-${today()}.xlsx`, buildReport(cases, scope));
}

/** One patient's complete record, as the tier looking at it is allowed to see it: a summary sheet, then the details. */
export function buildPatientReport(c: CaseRecord, scope: ReportScope): Sheet[] {
  const r = c.referral;
  const cb = r.screening?.cbac;
  const withCbac = scope === 'all' || scope === 'asha' || scope === 'phc';
  const tiers = scope === 'all' ? TIERS : [scope];
  const rows: Cell[][] = [['Field', 'Value']];
  const add = (field: string, value: Cell) => { if (value !== undefined && value !== null && value !== '') rows.push([field, value]); };
  add('Report covers', scope === 'all' ? 'All care levels' : `${TIER_NAME[scope]} only`);
  add('Report made on', dateTime(new Date().toISOString()));
  add('Patient ID', c.patient.id); add('Name', c.patient.name); add('Age', c.patient.age); add('Sex', c.patient.sex);
  add('Phone', c.patient.phone); add('Village / locality', c.patient.locality); add('PIN code', c.patient.pincode);
  add('Referral ID', r.id); add('Unit', (r.unit || 'a').toUpperCase()); add('Urgency', r.urgency); add('Referral date', r.referralDate);
  add('Referral reason', r.reason); add('Destination facility', r.destinationFacility); add('Registered by', r.referringWorker);
  if (scope === 'all') { add('Current level', TIER_NAME[r.tier || 'asha']); add('Care path', tiersVisited(c).map(t => TIER_NAME[t]).join(' > ')); }
  add('Earlier linked case', r.linkedReferralId);
  if (withCbac && cb) {
    add('CBAC Part A score (of 12)', cb.partA.totalScore); add('High NCD risk', yesNo(cb.highRiskNcd));
    add('Symptoms reported', Object.entries(cb.partB?.symptoms ?? {}).filter(([, yes]) => yes).map(([id]) => SYMPTOM_LABEL.get(id) ?? id).join('; '));
    add('PHQ-2 score (of 6)', cb.partD?.totalScore);
  }
  for (const tier of tiers) {
    const s = stageAt(c, tier);
    if (!s) continue;
    const label = TIER_NAME[tier];
    add(`${label}: arrived`, dateTime(s.arrived));
    add(`${label}: appointment`, s.visit.appointmentDate ?? s.facility?.appointmentDate);
    if (tier !== 'asha') add(`${label}: attendance`, ATTENDANCE[s.visit.attendance ?? s.facility?.attendance ?? 'unknown']);
    add(`${label}: oral cavity findings`, s.exam?.oralCavityFindings); add(`${label}: general findings`, s.exam?.generalFindings);
    if (tier === 'dh' || tier === 'tcc') add(`${label}: DH notes`, s.dhNotes);
    if (tier === 'tcc') add(`${label}: TCC notes`, s.tccNotes);
    add(`${label}: reports attached`, reportsAt(c, tier).length || '');
    if (s.left) add(`${label}: referred on to`, `${TIER_NAME[s.left.toTier]} on ${dateTime(s.left.at)}`);
  }
  if (scope === 'all' || scope === 'tcc' || scope === 'asha') { add('Next ASHA follow-up', r.ashaFollowUpDate); add('Instructions for ASHA', r.ashaFollowUpNote); }
  return [{ name: 'Patient summary', rows }, ...buildReport([c], scope).filter(s => s.name !== 'Overview')];
}

export function exportPatientReport(c: CaseRecord, scope: ReportScope): void {
  const label = scope === 'all' ? 'all-levels' : TIER_NAME[scope];
  downloadXlsx(`CareLink-${c.patient.id}-${label}-${today()}.xlsx`, buildPatientReport(c, scope));
}

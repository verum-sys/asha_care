export type SyncStatus = 'pending' | 'synced';
export type Sex = 'F' | 'M' | 'O';
export type Urgency = 'routine' | 'soon' | 'urgent';
export type Intention = 'will_attend' | 'unsure' | 'will_not_attend';
export type FacilityResponse = 'none' | 'received' | 'accepted' | 'declined' | 'info_requested';
export type Attendance = 'unknown' | 'attended' | 'not_attended';

export interface Patient {
  id: string; // human-readable, e.g. CL-0001
  name: string;
  age?: number;
  sex?: Sex;
  phone?: string;
  locality?: string;
  /** 6-digit Indian PIN code of the patient's location. */
  pincode?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export type AppointmentCertainty = 'confirmed' | 'tentative';

/** Facts the frontline worker learned themselves (phone call, home visit). Owned by the frontline device. */
export interface WorkerFacts {
  facilityResponse?: FacilityResponse;
  appointmentDate?: string;
  appointmentCertainty?: AppointmentCertainty;
  attendance?: Attendance;
  attendedDate?: string;
  outcomeRecorded?: boolean;
  outcomeNote?: string;
}

export interface FacilityNote {
  at: string;
  text: string;
}

/** Facts confirmed by the receiving facility. Owned by the facility; pulled to the field on sync. */
export interface FacilityFacts {
  response: FacilityResponse;
  appointmentDate?: string;
  attendance: Attendance;
  completed: boolean;
  followUpRequired: boolean;
  followUpPlan?: string;
  notes: FacilityNote[];
  updatedAt?: string;
}

export type CareTier = 'asha' | 'phc' | 'dh' | 'tcc';
export type CareUnit = 'a' | 'b' | 'c';

export interface PhysicalExamNotes {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  spo2?: number;
  temperature?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  generalFindings?: string;
  systemicExam?: string;
  oralCavityFindings?: string;
  breastExamFindings?: string;
  cervicalExamFindings?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface ReportAttachment {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: 'general' | 'biopsy' | 'radiology';
  uploadedAt: string;
  uploadedBy: string;
  findings?: string;
  /** The care tier holding the case when the report was attached. */
  tier?: CareTier;
  /** AI draft summary of the report text, kept apart from the findings a clinician typed. */
  aiSummary?: string;
  aiSummaryAt?: string;
  /** How the report text was read for the summary: embedded PDF text, or OCR of a scanned page. */
  aiSummarySource?: 'text' | 'ocr';
  /** Structured values the AI read from the report (fixed fields per report type), reviewed by the doctor. */
  aiFields?: ReportFields;
  /** For lab reports: each test with its value, unit, reference range and flag. */
  aiTests?: LabTest[];
  /** One or two lines in plain words (no medical terms), for the next care team's overview. */
  aiPlain?: string;
  fileUrl?: string;
  dataUrl?: string;
}

/** Fixed fields per report type. Lab reports list their tests; every other value is text, "Not stated" when absent. */
export type ReportFields = Record<string, string>;
export interface LabTest { name: string; value: string; unit?: string; range?: string; flag?: 'high' | 'low' | 'abnormal' | 'normal' | '' }

/** One vitals check: taken at every visit, at every tier, with its time. */
export interface VitalsCheck {
  at: string;
  tier: CareTier;
  values: Partial<Record<'bpSystolic' | 'bpDiastolic' | 'pulseRate' | 'spo2' | 'temperature' | 'weightKg' | 'heightCm' | 'bmi', number>>;
  recordedBy?: string;
}

export interface TierNote {
  id: string;
  tier: CareTier;
  unit: CareUnit;
  author: string;
  text: string;
  category?: 'clinical' | 'tumor_board' | 'multidisciplinary' | 'staging' | 'general';
  at: string;
}

export interface ClinicalHandover {
  fromTier: CareTier;
  toTier: CareTier;
  at: string;
  physicalExam?: PhysicalExamNotes;
  notes?: string;
  dhNotes?: string;
  aiSummary?: string;
  visitStatus?: WorkerFacts;
  facilityStatus?: FacilityFacts;
  /** Structured overview handed to the next facility: exam values and each report's key values (PHC: lab; DH: lab, biopsy, radiology, other). */
  structuredSummary?: StructuredSummary;
}

export interface StructuredReport { id: string; category: ReportAttachment['category']; title: string; fields?: ReportFields; tests?: LabTest[]; plain?: string; findings?: string }
export interface StructuredSummary { exam: { label: string; value: string }[]; vitalsAt?: string; reports: StructuredReport[] }

export interface Referral {
  id: string;
  patientId: string;
  referringWorker: string;
  reason: string;
  destinationFacility: string;
  referralDate: string; // yyyy-mm-dd
  urgency: Urgency;
  notes: string;
  patientIntention?: Intention;
  screening?: ScreeningInfo;
  worker: WorkerFacts;
  facility: FacilityFacts;
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
  /** Next appointment given by TCC when it closes the loop; the only TCC detail shown to ASHA for follow-up. */
  ashaFollowUpDate?: string;
  /** Instructions TCC writes for ASHA when sending the patient back for follow-up (back referral). */
  ashaFollowUpNote?: string;
  /** For a patient who came straight to DH or TCC: the earlier referral of the same person, when one was traced. */
  linkedReferralId?: string;
  /** The PHC the patient belongs to (picked from the PIN code at DH/TCC registration); its unit is the case unit. */
  mappedPhc?: string;
  /** Why the next appointment was given, when something could not happen (sent back to ASHA with the date). */
  ashaFollowUpReason?: string;
  /** Something went wrong (missed visit, could not happen): ASHA should act now. */
  ashaAlert?: string;
  /** Which tier sent the patient back to ASHA (counter-referral), and when. */
  backReferredFrom?: CareTier;
  backReferredAt?: string;
  /** Every vitals check, at every visit and tier, newest last. */
  vitalsLog?: VitalsCheck[];
  /** Ready-made demo case (hidden marker, so demo cases can be replaced). */
  demo?: string;
  /** Hidden from every list (replaced demo cases). Kept instead of deleted, because sync only adds and updates. */
  archived?: boolean;
  clinicalHandovers?: ClinicalHandover[];
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
}

export type FollowUpAction =
  | 'contacted_patient'
  | 'unable_to_reach'
  | 'appointment_confirmed'
  | 'rescheduled'
  | 'facility_contacted'
  | 'info_sent_to_facility'
  | 'patient_attended'
  | 'patient_not_attended'
  | 'outcome_recorded'
  | 'referral_sent'
  | 'details_completed'
  | 'returned_to_asha'
  | 'other';

export interface FollowUp {
  id: string;
  referralId: string;
  at: string;
  action: FollowUpAction;
  note?: string;
  data?: { date?: string; response?: FacilityResponse; intention?: Intention; tier?: CareTier; attendance?: Attendance };
  /** The action key the Small AI suggested at the time; lets the timeline show worker overrides. */
  suggestedAction?: ActionKey;
  syncStatus: SyncStatus;
}

export interface SyncEvent {
  id: string;
  at: string;
  direction: 'push' | 'pull';
  summary: string;
  referralIds: string[];
}

export interface OutboxItem {
  id: string;
  entity: 'patient' | 'referral' | 'followup';
  entityId: string;
  at: string;
}

/** Facility-side events recorded on the (simulated) server, shown in timelines after sync. */
export interface FacilityEvent {
  id: string;
  referralId: string;
  at: string;
  kind: 'acknowledged' | 'accepted' | 'declined' | 'info_requested' | 'scheduled' | 'attended' | 'not_attended' | 'completed' | 'note';
  text?: string;
}

// ---------- Case stage (briefing workflow; distinct from CareStateKey until UI merge) ----------

export type CaseStageKey =
  | 'initial_assessment'
  | 'initial_care_no_referral'
  | 'referral_initiated'
  | 'referral_accepted'
  | 'appointment_scheduled'
  | 'follow_up_due'
  | 'completed';

export type FieldDisplayStatus =
  | 'known'
  | 'tentative'
  | 'pending'
  | 'unknown'
  | 'not_applicable'
  | 'completed'
  | 'missed'
  | 'not_assessed';

export type ReferralDecision = 'referred' | 'none';

export type ScreeningArea = 'oral' | 'breast' | 'cervical' | 'ncd';
export type ScreeningFinding = 'positive' | 'negative' | 'needs_review';
export type ReferralRequiredAnswer = 'yes' | 'no';

/** Frontline screening at first contact (before or alongside referral). */
export interface ScreeningInfo {
  completed: boolean;
  area?: ScreeningArea;
  finding?: ScreeningFinding;
  referralRequired?: ReferralRequiredAnswer;
  cbac?: import('../intelligence/cbacTypes.js').CbacAssessment;
}

export type DraftFieldKey =
  | 'caseStage'
  | 'referralDecision'
  | 'screeningCompleted'
  | 'screeningArea'
  | 'screeningFinding'
  | 'referralRequired'
  | 'name'
  | 'age'
  | 'phone'
  | 'locality'
  | 'reason'
  | 'destinationFacility'
  | 'referralDate'
  | 'urgency'
  | 'facilityResponse'
  | 'appointmentDate'
  | 'attendance'
  | 'patientIntention';

export interface DraftFieldRow {
  key: DraftFieldKey;
  labelKey: string;
  displayValue?: string;
  displayValueKey?: string;
  status: FieldDisplayStatus;
}

export interface StageExpectations {
  complete: DraftFieldKey[];
  pending: DraftFieldKey[];
  notApplicable: DraftFieldKey[];
}

// ---------- Intelligence ----------

export type CareStateKey =
  | 'incomplete'
  | 'not_sent'
  | 'awaiting_facility'
  | 'info_requested'
  | 'declined'
  | 'accepted_no_appt'
  | 'scheduled'
  | 'appt_passed_unknown'
  | 'not_attended'
  | 'attended_outcome_unknown'
  | 'follow_up_required'
  | 'closed';

export type FactState = 'known' | 'unknown' | 'missing' | 'na';
export type FactSource = 'facility' | 'worker' | 'patient';

export interface FactRow {
  key: string; // i18n key under fact.*
  value?: string; // display value (already a key or raw text; see valueKey)
  valueKey?: string; // i18n key for the value, preferred over value
  state: FactState;
  source?: FactSource;
}

export type ActionKey =
  | 'complete_details'
  | 'send_referral'
  | 'confirm_referral'
  | 'send_info'
  | 'find_alternative'
  | 'confirm_appointment'
  | 'remind_patient'
  | 'check_attendance'
  | 'visit_home'
  | 'reschedule'
  | 'record_outcome'
  | 'plan_follow_up'
  | 'resolve_conflict'
  | 'none';

export interface Issue {
  key: string; // i18n key under issue.*
  params?: Record<string, string | number>;
}

export interface Intelligence {
  careState: CareStateKey;
  facts: FactRow[];
  missing: Issue[];
  unresolved: Issue[];
  contradictions: Issue[];
  action: ActionKey;
  reason: Issue;
  priority: number;
  /** Days until (negative = overdue) the next relevant date, if any. */
  dueInDays?: number;
  open: boolean;
}

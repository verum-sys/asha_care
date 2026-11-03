import type { CbacAssessment } from '../intelligence/cbacTypes';
import { addDays } from '../intelligence/dates';
import { textPdfDataUrl } from '../export/simplePdf';
import { emptyFacility } from './factory';
import { addPreparedCase, listCases } from './repo';
import type { CareUnit, ClinicalHandover, FollowUp, Patient, PhysicalExamNotes, Referral, ReportAttachment, WorkerFacts } from './types';

/**
 * Three ready-made patients at TCC for demos, one per scenario from the clinician call:
 * detected early through ASHA screening, detected at a later stage after missed visits, and missed by screening
 * altogether (came straight to TCC). Names end in "(demo)" so nobody mistakes them for real patients.
 */
export const DEMO_NAMES = ['Meena Devi (demo)', 'Ramesh Oraon (demo)', 'Kamla Bai (demo)'] as const;

const at = (day: string, hour: number) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function cbac(p: { name: string; age: number; sex: 'F' | 'M'; village: string; date: string; ageScore: number; smokeScore: number; alcoholScore: number; waistScore: number; activityScore: number; familyHistoryScore: number; symptoms?: Record<string, boolean> }): CbacAssessment {
  const total = p.ageScore + p.smokeScore + p.alcoholScore + p.waistScore + p.activityScore + p.familyHistoryScore;
  const symptoms = p.symptoms ?? {};
  return {
    general: { date: p.date, ashaName: 'ASHA (demo)', mpwAnmName: '', villageWard: p.village, subCentre: '', phcUphc: 'PHC Itki', name: p.name, age: p.age, sex: p.sex, address: p.village, identifierType: '', identifierNumber: '', hasStateInsurance: false, insuranceDetails: '', phone: '', phoneOwner: '', hasDisability: false, disabilityDetails: '' },
    partA: { ageScore: p.ageScore, smokeScore: p.smokeScore, alcoholScore: p.alcoholScore, waistScore: p.waistScore, physicalActivityScore: p.activityScore, familyHistoryScore: p.familyHistoryScore, totalScore: total },
    partB: { symptoms }, partC: { cookingFuel: ['firewood'], occupationalExposure: [] }, partD: { phq1Score: 0, phq2Score: 0, totalScore: 0 },
    highRiskNcd: total > 4, symptomAlert: Object.values(symptoms).some(Boolean), tbSuspectAlert: false, tbContactAlert: false, mentalHealthAlert: false,
    completedAt: at(p.date, 5),
  };
}

function report(id: string, category: ReportAttachment['category'], title: string, day: string, by: string, lines: string[], findings: string): ReportAttachment {
  const dataUrl = textPdfDataUrl(title, ['Demo report - synthetic data for CareLink demonstrations.', '', ...lines]);
  return { id, category, title, fileName: `${title.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, fileSize: `${Math.max(1, Math.round(dataUrl.length * 0.75 / 1024))} KB`, fileType: 'application/pdf', uploadedAt: at(day, 9), uploadedBy: by, findings, dataUrl, tier: 'dh' };
}

function handover(fromTier: ClinicalHandover['fromTier'], toTier: ClinicalHandover['toTier'], when: string, visit: WorkerFacts, exam?: PhysicalExamNotes, notes?: string, dhNotes?: string): ClinicalHandover {
  return { fromTier, toTier, at: when, visitStatus: visit, physicalExam: exam, notes, dhNotes, facilityStatus: emptyFacility() };
}

type Built = { patient: Patient; referral: Referral; followUps: FollowUp[] };

/** The three scenarios, dated relative to today; the TCC appointment is today so attendance can be recorded live. */
export function buildDemoScenarios(today: string, unit: CareUnit): ((ids: { patientId: string; referralId: string }) => Built)[] {
  const d = (n: number) => addDays(today, n);
  const fu = (key: string, when: string, action: FollowUp['action'], note: string, data?: FollowUp['data']): FollowUp => ({ id: `fu-demo-${key}-${when}`, referralId: '', at: when, action, note, data, syncStatus: 'pending' });

  const early = ({ patientId, referralId }: { patientId: string; referralId: string }): Built => {
    const created = at(d(-45), 5);
    const patient: Patient = { id: patientId, name: DEMO_NAMES[0], age: 46, sex: 'F', locality: 'Bero village', pincode: '835205', createdAt: created, updatedAt: created, syncStatus: 'pending' };
    const phcExam: PhysicalExamNotes = { bpSystolic: 128, bpDiastolic: 82, pulseRate: 78, weightKg: 54, heightCm: 152, bmi: 23.4, generalFindings: 'Alert, well. Chews tobacco daily for 20 years.', oralCavityFindings: 'White patch 1.5 cm on left buccal mucosa, does not scrape off. No ulcer. No neck nodes.', recordedAt: at(d(-40), 6), recordedBy: 'Medical Officer (PHC)' };
    const dhExam: PhysicalExamNotes = { bpSystolic: 126, bpDiastolic: 80, pulseRate: 76, oralCavityFindings: 'Homogeneous leukoplakia 1.5 x 1 cm, left buccal mucosa, soft. Neck: no palpable nodes.', recordedAt: at(d(-30), 6), recordedBy: 'Specialist (DH)' };
    const biopsy = report(`att-demo-bx-early-${referralId}`, 'biopsy', 'Incisional biopsy - left buccal mucosa', d(-24), 'DH Pathology', [
      `Patient: ${DEMO_NAMES[0]}, 46 F. Specimen: incisional biopsy, left buccal mucosa.`,
      'Gross: single grey-white tissue piece, 0.8 x 0.5 cm.',
      'Microscopy: hyperkeratotic stratified squamous epithelium showing moderate epithelial dysplasia, with loss of polarity and increased mitoses in the lower half.',
      'No evidence of invasion. Basement membrane intact.',
      'Impression: Leukoplakia with moderate epithelial dysplasia. No invasive carcinoma seen.',
    ], 'Moderate epithelial dysplasia. No invasive carcinoma.');
    const referral: Referral = {
      id: referralId, patientId, referringWorker: 'ASHA (demo scenario)', reason: 'White patch in mouth, daily tobacco use (CBAC 6/12)', destinationFacility: 'TCC', referralDate: d(-45), urgency: 'soon',
      notes: 'Scenario: detected early through ASHA screening.', patientIntention: 'will_attend',
      screening: { completed: true, area: 'oral', finding: 'positive', referralRequired: 'yes', cbac: cbac({ name: DEMO_NAMES[0], age: 46, sex: 'F', village: 'Bero village', date: d(-45), ageScore: 2, smokeScore: 2, alcoholScore: 0, waistScore: 1, activityScore: 1, familyHistoryScore: 0 }) },
      worker: { appointmentDate: today }, facility: emptyFacility(), tier: 'tcc', unit,
      dhNotes: 'Biopsy: moderate dysplasia, no invasion. Early lesion; referred to TCC for excision and surveillance plan.',
      biopsyReports: [biopsy],
      clinicalHandovers: [
        handover('asha', 'phc', at(d(-45), 6), { appointmentDate: d(-40) }),
        handover('phc', 'dh', at(d(-40), 8), { appointmentDate: d(-40), attendance: 'attended', attendedDate: d(-40) }, phcExam, 'Leukoplakia, left buccal mucosa. Needs biopsy.'),
        handover('dh', 'tcc', at(d(-23), 8), { appointmentDate: d(-30), attendance: 'attended', attendedDate: d(-30) }, dhExam, 'Leukoplakia with moderate dysplasia.', 'Biopsy: moderate dysplasia, no invasion. Early lesion; referred to TCC for excision and surveillance plan.'),
      ],
      createdAt: created, updatedAt: at(d(-23), 8), syncStatus: 'pending',
    };
    return { patient, referral, followUps: [
      fu('early', at(d(-45), 6), 'referral_sent', `Escalated case to PHC: PHC Itki. Appointment ${d(-40)}.`),
      fu('early', at(d(-40), 7), 'other', 'PHC visit: attended. White patch examined.', { tier: 'phc', attendance: 'attended', date: d(-40) }),
      fu('early', at(d(-40), 8), 'referral_sent', `Escalated case to DH. Appointment ${d(-30)}.`),
      fu('early', at(d(-30), 7), 'other', 'DH visit: attended. Incisional biopsy taken.', { tier: 'dh', attendance: 'attended', date: d(-30) }),
      fu('early', at(d(-24), 9), 'details_completed', 'Attached biopsy report: moderate dysplasia, no invasion.'),
      fu('early', at(d(-23), 8), 'referral_sent', `Escalated case to TCC. Appointment ${today}.`),
    ] };
  };

  const late = ({ patientId, referralId }: { patientId: string; referralId: string }): Built => {
    const created = at(d(-150), 5);
    const patient: Patient = { id: patientId, name: DEMO_NAMES[1], age: 58, sex: 'M', locality: 'Itki village', pincode: '835217', createdAt: created, updatedAt: created, syncStatus: 'pending' };
    const phcExam: PhysicalExamNotes = { bpSystolic: 138, bpDiastolic: 88, pulseRate: 84, weightKg: 51, heightCm: 165, bmi: 18.7, generalFindings: 'Weight loss over 3 months. Smokes bidi and chews gutkha.', oralCavityFindings: 'Ulcero-proliferative growth 3 cm, right buccal mucosa. Mouth opening 2 fingers. Firm right neck node 2 cm.', recordedAt: at(d(-75), 6), recordedBy: 'Medical Officer (PHC)' };
    const dhExam: PhysicalExamNotes = { bpSystolic: 136, bpDiastolic: 86, pulseRate: 82, weightKg: 50, oralCavityFindings: 'Growth 4 cm right buccal mucosa extending to retromolar area. Trismus. Right level Ib node 2 cm, firm, mobile.', recordedAt: at(d(-60), 6), recordedBy: 'Specialist (DH)' };
    const biopsy = report(`att-demo-bx-late-${referralId}`, 'biopsy', 'Punch biopsy - right buccal mucosa', d(-55), 'DH Pathology', [
      `Patient: ${DEMO_NAMES[1]}, 58 M. Specimen: punch biopsy, right buccal mucosa growth.`,
      'Microscopy: invasive squamous cell carcinoma, moderately differentiated, with keratin pearls.',
      'Depth of invasion: 9 mm. Perineural invasion present. Lymphovascular invasion not identified in this sample.',
      'Impression: Moderately differentiated squamous cell carcinoma, right buccal mucosa.',
    ], 'Moderately differentiated squamous cell carcinoma. Depth of invasion 9 mm, perineural invasion present.');
    const ct = report(`att-demo-ct-late-${referralId}`, 'radiology', 'CECT face and neck', d(-52), 'DH Radiology', [
      `Patient: ${DEMO_NAMES[1]}, 58 M. Study: contrast CT, face and neck.`,
      'Enhancing mass 4.2 x 3.1 cm, right buccal mucosa, reaching the retromolar trigone. Adjacent mandible cortex intact.',
      'Right level Ib lymph node 2.1 cm, necrotic centre. No contralateral nodes.',
      'Impression: Right buccal mucosa malignancy with ipsilateral nodal disease.',
    ], 'Mass 4.2 cm right buccal mucosa to retromolar trigone; right level Ib node 2.1 cm; mandible intact.');
    const referral: Referral = {
      id: referralId, patientId, referringWorker: 'ASHA (demo scenario)', reason: 'Non-healing mouth ulcer, difficulty opening mouth (CBAC 8/12)', destinationFacility: 'TCC', referralDate: d(-150), urgency: 'urgent',
      notes: 'Scenario: detected at a later stage after two missed PHC appointments.', patientIntention: 'will_attend',
      screening: { completed: true, area: 'oral', finding: 'positive', referralRequired: 'yes', cbac: cbac({ name: DEMO_NAMES[1], age: 58, sex: 'M', village: 'Itki village', date: d(-150), ageScore: 3, smokeScore: 2, alcoholScore: 1, waistScore: 1, activityScore: 1, familyHistoryScore: 0, symptoms: { mouth_ulcers_unhealed: true, difficulty_opening_mouth: true } }) },
      worker: { appointmentDate: today }, facility: emptyFacility(), tier: 'tcc', unit,
      dhNotes: 'Advanced lesion with neck node (clinically T3 N1). Delayed presentation: missed two PHC appointments before reaching care.',
      biopsyReports: [biopsy], radiologyReports: [ct],
      clinicalHandovers: [
        handover('asha', 'phc', at(d(-150), 6), { appointmentDate: d(-143) }),
        handover('phc', 'dh', at(d(-75), 8), { appointmentDate: d(-75), attendance: 'attended', attendedDate: d(-75) }, phcExam, 'Suspicious growth with neck node. Urgent DH review.'),
        handover('dh', 'tcc', at(d(-50), 8), { appointmentDate: d(-60), attendance: 'attended', attendedDate: d(-60) }, dhExam, 'SCC right buccal mucosa with nodal disease.', 'Advanced lesion with neck node (clinically T3 N1). Delayed presentation: missed two PHC appointments before reaching care.'),
      ],
      createdAt: created, updatedAt: at(d(-50), 8), syncStatus: 'pending',
    };
    return { patient, referral, followUps: [
      fu('late', at(d(-150), 6), 'referral_sent', `Escalated case to PHC: PHC Itki. Appointment ${d(-143)}.`),
      fu('late', at(d(-142), 6), 'patient_not_attended', 'Did not go to PHC. Said he could not leave work.', { tier: 'phc', attendance: 'not_attended' }),
      fu('late', at(d(-140), 6), 'rescheduled', `New PHC date ${d(-120)}.`, { date: d(-120) }),
      fu('late', at(d(-119), 6), 'patient_not_attended', 'Missed the second PHC date. Worried about cost.', { tier: 'phc', attendance: 'not_attended' }),
      fu('late', at(d(-90), 6), 'contacted_patient', 'ASHA home visit: counselled the family; free treatment explained.'),
      fu('late', at(d(-88), 6), 'rescheduled', `New PHC date ${d(-75)}.`, { date: d(-75) }),
      fu('late', at(d(-75), 7), 'other', 'PHC visit: attended. Growth and neck node found.', { tier: 'phc', attendance: 'attended', date: d(-75) }),
      fu('late', at(d(-75), 8), 'referral_sent', `Escalated case to DH. Appointment ${d(-60)}.`),
      fu('late', at(d(-60), 7), 'other', 'DH visit: attended. Biopsy and CT ordered.', { tier: 'dh', attendance: 'attended', date: d(-60) }),
      fu('late', at(d(-52), 9), 'details_completed', 'Attached biopsy and CT reports.'),
      fu('late', at(d(-50), 8), 'referral_sent', `Escalated case to TCC. Appointment ${today}.`),
    ] };
  };

  const missed = ({ patientId, referralId }: { patientId: string; referralId: string }): Built => {
    const created = at(today, 4);
    const patient: Patient = { id: patientId, name: DEMO_NAMES[2], age: 62, sex: 'F', locality: 'Mandar village', pincode: '835214', createdAt: created, updatedAt: created, syncStatus: 'pending' };
    const referral: Referral = {
      id: referralId, patientId, referringWorker: 'Walk-in at TCC (demo scenario)', reason: 'Non-healing ulcer on tongue for 3 months, pain while eating, weight loss', destinationFacility: 'TCC (walk-in)', referralDate: today, urgency: 'urgent',
      notes: 'Walk-in at TCC: came directly (not referred by ASHA). Scenario: missed by community screening; no CBAC on record. Send back to her ASHA for follow-up.',
      worker: { appointmentDate: today }, facility: emptyFacility(), tier: 'tcc', unit,
      createdAt: created, updatedAt: created, syncStatus: 'pending',
    };
    return { patient, referral, followUps: [fu('missed', at(today, 4), 'other', 'Registered as a walk-in at TCC. Never screened in the community.')] };
  };

  return [early, late, missed];
}

/** Adds the demo scenarios that are not there yet. Returns how many were added. */
export async function addDemoScenarios(today: string, unit: CareUnit): Promise<number> {
  const existing = new Set((await listCases()).map(c => c.patient.name));
  const builders = buildDemoScenarios(today, unit);
  let added = 0;
  for (const [i, build] of builders.entries()) {
    if (existing.has(DEMO_NAMES[i])) continue;
    await addPreparedCase(build);
    added++;
  }
  return added;
}

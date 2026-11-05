import type { CbacAssessment } from '../intelligence/cbacTypes';
import { addDays } from '../intelligence/dates';
import { textPdfDataUrl } from '../export/simplePdf';
import { buildStructuredSummary } from '../intelligence/structuredSummary';
import { addVitalsCheck } from '../intelligence/vitals';
import { emptyFacility } from './factory';
import { addPreparedCase, archiveCases, listCases } from './repo';
import type { CareUnit, ClinicalHandover, FollowUp, Patient, PhysicalExamNotes, Referral, ReportAttachment, VitalsCheck, WorkerFacts } from './types';

/**
 * Two ready-made patients for the demo video, one per path from the clinician call:
 * 1. Referral (ideal path): screened by ASHA, seen at PHC and DH, now at TCC.
 * 2. Direct: never screened, walked straight into TCC; mapped to her PHC and ASHA by PIN code.
 * They look like ordinary records; a hidden `demo` marker lets "Set up demo cases" replace them later.
 */
export const DEMO_VERSION = 'v2';
export const DEMO_NAMES = ['Meena Devi', 'Kamla Bai'] as const;

const at = (day: string, hour: number, minute = 0) => `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

function cbac(p: { name: string; age: number; sex: 'F' | 'M'; village: string; pincode: string; date: string; ageScore: number; smokeScore: number; alcoholScore: number; waistScore: number; activityScore: number; familyHistoryScore: number; symptoms?: Record<string, boolean> }): CbacAssessment {
  const total = p.ageScore + p.smokeScore + p.alcoholScore + p.waistScore + p.activityScore + p.familyHistoryScore;
  const symptoms = p.symptoms ?? {};
  return {
    general: { date: p.date, ashaName: 'Sunita Kumari', mpwAnmName: '', villageWard: p.village, subCentre: 'Bero', phcUphc: 'PHC Bero', name: p.name, age: p.age, sex: p.sex, address: p.village, pincode: p.pincode, identifierType: '', identifierNumber: '', hasStateInsurance: false, insuranceDetails: '', phone: '', phoneOwner: '', hasDisability: false, disabilityDetails: '' },
    partA: { ageScore: p.ageScore, smokeScore: p.smokeScore, alcoholScore: p.alcoholScore, waistScore: p.waistScore, physicalActivityScore: p.activityScore, familyHistoryScore: p.familyHistoryScore, totalScore: total },
    partB: { symptoms }, partC: { cookingFuel: ['firewood'], occupationalExposure: [] }, partD: { phq1Score: 0, phq2Score: 0, totalScore: 0 },
    highRiskNcd: total > 4, symptomAlert: Object.values(symptoms).some(Boolean), tbSuspectAlert: false, tbContactAlert: false, mentalHealthAlert: false,
    completedAt: at(p.date, 5),
  };
}

function report(id: string, tier: ReportAttachment['tier'], category: ReportAttachment['category'], title: string, heading: string, day: string, by: string, lines: string[], extra: Partial<ReportAttachment>): ReportAttachment {
  const dataUrl = textPdfDataUrl(title, [heading, '', ...lines]);
  return { id, category, title, fileName: `${title.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, fileSize: `${Math.max(1, Math.round(dataUrl.length * 0.75 / 1024))} KB`, fileType: 'application/pdf', uploadedAt: at(day, 9), uploadedBy: by, dataUrl, tier, ...extra };
}

const examAt = (exam: PhysicalExamNotes, when: string, by: string): PhysicalExamNotes => ({ ...exam, recordedAt: when, recordedBy: by });

function handover(fromTier: ClinicalHandover['fromTier'], toTier: ClinicalHandover['toTier'], when: string, visit: WorkerFacts, source?: Pick<Referral, 'physicalExam' | 'reports' | 'biopsyReports' | 'radiologyReports'>, notes?: string, dhNotes?: string): ClinicalHandover {
  return { fromTier, toTier, at: when, visitStatus: visit, physicalExam: source?.physicalExam, notes, dhNotes, facilityStatus: emptyFacility(), structuredSummary: source ? buildStructuredSummary(source, fromTier) : undefined };
}

type Built = { patient: Patient; referral: Referral; followUps: FollowUp[] };

/** Dated relative to today; the TCC visit is today so it can be shown live. */
export function buildDemoScenarios(today: string, unit: CareUnit = 'a'): ((ids: { patientId: string; referralId: string }) => Built)[] {
  const d = (n: number) => addDays(today, n);
  const fu = (key: string, when: string, action: FollowUp['action'], note: string, data?: FollowUp['data']): FollowUp => ({ id: `fu-demo-${key}-${when}`, referralId: '', at: when, action, note, data, syncStatus: 'pending' });

  const referred = ({ patientId, referralId }: { patientId: string; referralId: string }): Built => {
    const created = at(d(-45), 5);
    const patient: Patient = { id: patientId, name: DEMO_NAMES[0], age: 46, sex: 'F', locality: 'Bero village', pincode: '835205', createdAt: created, updatedAt: created, syncStatus: 'pending' };
    const phcExam = examAt({ bpSystolic: 128, bpDiastolic: 82, pulseRate: 78, spo2: 98, weightKg: 54, heightCm: 152, bmi: 23.4, generalFindings: 'Alert, well. Chews tobacco daily for 20 years.', oralCavityFindings: 'White patch 1.5 cm on the left inner cheek; does not scrape off. No ulcer. No neck lumps.' }, at(d(-40), 5, 20), 'Medical Officer (PHC)');
    const dhExam = examAt({ bpSystolic: 126, bpDiastolic: 80, pulseRate: 76, spo2: 99, weightKg: 54, oralCavityFindings: 'Raised white patch 1.5 x 1 cm, left buccal mucosa, firm at one edge. Neck: no palpable nodes.' }, at(d(-30), 6, 10), 'Specialist (DH)');
    const cbc = report(`att-demo-cbc-${referralId}`, 'phc', 'general', 'Complete blood count', 'PHC Bero - Laboratory', d(-40), 'PHC laboratory', [
      'Haemoglobin 10.8 g/dL (13.0 - 17.0) LOW', 'Total leucocyte count 8,900 /cu mm (4,000 - 11,000)', 'Platelets 2.6 lakh/cu mm (1.5 - 4.5)', 'Fasting blood sugar 96 mg/dL (70 - 100)',
    ], { findings: 'Mild anaemia (Hb 10.8). Other values normal.', aiFields: { 'Report type': 'Complete blood count', 'Abnormal results': 'Haemoglobin 10.8 g/dL (low)', 'Comment': 'Not stated' }, aiTests: [{ name: 'Haemoglobin', value: '10.8', unit: 'g/dL', range: '13.0 - 17.0', flag: 'low' }, { name: 'Total leucocyte count', value: '8,900', unit: '/cu mm', range: '4,000 - 11,000', flag: 'normal' }, { name: 'Platelets', value: '2.6', unit: 'lakh/cu mm', range: '1.5 - 4.5', flag: 'normal' }, { name: 'Fasting blood sugar', value: '96', unit: 'mg/dL', range: '70 - 100', flag: 'normal' }], aiPlain: 'Blood is slightly low (mild anaemia). Everything else in the blood test is normal.' });
    const biopsy = report(`att-demo-bx-${referralId}`, 'dh', 'biopsy', 'Incisional biopsy - left buccal mucosa', 'District Hospital - Department of Pathology', d(-24), 'DH pathology', [
      'Specimen: incisional biopsy, left buccal mucosa.', 'Gross: single grey-white tissue piece, 0.8 x 0.5 cm.',
      'Microscopy: stratified squamous epithelium with severe dysplasia and a focus of early invasion.', 'Depth of invasion: 2 mm. Perineural invasion: not seen. Lymphovascular invasion: not seen.',
      'Impression: Well differentiated squamous cell carcinoma, early invasive, left buccal mucosa.', 'Margins: cannot be assessed in an incisional biopsy.',
    ], { findings: 'Early invasive well differentiated SCC, DOI 2 mm.', aiFields: { 'Site': 'Left buccal mucosa', 'Specimen': 'Incisional biopsy', 'Diagnosis (as written)': 'Well differentiated squamous cell carcinoma, early invasive', 'Differentiation / grade': 'Well differentiated', 'Depth of invasion': '2 mm', 'Perineural invasion': 'Not seen', 'Lymphovascular invasion': 'Not seen', 'Margins': 'Cannot be assessed (incisional biopsy)', 'Other points': 'Severe dysplasia around the tumour' }, aiPlain: 'The biopsy shows an early cancer in the left inner cheek. It is small and has not spread into nerves or blood vessels.' });
    const ct = report(`att-demo-ct-${referralId}`, 'dh', 'radiology', 'CT face and neck', 'District Hospital - Department of Radiodiagnosis', d(-26), 'DH radiology', [
      'Study: contrast CT, face and neck.', 'Small enhancing lesion 1.4 x 0.9 cm, left buccal mucosa. No deep spread. Mandible normal.', 'No enlarged lymph nodes in the neck.',
      'Impression: Small left buccal mucosal lesion without bone involvement or nodal disease.',
    ], { findings: '1.4 cm lesion, no bone involvement, no nodes.', aiFields: { 'Study': 'Contrast CT, face and neck', 'Lesion site': 'Left buccal mucosa', 'Lesion size': '1.4 x 0.9 cm', 'Extension': 'No deep spread', 'Bone involvement': 'None (mandible normal)', 'Lymph nodes': 'No enlarged nodes', 'Impression (as written)': 'Small left buccal mucosal lesion without bone involvement or nodal disease', 'Other points': 'Not stated' }, aiPlain: 'The scan shows a small growth in the left cheek. The jaw bone and the glands in the neck look normal.' });
    let vitals: VitalsCheck[] | undefined = addVitalsCheck(undefined, phcExam, 'phc', phcExam.recordedAt!);
    vitals = addVitalsCheck(vitals, dhExam, 'dh', dhExam.recordedAt!);
    const referral: Referral = {
      id: referralId, patientId, referringWorker: 'ASHA Sunita Kumari', reason: 'White patch in mouth, daily tobacco use (CBAC 6/12)', destinationFacility: 'TCC', referralDate: d(-45), urgency: 'soon',
      notes: 'Screened in the village; referred to PHC.', patientIntention: 'will_attend', demo: DEMO_VERSION, mappedPhc: 'PHC Bero',
      screening: { completed: true, area: 'oral', finding: 'positive', referralRequired: 'yes', cbac: cbac({ name: DEMO_NAMES[0], age: 46, sex: 'F', village: 'Bero village', pincode: '835205', date: d(-45), ageScore: 2, smokeScore: 2, alcoholScore: 0, waistScore: 1, activityScore: 1, familyHistoryScore: 0 }) },
      worker: { appointmentDate: today }, facility: emptyFacility(), tier: 'tcc', unit,
      dhNotes: 'Early invasive cancer, small, no nodes on CT. Referred to TCC for treatment.',
      reports: [cbc], biopsyReports: [biopsy], radiologyReports: [ct], vitalsLog: vitals,
      clinicalHandovers: [
        handover('asha', 'phc', at(d(-45), 6), { appointmentDate: d(-40) }, undefined, 'White patch in mouth; chews tobacco.'),
        handover('phc', 'dh', at(d(-40), 8), { appointmentDate: d(-40), attendance: 'attended', attendedDate: d(-40) }, { physicalExam: phcExam, reports: [cbc] }, 'Suspicious white patch; needs biopsy.'),
        handover('dh', 'tcc', at(d(-23), 8), { appointmentDate: d(-30), attendance: 'attended', attendedDate: d(-30) }, { physicalExam: dhExam, reports: [cbc], biopsyReports: [biopsy], radiologyReports: [ct] }, 'Early cancer confirmed on biopsy.', 'Early invasive cancer, small, no nodes on CT. Referred to TCC for treatment.'),
      ],
      createdAt: created, updatedAt: at(d(-23), 8), syncStatus: 'pending',
    };
    return { patient, referral, followUps: [
      fu('ref', at(d(-45), 6), 'referral_sent', `Escalated case to PHC: PHC Bero. Appointment ${d(-40)}.`),
      fu('ref', at(d(-40), 5), 'other', 'PHC visit: attended. Examined; blood test done.', { tier: 'phc', attendance: 'attended', date: d(-40) }),
      fu('ref', at(d(-40), 8), 'referral_sent', `Escalated case to DH. Appointment ${d(-30)}.`),
      fu('ref', at(d(-30), 6), 'other', 'DH visit: attended. Biopsy and CT done.', { tier: 'dh', attendance: 'attended', date: d(-30) }),
      fu('ref', at(d(-24), 9), 'details_completed', 'Attached biopsy and CT reports.'),
      fu('ref', at(d(-23), 8), 'referral_sent', `Escalated case to TCC. Appointment ${today}.`),
    ] };
  };

  const direct = ({ patientId, referralId }: { patientId: string; referralId: string }): Built => {
    const created = at(today, 4);
    const patient: Patient = { id: patientId, name: DEMO_NAMES[1], age: 62, sex: 'F', locality: 'Mandar village', pincode: '835214', createdAt: created, updatedAt: created, syncStatus: 'pending' };
    const referral: Referral = {
      id: referralId, patientId, referringWorker: 'Walk-in at TCC', reason: 'Non-healing ulcer on the tongue for 3 months, pain while eating, weight loss', destinationFacility: 'TCC (walk-in)', referralDate: today, urgency: 'urgent',
      notes: 'Walk-in at TCC: came directly (not referred by ASHA). Never screened in the village.', demo: DEMO_VERSION, mappedPhc: 'PHC Mandar',
      worker: { appointmentDate: today }, facility: emptyFacility(), tier: 'tcc', unit,
      createdAt: created, updatedAt: created, syncStatus: 'pending',
    };
    return { patient, referral, followUps: [fu('dir', at(today, 4), 'other', 'Registered as a walk-in at TCC. Mapped to PHC Mandar (PIN 835214).')] };
  };

  return [referred, direct];
}

/** Earlier demo cases: the current marker, the old "(demo)" names, or the old scenario workers. */
export function isDemoCase(c: { patient: Pick<Patient, 'name'>; referral: Pick<Referral, 'demo' | 'referringWorker'> }): boolean {
  return !!c.referral.demo || /\(demo\)\s*$/i.test(c.patient.name ?? '') || /\(demo scenario\)/i.test(c.referral.referringWorker ?? '');
}

/** Replaces any earlier demo cases with the two current ones. Returns how many were added. */
export async function setUpDemoCases(today: string, unit: CareUnit = 'a'): Promise<number> {
  const existing = (await listCases()).filter(isDemoCase);
  const current = existing.filter(c => c.referral.demo === DEMO_VERSION);
  if (current.length >= DEMO_NAMES.length) return 0;
  await archiveCases(existing.map(c => c.referral.id));
  for (const build of buildDemoScenarios(today, unit)) await addPreparedCase(build);
  return DEMO_NAMES.length;
}

import { CBAC_B1_SYMPTOMS, CBAC_B2_SYMPTOMS, CBAC_B3_SYMPTOMS } from './cbacTypes';
import { getApplicableInterviewQuestions, type InterviewQuestion } from './cbacInterviewQuestions';
import { hiExtra } from '../i18n/hiExtra';
import type { Sex } from '../db/types';

export type PartBCategory = 'tb' | 'eyes_ears' | 'mouth' | 'skin_nerve' | 'women' | 'elderly';

interface CategoryInfo { id: PartBCategory; labelEn: string; labelHi: string; symptomIds: string[]; keywords: RegExp }

const B1 = CBAC_B1_SYMPTOMS.map(item => item.id);
const TB = ['shortness_of_breath', 'cough_two_weeks', 'blood_in_sputum', 'fever_two_weeks', 'weight_loss', 'night_sweats', 'taking_anti_tb_drugs', 'family_tb', 'history_of_tb'];
const EYES_EARS = ['cloudy_vision', 'difficulty_reading', 'eye_pain_one_week', 'eye_redness_one_week', 'difficulty_hearing', 'history_of_fits'];
const MOUTH = ['difficulty_opening_mouth', 'mouth_ulcers_unhealed', 'mouth_growth_unhealed', 'mouth_patch_unhealed', 'pain_chewing', 'voice_tone_change'];
const SKIN_NERVE = B1.filter(id => ![...TB, ...EYES_EARS, ...MOUTH].includes(id));

export const PART_B_CATEGORIES: CategoryInfo[] = [
  { id: 'tb', labelEn: 'TB or cough', labelHi: 'टीबी या खांसी', symptomIds: TB, keywords: /\b(?:tb|t\.?b\.?|tuberculosis|cough(?:ing)?|sputum|phlegm|fever|breath(?:ing|less)?)\b|टीबी|खांसी|खाँसी|बलगम|बुखार|सांस/i },
  { id: 'eyes_ears', labelEn: 'eyes or ears', labelHi: 'आंख या कान', symptomIds: EYES_EARS, keywords: /\b(?:eyes?|vision|sight|ears?|hearing|fits?|seizures?)\b|आंख|आँख|कान|नजर|दृष्टि|दौरे/i },
  { id: 'mouth', labelEn: 'mouth or oral', labelHi: 'मुंह या दांत', symptomIds: MOUTH, keywords: /\b(?:mouth|oral|teeth|tooth|dental|gums?|chewing|voice|throat)\b|मुंह|मुँह|दांत|दाँत|आवाज|गला/i },
  { id: 'skin_nerve', labelEn: 'skin or nerves', labelHi: 'त्वचा या नसें', symptomIds: SKIN_NERVE, keywords: /\b(?:skin|leprosy|patch(?:es)?|numb(?:ness)?|tingling|nerves?|hands?|feet|foot|rash)\b|त्वचा|कुष्ठ|सुन्न|झुनझुनी|चमड़ी|हाथ|पैर/i },
  { id: 'women', labelEn: 'women’s health, such as breast or bleeding', labelHi: 'महिलाओं की समस्या, जैसे स्तन या रक्तस्राव', symptomIds: CBAC_B2_SYMPTOMS.map(item => item.id), keywords: /\b(?:women(?:'s)?|breast|bleeding|periods?|menopause|vaginal|discharge)\b|महिला|स्तन|माहवारी|रक्तस्राव|मेनोपॉज/i },
  { id: 'elderly', labelEn: 'balance or memory in elderly', labelHi: 'बुजुर्गों में चक्कर या भूलना', symptomIds: CBAC_B3_SYMPTOMS.map(item => item.id), keywords: /\b(?:elderly|old age|memory|forget(?:ting)?|balance|unsteady|disability)\b|बुजुर्ग|भूल|याददाश्त|चक्कर/i },
];

const ALL_SYMPTOMS = [...CBAC_B1_SYMPTOMS, ...CBAC_B2_SYMPTOMS, ...CBAC_B3_SYMPTOMS];
export const B_SYMPTOM_PREFIX = 'b:';
export const B_CATEGORIES_ID = 'b_categories';

export function applicablePartBCategories(sex: Sex | '', age: number | ''): PartBCategory[] {
  return PART_B_CATEGORIES.map(c => c.id).filter(id => id !== 'women' || sex === 'F').filter(id => id !== 'elderly' || (typeof age === 'number' && age >= 60));
}

export function partBCategoryQuestion(sex: Sex | '', age: number | ''): InterviewQuestion {
  const categories = PART_B_CATEGORIES.filter(c => applicablePartBCategories(sex, age).includes(c.id));
  return {
    id: B_CATEGORIES_ID, field: B_CATEGORIES_ID, slide: 'B',
    promptEn: 'Do you have a problem with any of these:',
    promptHi: 'क्या आपको इनमें से कोई समस्या है:',
    hintEn: 'Choose one, for example "TB", or say "none". Only that section is asked next.',
    hintHi: 'एक चुनें, जैसे "टीबी", या कहें "कोई नहीं"। आगे केवल वही प्रश्न पूछे जाएंगे।',
    optionsEn: categories.map(c => c.labelEn), optionsHi: categories.map(c => c.labelHi),
    sampleResponses: ['TB', 'Mouth and eyes', 'None'],
  };
}

export function partBSymptomQuestion(symptomId: string): InterviewQuestion | undefined {
  const item = ALL_SYMPTOMS.find(s => s.id === symptomId);
  if (!item) return undefined;
  return {
    id: B_SYMPTOM_PREFIX + symptomId, field: symptomId, slide: 'B',
    promptEn: `${item.label}? Yes or no.`,
    promptHi: `क्या आपको यह समस्या है: ${hiExtra[item.label] ?? item.label}? हाँ या नहीं।`,
    hintEn: 'Answer yes or no.', hintHi: 'हाँ या नहीं बताएं।',
    sampleResponses: ['Yes', 'No'],
  };
}

/** Resolves static and dynamic Part B questions, e.g. for the server prompt and validation. */
export function findPartBQuestion(id: string): InterviewQuestion | undefined {
  if (id === B_CATEGORIES_ID) return partBCategoryQuestion('F', 60);
  return id.startsWith(B_SYMPTOM_PREFIX) ? partBSymptomQuestion(id.slice(B_SYMPTOM_PREFIX.length)) : undefined;
}

/** Interview order: the generic Part B questions are replaced by a category question plus only the chosen sections. */
export function buildInterviewQuestions(sex: Sex | '', age: number | '', selected: PartBCategory[] | undefined): InterviewQuestion[] {
  const base = getApplicableInterviewQuestions(sex).filter(q => q.id !== 'cough_tb' && q.id !== 'women_symptoms');
  const partB: InterviewQuestion[] = [partBCategoryQuestion(sex, age)];
  const allowed = applicablePartBCategories(sex, age);
  for (const category of PART_B_CATEGORIES) {
    if (!selected?.includes(category.id) || !allowed.includes(category.id)) continue;
    for (const symptomId of category.symptomIds) partB.push(partBSymptomQuestion(symptomId)!);
  }
  const at = base.findIndex(q => q.slide !== 'A');
  return [...base.slice(0, at < 0 ? base.length : at), ...partB, ...(at < 0 ? [] : base.slice(at))];
}

export function parsePartBCategories(answer: string, sex: Sex | '', age: number | ''): PartBCategory[] | undefined {
  const text = answer.trim().toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:no|none|nothing|nope|no problem|no problems|not any|nahi|nahin|नहीं|कोई नहीं|कोई समस्या नहीं|कुछ नहीं)$/.test(text)) return [];
  const allowed = applicablePartBCategories(sex, age);
  const found = PART_B_CATEGORIES.filter(c => allowed.includes(c.id) && c.keywords.test(text)).map(c => c.id);
  return found.length ? found : undefined;
}

/** Strict yes/no. Anything mixed, hedged or unrelated is left for the AI interpreter or a retry. */
export function parseYesNo(answer: string): boolean | undefined {
  const text = answer.trim().toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:no|nope|nah|not at all|none|never|negative|nahi|nahin|na|नहीं|नही|ना|नहीं है|कभी नहीं|बिल्कुल नहीं)$/.test(text)) return false;
  if (/^(?:yes|yeah|yep|yup|yes i do|i do|positive|haan|han|ha|haa|ji haan|हाँ|हां|हा|जी|जी हाँ|जी हां|हाँ है|हां है)$/.test(text)) return true;
  return undefined;
}

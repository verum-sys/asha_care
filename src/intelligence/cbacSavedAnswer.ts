import { applicablePartBCategories, B_CATEGORIES_ID, B_SYMPTOM_PREFIX, PART_B_CATEGORIES, type PartBCategory } from './cbacPartBInterview';
import { COOKING_FUELS, type CbacGeneralInfo, type CbacPartA, type CbacPartB, type CbacPartC, type CbacPartD } from './cbacTypes';

export type SavedAnswer = { text: string } | { single: string } | { multi: string[]; none?: boolean } | undefined;

interface FormState {
  general: CbacGeneralInfo; partA: CbacPartA; partB: CbacPartB; partC: CbacPartC; partD: CbacPartD;
  bCategories?: PartBCategory[]; referralRequired: string;
}

const PHQ_ANSWERS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

/**
 * What the worker already answered for a question, in the same wording as the manual answer options
 * (see cbacManualOptions), so going back shows the previous choice highlighted and the typed value filled in.
 */
export function savedAnswerFor(questionId: string, s: FormState): SavedAnswer {
  if (questionId.startsWith(B_SYMPTOM_PREFIX)) {
    const value = s.partB.symptoms[questionId.slice(B_SYMPTOM_PREFIX.length)];
    return value === undefined ? undefined : { single: value ? 'Yes' : 'No' };
  }
  switch (questionId) {
    case 'name': return s.general.name.trim() ? { text: s.general.name } : undefined;
    case 'age': return s.general.age === '' ? undefined : { text: String(s.general.age) };
    case 'waist': return s.partA.waistCm === undefined ? undefined : { text: String(s.partA.waistCm) };
    case 'sex': return s.general.sex ? { single: s.general.sex === 'F' ? 'Female' : s.general.sex === 'M' ? 'Male' : 'Other' } : undefined;
    case 'smoke': return s.partA.smokeScore === undefined ? undefined : { single: ['Never', 'Sometimes', 'Daily'][s.partA.smokeScore] };
    case 'alcohol': {
      const f = s.partA.alcoholFrequency;
      if (f === 'never' || (!f && s.partA.alcoholScore === 0)) return { single: 'Never' };
      if (f === 'socially' || f === 'weekly' || f === 'daily') return { single: f[0].toUpperCase() + f.slice(1) };
      return undefined; // "Yes, frequency not specified" matches no option.
    }
    case 'physicalActivity': return s.partA.physicalActivityScore === undefined ? undefined : { single: s.partA.physicalActivityScore === 0 ? '150 minutes per week' : 'Less than 150 minutes per week' };
    case 'familyHistory': return s.partA.familyHistoryScore === undefined ? undefined : { single: s.partA.familyHistoryScore ? 'Yes' : 'No' };
    case B_CATEGORIES_ID: {
      if (!s.bCategories) return undefined;
      const allowed = applicablePartBCategories(s.general.sex, s.general.age);
      const picked = PART_B_CATEGORIES.filter(c => s.bCategories!.includes(c.id) && allowed.includes(c.id)).map(c => c.labelEn);
      return picked.length ? { multi: picked } : { multi: [], none: true };
    }
    case 'cooking_fuel': return s.partC.cookingFuel.length ? { multi: s.partC.cookingFuel.map(id => COOKING_FUELS.find(f => f.id === id)?.label).filter((x): x is string => !!x) } : undefined;
    case 'phq1_interest': return s.partD.phq1Score === undefined ? undefined : { single: PHQ_ANSWERS[s.partD.phq1Score] };
    case 'phq2_mood': return s.partD.phq2Score === undefined ? undefined : { single: PHQ_ANSWERS[s.partD.phq2Score] };
    case 'initiate_referral': return s.referralRequired === 'yes' ? { single: 'Yes, initiate referral' } : s.referralRequired === 'no' ? { single: 'No, screening only' } : undefined;
    default: return undefined;
  }
}

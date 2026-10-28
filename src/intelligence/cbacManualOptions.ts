import { applicablePartBCategories, B_CATEGORIES_ID, B_SYMPTOM_PREFIX, PART_B_CATEGORIES } from './cbacPartBInterview';
import { COOKING_FUELS } from './cbacTypes';
import type { InterviewQuestion } from './cbacInterviewQuestions';
import type { Sex } from '../db/types';

export interface ManualOption { label: string; answer: string }
export type ManualControl =
  | { kind: 'text'; placeholder?: string }
  | { kind: 'number'; unit?: string }
  | { kind: 'single'; options: ManualOption[] }
  | { kind: 'multi'; options: ManualOption[]; noneAnswer?: ManualOption };

const YES_NO: ManualOption[] = [{ label: 'Yes', answer: 'Yes' }, { label: 'No', answer: 'No' }];
const FREQUENCY: ManualOption[] = [
  { label: 'Not at all', answer: 'Not at all' }, { label: 'Several days', answer: 'Several days' },
  { label: 'More than half the days', answer: 'More than half the days' }, { label: 'Nearly every day', answer: 'Nearly every day' },
];

/** Which tap/typing control to show for a question when the worker fills the form manually. Answers are phrased so the local parser accepts them. */
export function manualControlFor(question: InterviewQuestion, sex: Sex | '', age: number | ''): ManualControl {
  const id = question.id;
  if (id.startsWith(B_SYMPTOM_PREFIX)) return { kind: 'single', options: YES_NO };
  switch (id) {
    case 'name': return { kind: 'text' };
    case 'age': return { kind: 'number', unit: 'years' };
    case 'phone': return { kind: 'number', unit: 'digits' };
    case 'pincode': return { kind: 'number', unit: 'pin' };
    case 'address': return { kind: 'text', placeholder: 'Village locality, hamlet, or tola' };
    case 'waist': return { kind: 'number', unit: 'cm' };
    case 'sex': return { kind: 'single', options: [{ label: 'Female', answer: 'Female' }, { label: 'Male', answer: 'Male' }, { label: 'Other', answer: 'Other' }] };
    case 'smoke': return { kind: 'single', options: [{ label: 'Never', answer: 'Never' }, { label: 'Used to consume / Sometimes now', answer: 'Sometimes' }, { label: 'Daily', answer: 'Daily' }] };
    case 'alcohol': return { kind: 'single', options: [{ label: 'Never', answer: 'Never' }, { label: 'Socially', answer: 'Socially' }, { label: 'Weekly', answer: 'Weekly' }, { label: 'Daily', answer: 'Daily' }] };
    case 'physicalActivity': return { kind: 'single', options: [{ label: 'At least 150 minutes in a week', answer: '150 minutes per week' }, { label: 'Less than 150 minutes in a week', answer: 'Less than 150 minutes per week' }] };
    case 'familyHistory': return { kind: 'single', options: [{ label: 'No', answer: 'No' }, { label: 'Yes (Parent or Sibling)', answer: 'Yes' }] };
    case B_CATEGORIES_ID: return {
      kind: 'multi',
      options: PART_B_CATEGORIES.filter(c => applicablePartBCategories(sex, age).includes(c.id)).map(c => ({ label: c.labelEn, answer: c.labelEn })),
      noneAnswer: { label: 'None of these', answer: 'none' },
    };
    case 'cooking_fuel': return { kind: 'multi', options: COOKING_FUELS.map(f => ({ label: f.label, answer: f.label })) };
    case 'phq1_interest':
    case 'phq2_mood': return { kind: 'single', options: FREQUENCY };
    case 'initiate_referral': return { kind: 'single', options: [{ label: 'Yes — Initiate Referral', answer: 'Yes, initiate referral' }, { label: 'No — Routine Community Care', answer: 'No, screening only' }] };
    default: return { kind: 'text' };
  }
}

export const joinAnswers = (options: ManualOption[]) => options.map(o => o.answer).join(' and ');

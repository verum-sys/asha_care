import type { PartBCategory } from './cbacPartBInterview';
import type { CbacGeneralInfo, CbacPartA, CbacPartB, CbacPartC, CbacPartD } from './cbacTypes';

/** Answers of a new CBAC kept for the browser tab, so Back never throws away what the worker filled in. */
export interface CbacDraft {
  general: CbacGeneralInfo; partA: CbacPartA; partB: CbacPartB; partC: CbacPartC; partD: CbacPartD;
  /** Referral section state, typed by the form that owns it. */
  referralForm: unknown; bCategories?: PartBCategory[];
  /** The case created from this draft, once saved. */
  savedCaseId?: string;
}

const KEY = 'carelink.cbacDraft';

export function loadCbacDraft(): CbacDraft | undefined {
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as CbacDraft) : undefined; } catch { return undefined; }
}

export function saveCbacDraft(draft: CbacDraft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* storage blocked: the form still works, only Back loses answers */ }
}

export function clearCbacDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

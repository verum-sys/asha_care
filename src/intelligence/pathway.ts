import type { CareTier, ClinicalHandover, Referral, ReportAttachment } from '../db/types';

/** The tier where this case entered CareLink: ASHA for the ideal path, otherwise the facility the patient walked into. */
export function entryTier(referral: Pick<Referral, 'tier' | 'clinicalHandovers'>): CareTier {
  return referral.clinicalHandovers?.[0]?.fromTier ?? referral.tier ?? 'asha';
}

/**
 * A direct patient at this tier: they came here themselves (walk-in or registered here), not through a referral from
 * the previous tier. Direct patients are present when registered, so there is no attendance to record.
 */
export function isDirectAt(referral: Pick<Referral, 'tier' | 'clinicalHandovers'>, tier: CareTier): boolean {
  return tier !== 'asha' && entryTier(referral) === tier;
}

/** Came into CareLink at a facility rather than through ASHA screening (the case's path does not start at ASHA). */
export function isDirectCase(referral: Pick<Referral, 'tier' | 'clinicalHandovers'>): boolean {
  return entryTier(referral) !== 'asha';
}

/** Sent back to ASHA for follow-up (counter-referral from DH or TCC). */
export function isSentBack(referral: Pick<Referral, 'ashaFollowUpDate'>): boolean {
  return !!referral.ashaFollowUpDate;
}

const ORDER: CareTier[] = ['asha', 'phc', 'dh', 'tcc'];

/**
 * The handover notes a tier may read: those handed to it or to earlier tiers. A team that referred a patient on does
 * not see what later teams found, and ASHA never sees clinical handovers (only the date and instructions sent back).
 */
export function handedTo(handovers: ClinicalHandover[] | undefined, viewer: CareTier): ClinicalHandover[] | undefined {
  return handovers?.filter(h => ORDER.indexOf(h.toTier) <= ORDER.indexOf(viewer));
}

/** Reports a tier may see: those attached at its level or earlier. Older reports carry no tier; they count for the tier holding the case. */
export function reportsVisibleTo(referral: Pick<Referral, 'tier' | 'reports' | 'biopsyReports' | 'radiologyReports'>, viewer: CareTier): ReportAttachment[] {
  const all = [...(referral.reports ?? []), ...(referral.biopsyReports ?? []), ...(referral.radiologyReports ?? [])];
  return all.filter(r => ORDER.indexOf(r.tier ?? referral.tier ?? 'asha') <= ORDER.indexOf(viewer) && viewer !== 'asha');
}

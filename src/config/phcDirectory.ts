import type { CareUnit } from '../db/types';

export interface PhcEntry { unit: CareUnit; name: string }

/**
 * Which PHCs serve each PIN code, and which CareLink unit (A, B, C) each PHC is. A patient registered at DH or TCC is
 * mapped to one of these PHCs, so back referrals reach that PHC and its ASHA.
 *
 * DEMO LIST: replace with the programme's real PIN code to PHC list before real use.
 */
export const PHC_BY_PINCODE: Record<string, PhcEntry[]> = {
  '835205': [{ unit: 'a', name: 'PHC Bero' }, { unit: 'b', name: 'PHC Itki' }],
  '835214': [{ unit: 'a', name: 'PHC Mandar' }, { unit: 'b', name: 'PHC Chanho' }, { unit: 'c', name: 'PHC Burmu' }],
  '835217': [{ unit: 'a', name: 'PHC Itki' }],
  '835210': [{ unit: 'a', name: 'PHC Khunti' }, { unit: 'b', name: 'PHC Murhu' }],
  '834001': [{ unit: 'a', name: 'UPHC Ranchi Sadar' }, { unit: 'b', name: 'UPHC Hindpiri' }],
  '834009': [{ unit: 'a', name: 'UPHC Bariatu' }],
};

/** Used when a PIN code is not in the list yet: the three units, PHC A first (the default). */
export const DEFAULT_PHCS: PhcEntry[] = [{ unit: 'a', name: 'PHC A' }, { unit: 'b', name: 'PHC B' }, { unit: 'c', name: 'PHC C' }];

export const isPincode = (pin: string) => /^[1-9]\d{5}$/.test(pin.trim());

/** The PHCs for a PIN code, PHC A first. `known` is false when the PIN code is not listed and the defaults are offered. */
export function phcsForPincode(pin: string): { phcs: PhcEntry[]; known: boolean } {
  const listed = PHC_BY_PINCODE[pin.trim()];
  if (!listed?.length) return { phcs: DEFAULT_PHCS, known: false };
  return { phcs: [...listed].sort((a, b) => a.unit.localeCompare(b.unit)), known: true };
}

/** Mobile number and address checks shared by every form that collects them. Messages are English keys passed through t(). */

const SPOKEN_DIGITS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  shunya: '0', ek: '1', do: '2', teen: '3', char: '4', chaar: '4', paanch: '5', panch: '5', chhe: '6', chhah: '6', che: '6', saat: '7', sat: '7', aath: '8', ath: '8', nau: '9',
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6', 'छः': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
};

export const PHONE_REQUIRED = 'Mobile number is required.';
export const PHONE_INVALID = 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.';
export const ADDRESS_REQUIRED = 'Address is required.';
export const ADDRESS_INVALID = 'Enter a real address, such as the village, ward or locality.';
export const PINCODE_REQUIRED = 'PIN code is required.';
export const PINCODE_INVALID = 'Enter a valid 6-digit PIN code.';
export const ADDRESS_AI_INVALID = 'This does not look like an address. Please check it and enter the village, ward or locality.';

/** 10-digit Indian mobile from typed or spoken input ("+91 98765 43210", "nine eight seven…", "९८७६५…"), or undefined. */
export function normalizeMobile(input: string): string | undefined {
  const text = input.toLowerCase().replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - '०'.charCodeAt(0)));
  const tokens = text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const parts = tokens.map(token => (/^\d+$/.test(token) ? token : SPOKEN_DIGITS[token]));
  if (!parts.length || parts.some(part => part === undefined)) return undefined; // any other word means it is not just a number
  let number = parts.join('');
  if (number.length === 12 && number.startsWith('91')) number = number.slice(2);
  else if (number.length === 11 && number.startsWith('0')) number = number.slice(1);
  return /^[6-9]\d{9}$/.test(number) && !/^(\d)\1{9}$/.test(number) ? number : undefined;
}

export function mobileError(input: string): string | undefined {
  if (!input.trim()) return PHONE_REQUIRED;
  return normalizeMobile(input) ? undefined : PHONE_INVALID;
}

const JUNK = /^(?:na|n\/a|none|nil|null|test|testing|abc|abcd|xyz|asdf|asdfgh|qwerty|unknown|not known|dont know|don't know|no address|address|-+|\.+)$/i;

/** Cheap offline sanity check; the AI check catches subtler wrong entries when online. */
export function addressLocalError(input: string): string | undefined {
  const value = input.trim();
  if (!value) return ADDRESS_REQUIRED;
  const compact = value.replace(/\s+/g, '');
  const letters = (value.match(/\p{L}/gu) || []).length;
  const digits = (value.match(/\d/g) || []).length;
  if (compact.length < 3 || letters < 3 || JUNK.test(value) || /^(.)\1+$/u.test(compact) || digits > letters) return ADDRESS_INVALID;
  if (normalizeMobile(value)) return ADDRESS_INVALID; // a phone number typed into the address box
  const latin = /^[\x00-\x7F\s]+$/.test(value);
  if (latin && !/[aeiou]/i.test(value)) return ADDRESS_INVALID; // consonant mashing such as "kkkk" or "qwrt"
  return undefined;
}

/** 6-digit Indian PIN code (first digit 1-9) from typed or spoken input, or undefined. */
export function normalizePincode(input: string): string | undefined {
  const text = input.toLowerCase().replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - '०'.charCodeAt(0)));
  const tokens = text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const parts = tokens.map(token => (/^\d+$/.test(token) ? token : SPOKEN_DIGITS[token]));
  if (!parts.length || parts.some(part => part === undefined)) return undefined;
  const pin = parts.join('');
  return /^[1-9]\d{5}$/.test(pin) ? pin : undefined;
}

export function pincodeError(input: string): string | undefined {
  if (!input.trim()) return PINCODE_REQUIRED;
  return normalizePincode(input) ? undefined : PINCODE_INVALID;
}

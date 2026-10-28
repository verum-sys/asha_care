import { describe, expect, it } from 'vitest';
import { addressLocalError, mobileError, normalizeMobile, normalizePincode, pincodeError } from './contactValidation';

describe('mobile number', () => {
  it.each([['9876543210', '9876543210'], ['98765 43210', '9876543210'], ['+91 98765-43210', '9876543210'], ['09876543210', '9876543210'], ['919876543210', '9876543210'],
    ['९८७६५४३२१०', '9876543210'], ['nine eight seven six five four three two one zero', '9876543210'], ['नौ आठ सात छह पांच चार तीन दो एक शून्य', '9876543210']])('accepts %s', (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
    expect(mobileError(input)).toBeUndefined();
  });
  it.each(['', '12345', '1234567890', '5987654321', '9999999999', '98765432101', '98765abc10', 'call me on 9876543210', '98765 4321'])('rejects %j', input => {
    expect(mobileError(input)).toBeTruthy();
  });
});

describe('address (local check)', () => {
  it.each(['Bero village', 'Ward 5, Rampur', 'House 12, Mandar Sector', 'बेरो गांव', 'Itki, Ranchi 835217', 'Near govt school, Kanke'])('accepts %s', input => {
    expect(addressLocalError(input)).toBeUndefined();
  });
  it.each(['', '  ', 'kk', 'kkk', 'kkkkkk', '12345', '9876543210', 'na', 'N/A', 'test', 'xyz', 'qwrtp', '....'])('rejects %j', input => {
    expect(addressLocalError(input)).toBeTruthy();
  });
});

describe('PIN code', () => {
  it.each([['835217', '835217'], ['835 217', '835217'], ['८३५२१७', '835217'], ['eight three five two one seven', '835217']])('accepts %s', (input, expected) => {
    expect(normalizePincode(input)).toBe(expected);
    expect(pincodeError(input)).toBeUndefined();
  });
  it.each(['', '12345', '1234567', '035217', 'abcdef', '835 21'])('rejects %j', input => {
    expect(pincodeError(input)).toBeTruthy();
  });
});

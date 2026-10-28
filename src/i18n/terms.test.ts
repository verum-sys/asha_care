import { describe, expect, it } from 'vitest';
import { applyTerms } from './terms';
import { translate } from './index';

describe('community member vs patient wording', () => {
  it.each(['asha', 'phc'] as const)('uses "community member" at %s', tier => {
    expect(applyTerms('Search patients...', 'en', tier)).toBe('Search community members...');
    expect(applyTerms('Does this patient require referral to a health facility?', 'en', tier)).toBe('Does this community member require referral to a health facility?');
    expect(applyTerms('The patient’s sex', 'en', tier)).toBe('The community member’s sex');
    expect(applyTerms('Patients at', 'en', tier)).toBe('Community members at');
    expect(applyTerms('Patient record not found.', 'en', tier)).toBe('Community member record not found.');
  });
  it('capitalises the noun in Title Case labels and in all-caps headings', () => {
    expect(applyTerms('Patient Full Name *', 'en', 'asha')).toBe('Community Member Full Name *');
    expect(applyTerms('Community Screening Completed for Patient', 'en', 'phc')).toBe('Community Screening Completed for Community Member');
    expect(applyTerms('ONE PATIENT. ONE CONNECTED JOURNEY.', 'en', 'asha')).toBe('ONE COMMUNITY MEMBER. ONE CONNECTED JOURNEY.');
  });
  it('keeps "patient" at DH and TCC', () => {
    for (const tier of ['dh', 'tcc'] as const) {
      expect(applyTerms('Search patients...', 'en', tier)).toBe('Search patients...');
      expect(applyTerms('मरीज़ का नाम', 'hi', tier)).toBe('मरीज़ का नाम');
    }
  });
  it('does the same in Hindi, singular and plural', () => {
    expect(applyTerms('मरीज़ का नाम', 'hi', 'asha')).toBe('समुदाय सदस्य का नाम');
    expect(applyTerms('सभी मरीज़ों की सूची', 'hi', 'phc')).toBe('सभी समुदाय सदस्यों की सूची');
  });
  it('is applied by translate() for dictionary keys, parameters and free text', () => {
    expect(translate('en', 'Search patients...', undefined, 'asha')).toBe('Search community members...');
    expect(translate('en', 'Search patients...', undefined, 'tcc')).toBe('Search patients...');
    expect(translate('en', 'action.remind_patient', undefined, 'phc')).toBe('Remind community member about appointment');
    expect(translate('en', 'action.remind_patient', undefined, 'dh')).toBe('Remind patient about appointment');
    expect(translate('hi', 'Patient Name', undefined, 'asha')).toBe('समुदाय सदस्य का नाम');
  });
});

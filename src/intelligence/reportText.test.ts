import { describe, expect, it } from 'vitest';
import { redactPatient } from './reportText';

describe('taking the patient out of report text before it goes to the AI', () => {
  it('removes the name (whole and in parts), phone and ID, and the demo marker', () => {
    const text = 'Patient: Meena Devi (demo), 46 F. MEENA DEVI. Ph 98350-12277. UHID CL-0012. Impression: dysplasia. Devi reviewed.';
    const out = redactPatient(text, { name: 'Meena Devi (demo)', phone: '9835012277', id: 'CL-0012' });
    expect(out).not.toMatch(/meena|devi|98350|12277|CL-0012|\(demo\)/i);
    expect(out).toContain('Impression: dysplasia');
    expect(out).toContain('[patient]');
    expect(out).toContain('[phone]');
    expect(out).toContain('[id]');
  });
  it('leaves medical words alone when the name is short', () => {
    expect(redactPatient('Ra was seen. Radiology normal.', { name: 'Ra' })).toBe('[patient] was seen. Radiology normal.');
  });
});

describe('names in Hindi', () => {
  it('removes a Devanagari name as a whole word', () => {
    expect(redactPatient('मरीज़: सुनीता देवी, उम्र 45', { name: 'सुनीता देवी' })).toBe('मरीज़: [patient], उम्र 45');
  });
});
describe('partial Hindi words', () => {
  it('does not cut a shorter name out of a longer word with a vowel sign', () => {
    expect(redactPatient('सुनीता आई', { name: 'सुनीत' })).toBe('सुनीता आई');
  });
});

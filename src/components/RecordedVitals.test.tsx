import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordedVitals, recordedVitals } from './RecordedVitals';
import type { PhysicalExamNotes } from '../db/types';
const exam = (values: Partial<PhysicalExamNotes>) => values as PhysicalExamNotes;
describe('recorded vitals', () => {
  it('hides the section for absent vitals including a notes-only exam', () => {
    expect(renderToStaticMarkup(<RecordedVitals />)).toBe('');
    expect(renderToStaticMarkup(<RecordedVitals exam={exam({ generalFindings: 'Notes only' })} />)).toBe('');
    expect(recordedVitals(exam({ pulseRate: 0, spo2: NaN }))).toEqual([]);
  });
  it('shows only entered measurements and handles incomplete BP', () => {
    const html = renderToStaticMarkup(<RecordedVitals exam={exam({ bpSystolic: 142 })} />);
    expect(html).toContain('142 mmHg');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('Pulse:');
    expect(html).not.toContain('SpO2:');
    expect(html).not.toContain('BMI:');
  });
  it('preserves recorded vitals', () => {
    expect(recordedVitals(exam({ bpSystolic: 142, bpDiastolic: 90, pulseRate: 84, spo2: 95, bmi: 18.4 }))).toEqual([
      { label: 'BP', value: '142/90 mmHg' }, { label: 'Pulse', value: '84 bpm' }, { label: 'SpO2', value: '95%' }, { label: 'BMI', value: '18.4' },
    ]);
  });
});

import { physicalExamText } from './RecordedVitals';
describe('physical exam handover text', () => {
  it('lists vitals and each entered finding', () => {
    const text = physicalExamText({ bpSystolic: 138, bpDiastolic: 88, pulseRate: 80, generalFindings: 'Pallor present', oralCavityFindings: ' White patch right cheek ' });
    expect(text).toBe('Physical examination: BP 138/88 mmHg; Pulse 80 bpm\nGeneral: Pallor present\nOral cavity: White patch right cheek');
  });
  it('is empty when nothing was recorded', () => {
    expect(physicalExamText(undefined)).toBe('');
    expect(physicalExamText({ generalFindings: '  ' })).toBe('');
  });
});

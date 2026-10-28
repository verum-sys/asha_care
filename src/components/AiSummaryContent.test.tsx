import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSummary } from './AiSummaryModal';
import { CareJourneySummary } from './CareJourneySummary';
import { ClinicalHandovers } from './ClinicalHandovers';
import { makePatient, makeReferral } from '../db/factory';
import type { CareTier } from '../db/types';

const record = (tier: CareTier, referral: object = {}) => ({
  patient: makePatient({ id: 'p', name: 'Sunita Devi', age: 52, sex: 'F', locality: 'Bero Village', pincode: '835205' }),
  referral: makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', tier, destinationFacility: 'CHC Bero', urgency: 'soon', worker: { appointmentDate: '2026-11-03' }, ...referral }),
  followUps: [], facilityEvents: [],
});

describe('AI summary content', () => {
  it('no longer starts with the care module / destination / priority line', () => {
    for (const tier of ['asha', 'phc', 'dh', 'tcc'] as CareTier[]) {
      const { text } = buildSummary(record(tier));
      expect(text).not.toContain('Care module');
      expect(text).not.toContain('Recorded priority');
    }
  });
  it.each(['phc', 'dh', 'tcc'] as CareTier[])('includes the appointment date at %s', tier => {
    expect(buildSummary(record(tier)).text).toContain('Appointment date: 3 Nov 2026');
  });
  it('says when no appointment is set, and omits it for ASHA', () => {
    expect(buildSummary(record('phc', { worker: {} })).text).toContain('Appointment date: Not set');
    expect(buildSummary(record('asha')).text).not.toContain('Appointment date');
  });
  it('shows the PIN code with the locality', () => {
    expect(buildSummary(record('phc')).text).toContain('Bero Village, 835205');
  });
});

describe('AI summary appears only once, in the ASHA section', () => {
  const summary = 'Sunita Devi · 52 · F · Bero\n\nCare module: ASHA, Unit A. Destination: CHC Bero. Recorded priority: soon.\n\nCBAC Part A: 5/12.\n\nReports attached: 0 (0 general, 0 biopsy, 0 radiology).\n\nHandover notes: CBAC Part A risk score 5/12. Draft for worker review.';
  const stage = (fromTier: 'asha' | 'phc' | 'dh', toTier: 'phc' | 'dh' | 'tcc', extra: object = {}) =>
    ({ fromTier, toTier, at: '2026-10-26T00:00:00Z', notes: 'CBAC Part A risk score 5/12. Draft for worker review.', aiSummary: summary, ...extra });
  const html = renderToStaticMarkup(<ClinicalHandovers handovers={[stage('asha', 'phc'), stage('phc', 'dh'), stage('dh', 'tcc')]} />);
  it('shows the saved AI summary a single time, not again for PHC → DH or DH → TCC', () => {
    expect(html.match(/Saved AI summary/g)).toHaveLength(1);
    expect(html.match(/Sunita Devi · 52/g)).toHaveLength(1);
  });
  it('cleans the stored summary for display', () => {
    expect(html).not.toContain('Care module');
    expect(html).not.toContain('Reports attached');
    expect(html).not.toContain('Handover notes:');
    expect(html).toContain('CBAC Part A: 5/12.');
  });
  it('does not repeat identical notes in later stages, but keeps each stage’s own', () => {
    const repeated = renderToStaticMarkup(<ClinicalHandovers handovers={[stage('asha', 'phc'), stage('phc', 'dh'), stage('dh', 'tcc', { notes: 'DH: biopsy advised' })]} />);
    expect(repeated.match(/CBAC Part A risk score 5\/12\. Draft for worker review\./g)).toHaveLength(1);
    expect(repeated).toContain('DH: biopsy advised');
    expect(repeated).toContain('Nothing new since the previous care team.');
  });
  it('does not show the AI summary in the TCC care journey card', () => {
    const journey = renderToStaticMarkup(<CareJourneySummary record={record('tcc', { aiSummaryOverride: summary })} />);
    expect(journey).toContain('Patient care journey');
    expect(journey).not.toContain('Saved clinical summary');
    expect(journey).not.toContain('Edit summary');
  });

  it('lists the stages as compact rows whose notes open in a popup instead of being expanded', () => {
    expect(html).not.toContain('<details');
    expect(html).toContain('ASHA → PHC');
    expect(html).toContain('PHC → DH');
    expect(html).toContain('DH → TCC');
    expect(html.match(/group-hover:block/g)).toHaveLength(3);
    expect(html.match(/class="[^"]*\bhidden\b[^"]*group-hover:block/g)).toHaveLength(3); // popups are hidden until hover/focus/tap
    expect(html).toContain('Hover or tap a stage to see its notes.');
  });
});


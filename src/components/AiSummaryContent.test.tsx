import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSummary } from './AiSummaryModal';
import { CareJourneySummary } from './CareJourneySummary';
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

describe('care journey summary', () => {
  it('shows the saved summary as one or two lines', () => {
    const long = 'Line one of the summary.\n\nLine two with more detail. '.repeat(20);
    const html = renderToStaticMarkup(<CareJourneySummary record={record('tcc', { aiSummaryOverride: long })} />);
    expect(html).toContain('line-clamp-2');
    expect(html).not.toContain('whitespace-pre-wrap');
    expect(html.match(/<p class="mt-1 line-clamp-2[^>]*>([^<]*)<\/p>/)?.[1]).not.toMatch(/\n/); // visible text is flattened; the tooltip keeps the full summary
    expect(html).toContain('title="Line one');
  });
});

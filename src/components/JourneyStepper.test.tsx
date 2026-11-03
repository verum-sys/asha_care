import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyStepper } from './JourneyStepper';
import { LanguageSwitch } from './LanguageSwitch';
import { makeReferral } from '../db/factory';

describe('JourneyStepper', () => {
  it('shows all five steps with the current one marked and its appointment', () => {
    const referral = makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', tier: 'phc', worker: { appointmentDate: '2026-11-05' }, clinicalHandovers: [{ fromTier: 'asha', toTier: 'phc', at: '2026-10-20T10:00:00Z' }] });
    const html = renderToStaticMarkup(<JourneyStepper referral={referral} />);
    for (const label of ['ASHA', 'PHC', 'DH', 'TCC', 'Back to ASHA']) expect(html).toContain(label);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/data-state="done"/);
    expect(html).toContain('Appt');
  });
});

describe('LanguageSwitch', () => {
  it('shows both languages and marks the current one', () => {
    const html = renderToStaticMarkup(<LanguageSwitch />);
    expect(html).toContain('English');
    expect(html).toContain('हिंदी');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});

describe('JourneyStepper taps', () => {
  const referral = makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', tier: 'dh', clinicalHandovers: [{ fromTier: 'asha', toTier: 'phc', at: '2026-10-20T10:00:00Z' }, { fromTier: 'phc', toTier: 'dh', at: '2026-10-25T10:00:00Z' }] });
  it('makes only finished steps tappable, and only when a handler is given', () => {
    const tappable = renderToStaticMarkup(<JourneyStepper referral={referral} onSelect={() => {}} />);
    expect(tappable.match(/<button/g)).toHaveLength(2); // ASHA and PHC are done
    expect(renderToStaticMarkup(<JourneyStepper referral={referral} />)).not.toContain('<button');
  });
});

describe('JourneyStepper for a patient who came straight to TCC', () => {
  it('shows earlier steps as not visited and never tappable', () => {
    const html = renderToStaticMarkup(<JourneyStepper referral={makeReferral({ id: 'w', patientId: 'p', referralDate: '2026-11-04', tier: 'tcc' })} onSelect={() => {}} />);
    expect(html.match(/data-state="skipped"/g)).toHaveLength(3);
    expect(html).not.toContain('<button');
  });
});

describe('LanguageChoice', () => {
  it('stays hidden outside a provider (isolated renders and tests)', async () => {
    const { LanguageChoice } = await import('./LanguageChoice');
    expect(renderToStaticMarkup(<LanguageChoice />)).toBe('');
  });
});

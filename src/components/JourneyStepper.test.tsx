import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyStepper } from './JourneyStepper';
import { LanguageSwitch } from './LanguageSwitch';
import { makeReferral } from '../db/factory';

describe('JourneyStepper', () => {
  it('shows all five steps with the current one marked and its appointment', () => {
    const referral = makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', tier: 'phc', worker: { appointmentDate: '2026-11-05' } });
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
  const referral = makeReferral({ id: 'r', patientId: 'p', referralDate: '2026-10-20', tier: 'dh' });
  it('makes only finished steps tappable, and only when a handler is given', () => {
    const tappable = renderToStaticMarkup(<JourneyStepper referral={referral} onSelect={() => {}} />);
    expect(tappable.match(/<button/g)).toHaveLength(2); // ASHA and PHC are done
    expect(renderToStaticMarkup(<JourneyStepper referral={referral} />)).not.toContain('<button');
  });
});

describe('LanguageChoice', () => {
  it('stays hidden outside a provider (isolated renders and tests)', async () => {
    const { LanguageChoice } = await import('./LanguageChoice');
    expect(renderToStaticMarkup(<LanguageChoice />)).toBe('');
  });
});

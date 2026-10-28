import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CbacScreening } from './CbacScreening';
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ getToken: async () => null }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'super_admin', unit: 'a' } }) }));
vi.mock('../../i18n', () => ({ useLang: () => ({ lang: 'en', t: (key: string) => key }) }));
vi.mock('../../settings', () => ({ useSettings: () => ({ workerName: 'Test worker' }) }));
vi.mock('../../voice/useSpeak', () => ({ useSpeak: () => ({ speak: vi.fn(async () => {}), stop: vi.fn(), speaking: false }) }));
describe('CBAC interview UI', () => {
  it('provides a starting-page fallback when editable CBAC is opened directly', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname: '/case/current-patient/cbac', search: '?tier=phc&unit=b', state: { returnTo: '/tier/phc?unit=b' } }]}>
        <Routes><Route path="/case/:id/cbac" element={<CbacScreening />} /></Routes>
      </MemoryRouter>,
    );
    expect(html).toContain('href="/"');
    expect(html).not.toContain('/case/REF-0007');
  });

  it('prioritizes manual fields with compact progress and collapsed voice controls', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/cbac?tier=phc']}><CbacScreening /></MemoryRouter>);
    expect(html).toContain('Voice assistant');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Proactive AI Voice Assistant');
    expect(html).not.toContain('What is the patient&#x27;s full name?');
    expect(html).not.toContain('id="interview-answer"');
    expect(html.indexOf('aria-label="CBAC Slides"')).toBeLessThan(html.indexOf('id="patient-name"'));
    expect(html).toContain('id="patient-name"');
    expect(html).not.toContain('Facility Response Status');
    expect(html).not.toContain('Has destination facility confirmed receipt or acceptance?');
    expect(html).not.toContain('All Questions at Once');
    expect(html).not.toContain('Auto Fill All');
    expect(html).not.toContain('Continuous Mic Dictate');
  });

  it('starts an ASHA registration by asking voice or manual, without showing the full form', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/cbac?tier=asha']}><CbacScreening /></MemoryRouter>);
    expect(html).toContain('How would you like to fill this form?');
    expect(html).toContain('Use voice (audio)');
    expect(html).toContain('Fill manually');
    expect(html).not.toContain('id="patient-name"');
    expect(html).not.toContain('aria-label="CBAC Slides"');
  });

  it('lets PHC correct only name, phone and address on an existing patient', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/case/current-patient/cbac?tier=phc&view=form']}>
        <Routes><Route path="/case/:id/cbac" element={<CbacScreening />} /></Routes>
      </MemoryRouter>,
    );
    expect((html.match(/inert=""/g) || []).length).toBeGreaterThanOrEqual(3); // age, sex, slides
    expect(html).toContain('Save changes');
    expect(html).not.toContain('Voice assistant');
    const open = (marker: string) => html.slice(html.lastIndexOf('<div', html.indexOf(marker)), html.indexOf(marker));
    expect(open('Patient Full Name')).not.toContain('inert');
    expect(open('Locality / Village / Ward')).not.toContain('inert');
    expect(open('Age (Years)')).toContain('inert');
  });
  it('does not lock a new PHC registration or the other tiers', () => {
    for (const entry of ['/cbac?tier=phc', '/case/current-patient/cbac?tier=dh']) {
      const html = renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}><Routes><Route path="*" element={<CbacScreening />} /></Routes></MemoryRouter>);
      expect(html).not.toContain('inert=""');
    }
  });

  it('opens an existing patient on the report view, with Edit, instead of the full form', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/case/current-patient/cbac?tier=dh']}>
        <Routes><Route path="/case/:id/cbac" element={<CbacScreening />} /></Routes>
      </MemoryRouter>,
    );
    expect(html).toContain('Review the report');
    expect(html).toContain('✎');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('id="patient-name"');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TierModuleView } from './TierModuleView';
import { makePatient, makeReferral } from '../../db/factory';
vi.mock('../../i18n', () => ({ useTermTier: () => undefined, useLang: () => ({ t: (key: string) => key }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'super_admin', unit: 'a' } }) }));
vi.mock('../../db/useLive', () => ({ useLive: () => ({ data: ['asha', 'phc'].map(tier => ({
  patient: makePatient({ id: tier, name: `Person-${tier}` }),
  referral: makeReferral({ id: `ref-${tier}`, patientId: tier, tier: tier as 'asha' | 'phc', referralDate: '2026-10-25', worker: { appointmentDate: '2026-11-03' } }),
  followUps: [], facilityEvents: [],
})) }) }));
const render = (tier: string) => renderToStaticMarkup(<MemoryRouter initialEntries={[`/tier/${tier}`]}><Routes><Route path="/tier/:tier" element={<TierModuleView />} /></Routes></MemoryRouter>);

describe('ASHA list of community members', () => {
  const html = render('asha');
  it('has no AI Summary or Refer buttons on each entry', () => {
    expect(html).not.toContain('AI Summary');
    expect(html).not.toContain('Refer to next PHC');
    expect(html).not.toContain('Refer to DH');
  });
  it('has one place to view/edit, not a separate "edit patient / referral"', () => {
    expect(html).not.toContain('Edit patient / referral');
    expect(html).toContain('/case/ref-asha/cbac?tier=asha');
    expect(html.match(/\/case\/ref-asha\/(?:cbac|edit)/g)).toHaveLength(1);
  });
  it('replaces acceptance/attendance with Record follow-up', () => {
    expect(html).toContain('Record follow-up');
    expect(html).toContain('href="/case/ref-asha/follow-up"');
    expect(html).not.toContain('Acceptance');
    expect(html).not.toContain('Record attendance');
  });
});

describe('PHC list keeps its own actions', () => {
  it('still offers Refer to DH, attendance and edit', () => {
    const html = render('phc');
    expect(html).toContain('Refer to DH');
    expect(html).toContain('Record attendance');
  });
});

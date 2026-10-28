import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TierModuleView } from './TierModuleView';
import { makePatient, makeReferral } from '../../db/factory';
const auth = vi.hoisted(() => ({ user: { role: 'super_admin', unit: 'a' } }));
vi.mock('../../i18n', () => ({ useTermTier: () => undefined, useLang: () => ({ t: (key: string) => key }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../db/useLive', () => ({ useLive: () => ({ data: ['a', 'b', 'c'].map(unit => ({
  patient: makePatient({ id: unit, name: `Patient-${unit}` }),
  referral: makeReferral({ id: `ref-${unit}`, patientId: unit, tier: 'phc', unit: unit as 'a' | 'b' | 'c', referralDate: '2026-10-25' }),
  followUps: [], facilityEvents: [],
})) }) }));
function render() {
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/tier/phc?unit=a']}><Routes><Route path="/tier/:tier" element={<TierModuleView />} /></Routes></MemoryRouter>);
}
describe('care modules without unit filters', () => {
  it('shows all units for super admin even on legacy filtered links', () => {
    auth.user.role = 'super_admin';
    const html = render();
    for (const unit of ['a', 'b', 'c']) expect(html).toContain(`Patient-${unit}`);
    expect(html).not.toContain('Active Sub-Unit');
    expect(html).not.toContain('Search patient in this unit');
    expect(html).not.toContain('Unit A');
  });
  it('retains assigned-unit restrictions for staff', () => {
    auth.user.role = 'doctor';
    const html = render();
    expect(html).toContain('Patient-a');
    expect(html).not.toContain('Patient-b');
    expect(html).not.toContain('Patient-c');
  });
});

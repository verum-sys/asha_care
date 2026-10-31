import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TierModuleView } from './TierModuleView';
import { makePatient, makeReferral } from '../../db/factory';
vi.mock('../../i18n', () => ({ useTermTier: () => undefined, useLang: () => ({ t: (key: string) => key }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'super_admin', unit: 'a' } }) }));
vi.mock('../../db/useLive', () => ({ useLive: () => ({ data: ['asha', 'phc', 'dh'].map(tier => ({
  patient: makePatient({ id: tier, name: `Person-${tier}` }),
  referral: makeReferral({ id: `ref-${tier}`, patientId: tier, tier: tier as 'asha' | 'phc' | 'dh', referralDate: '2026-10-25', worker: { appointmentDate: '2026-11-03', ...(tier === 'dh' ? { attendance: 'attended' as const } : {}) } }),
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
  it('has one main action, to start the screening, and the rest behind More', () => {
    expect(html).not.toContain('Edit patient / referral');
    expect(html).toContain('Conduct CBAC');
    expect(html.match(/Conduct CBAC/g)).toHaveLength(1);
    expect(html).toContain('case.more');
  });
  it('keeps follow-up out of sight until asked for, and has no attendance or acceptance', () => {
    expect(html).not.toContain('Acceptance');
    expect(html).not.toContain('Record attendance');
  });
});

describe('PHC list: one main action chosen from the case', () => {
  it('asks for attendance first, with Refer to DH held back in More', () => {
    const html = render('phc');
    expect(html).toContain('Record attendance');
    expect(html).not.toContain('Refer to DH');
    expect(html).toContain('case.more');
  });
});

describe('DH list', () => {
  it('offers Refer to TCC as the main action once the patient has attended', () => {
    const html = render('dh');
    expect(html).toContain('Refer to TCC');
    expect(html.match(/Refer to TCC/g)).toHaveLength(1);
  });
});

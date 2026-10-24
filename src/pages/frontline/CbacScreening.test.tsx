import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CbacScreening } from './CbacScreening';
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ getToken: async () => null }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'super_admin', unit: 'a' } }) }));
vi.mock('../../i18n', () => ({ useLang: () => ({ lang: 'en', t: (key: string) => key }) }));
vi.mock('../../settings', () => ({ useSettings: () => ({ workerName: 'Test worker' }) }));
vi.mock('../../voice/useSpeak', () => ({ useSpeak: () => ({ speak: vi.fn(async () => {}), stop: vi.fn(), speaking: false }) }));
describe('CBAC interview UI', () => {
  it('prioritizes manual fields with compact progress and collapsed voice controls', () => {
    const html = renderToStaticMarkup(<MemoryRouter><CbacScreening /></MemoryRouter>);
    expect(html).toContain('Voice assistant');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Proactive AI Voice Assistant');
    expect(html).not.toContain('What is the patient&#x27;s full name?');
    expect(html).not.toContain('id="interview-answer"');
    expect(html.indexOf('aria-label="CBAC Slides"')).toBeLessThan(html.indexOf('id="patient-name"'));
    expect(html).toContain('id="patient-name"');
    expect(html).not.toContain('All Questions at Once');
    expect(html).not.toContain('Auto Fill All');
    expect(html).not.toContain('Continuous Mic Dictate');
  });
});

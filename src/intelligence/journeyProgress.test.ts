import { describe, expect, it } from 'vitest';
import { journeyProgress } from './journeyProgress';

const base = { worker: {}, facility: {} } as Record<string, unknown>;
const at = (fromTier: 'asha' | 'phc' | 'dh' | 'tcc', toTier: 'phc' | 'dh' | 'tcc' | 'asha', day: string) => ({ fromTier, toTier, at: `${day}T10:00:00Z` });
const states = (nodes: ReturnType<typeof journeyProgress>) => nodes.map(n => n.state);

describe('journeyProgress', () => {
  it('starts at ASHA', () => {
    expect(states(journeyProgress({ ...base, tier: 'asha' } as never))).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });
  it('treats a case without a tier as ASHA', () => {
    expect(journeyProgress(base as never)[0].state).toBe('current');
  });
  it('ticks earlier steps and dates them by the handover', () => {
    const nodes = journeyProgress({ ...base, tier: 'dh', clinicalHandovers: [at('asha', 'phc', '2026-10-01'), at('phc', 'dh', '2026-10-08')] } as never);
    expect(states(nodes)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(nodes[0]).toMatchObject({ date: '2026-10-01', dateKind: 'referred' });
    expect(nodes[1].date).toBe('2026-10-08');
  });
  it('shows the appointment on the current step', () => {
    const nodes = journeyProgress({ tier: 'phc', worker: { appointmentDate: '2026-11-05' }, facility: {} } as never);
    expect(nodes[1]).toMatchObject({ state: 'current', date: '2026-11-05', dateKind: 'appointment' });
  });
  it('falls back to the facility appointment date', () => {
    const nodes = journeyProgress({ tier: 'tcc', worker: {}, facility: { appointmentDate: '2026-11-09' } } as never);
    expect(nodes[3].date).toBe('2026-11-09');
  });
  it('moves to the last step once TCC sends the case back to ASHA', () => {
    const nodes = journeyProgress({ ...base, tier: 'asha', clinicalHandovers: [at('asha', 'phc', '2026-10-01'), at('phc', 'dh', '2026-10-08'), at('dh', 'tcc', '2026-10-15'), at('tcc', 'asha', '2026-10-30')] } as never);
    expect(states(nodes)).toEqual(['done', 'done', 'done', 'done', 'current']);
  });
});

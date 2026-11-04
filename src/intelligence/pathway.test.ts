import { describe, expect, it } from 'vitest';
import { entryTier, handedTo, isDirectAt, isDirectCase, reportsVisibleTo } from './pathway';

const h = (fromTier: 'asha' | 'phc' | 'dh', toTier: 'phc' | 'dh' | 'tcc') => ({ fromTier, toTier, at: '2026-11-01T00:00:00Z' });

describe('referred or direct', () => {
  it('a case screened by ASHA is a referral at every facility', () => {
    const r = { tier: 'tcc' as const, clinicalHandovers: [h('asha', 'phc'), h('phc', 'dh'), h('dh', 'tcc')] };
    expect(entryTier(r)).toBe('asha');
    for (const tier of ['phc', 'dh', 'tcc'] as const) expect(isDirectAt(r, tier)).toBe(false);
    expect(isDirectCase(r)).toBe(false);
  });
  it('a walk-in is direct where they walked in, and a referral at the next tier', () => {
    expect(isDirectAt({ tier: 'tcc' }, 'tcc')).toBe(true);
    const fromDh = { tier: 'tcc' as const, clinicalHandovers: [h('dh', 'tcc')] };
    expect(isDirectAt(fromDh, 'dh')).toBe(true);
    expect(isDirectAt(fromDh, 'tcc')).toBe(false);
    expect(isDirectCase(fromDh)).toBe(true);
  });
  it('ASHA is never "direct"', () => {
    expect(isDirectAt({ tier: 'asha' }, 'asha')).toBe(false);
  });
});

describe('who may read which handover notes', () => {
  const all = [h('asha', 'phc'), h('phc', 'dh'), h('dh', 'tcc')];
  it('each tier reads what was handed to it and before, never what later teams found', () => {
    expect(handedTo(all, 'tcc')).toHaveLength(3);
    expect(handedTo(all, 'dh')?.map(x => x.toTier)).toEqual(['phc', 'dh']);
    expect(handedTo(all, 'phc')?.map(x => x.toTier)).toEqual(['phc']);
    expect(handedTo(all, 'asha')).toEqual([]);
  });
});

describe('which reports a tier may see', () => {
  const r = (id: string, tier?: 'phc' | 'dh' | 'tcc') => ({ id, tier, title: id, category: 'general' as const, fileName: '', fileSize: '', fileType: '', uploadedAt: '', uploadedBy: '' });
  const referral = { tier: 'tcc' as const, reports: [r('cbc', 'phc'), r('legacy')], biopsyReports: [{ ...r('bx', 'dh'), category: 'biopsy' as const }] };
  it('each tier sees reports from its level and earlier; ASHA sees none', () => {
    expect(reportsVisibleTo(referral, 'tcc').map(x => x.id)).toEqual(['cbc', 'legacy', 'bx']);
    expect(reportsVisibleTo(referral, 'dh').map(x => x.id)).toEqual(['cbc', 'bx']);
    expect(reportsVisibleTo(referral, 'phc').map(x => x.id)).toEqual(['cbc']);
    expect(reportsVisibleTo(referral, 'asha')).toEqual([]);
  });
});

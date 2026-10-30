import { describe, expect, it } from 'vitest';
import { backDestination, backSteps, isFormPage } from './backNavigation';
describe('back navigation', () => {
  it('returns to the actual previous in-app entry for any nested page', () => {
    expect(backDestination({ idx: 1 })).toBe(-1);
    expect(backDestination({ idx: 5 })).toBe(-1);
  });
  it.each([null, undefined, {}, { idx: 0 }, { idx: -1 }, { idx: '2' }, { idx: NaN }, { idx: 1.5 }])('falls back to the starting page for a direct entry: %j', state => {
    expect(backDestination(state)).toBe('/');
  });
});

describe('back skips form pages', () => {
  const trail = { 0: '/', 1: '/tier/asha', 2: '/cbac?tier=asha', 3: '/case/REF-0010' };
  it('goes from a case opened after saving a new CBAC to the page before the form', () => {
    expect(backSteps({ idx: 3 }, '/case/REF-0010', trail)).toBe(-2);
  });
  it('goes back one step to an ordinary page', () => {
    expect(backSteps({ idx: 1 }, '/tier/asha', trail)).toBe(-1);
  });
  it('skips a duplicate entry of the same page', () => {
    expect(backSteps({ idx: 4 }, '/case/REF-0010', { ...trail, 4: '/case/REF-0010' })).toBe(-3);
  });
  it('skips follow-up and edit forms too', () => {
    expect(backSteps({ idx: 3 }, '/case/REF-0010', { 0: '/tier/asha', 1: '/case/REF-0010', 2: '/case/REF-0010/follow-up', 3: '/case/REF-0010' })).toBe(-3);
  });
  it('falls back to the start when only forms are behind', () => {
    expect(backSteps({ idx: 1 }, '/case/REF-0010', { 0: '/cbac?tier=asha' })).toBe('/');
  });
  it('returns from a just-saved case to the report step it was saved from', () => {
    expect(backSteps({ idx: 3 }, '/case/REF-0006', { 0: '/tier/asha', 1: '/cbac?tier=asha&step=q20', 2: '/cbac?tier=asha&step=report', 3: '/case/REF-0006' })).toBe(-1);
  });
  it('recognises form pages', () => {
    expect(isFormPage('/cbac?tier=asha&step=report')).toBe(false);
    expect(isFormPage('/cbac?tier=asha')).toBe(true);
    expect(isFormPage('/case/REF-1/cbac?tier=phc')).toBe(true);
    expect(isFormPage('/case/REF-1')).toBe(false);
  });
});

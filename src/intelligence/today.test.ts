import { describe, expect, it } from 'vitest';
import { needsToday, pickToday, telHref, todayReason } from './today';

const c = (over: Record<string, unknown> = {}, urgency = 'routine', priority = 10) => ({ referral: { urgency }, intel: { open: true, careState: 'scheduled', priority, ...over } }) as never;

describe('todayReason', () => {
  it('flags an overdue date with how many days', () => expect(todayReason(c({ dueInDays: -3 }))).toEqual({ kind: 'overdue', days: 3 }));
  it('flags a date that is today', () => expect(todayReason(c({ dueInDays: 0 }))).toEqual({ kind: 'dueToday' }));
  it('leaves a future date alone', () => expect(todayReason(c({ dueInDays: 5 }))).toBeUndefined());
  it('flags care states that need action now', () => expect(todayReason(c({ careState: 'not_attended' }))).toEqual({ kind: 'state', state: 'not_attended' }));
  it('flags urgent cases', () => expect(todayReason(c({}, 'urgent'))).toEqual({ kind: 'urgent' }));
  it('never flags a closed case', () => expect(needsToday(c({ open: false, dueInDays: -2 }))).toBe(false));
});

describe('pickToday', () => {
  it('returns only cases that need action, highest priority first, capped', () => {
    const list = [c({ dueInDays: 9 }, 'routine', 99), c({ dueInDays: -1 }, 'routine', 20), c({ dueInDays: 0 }, 'routine', 60), c({ careState: 'declined' }, 'routine', 40), c({ dueInDays: -5 }, 'routine', 10)];
    const picked = pickToday(list, 3);
    expect(picked.map(x => (x as never as { intel: { priority: number } }).intel.priority)).toEqual([60, 40, 20]);
  });
});

describe('telHref', () => {
  it('builds a tel link from a phone number', () => expect(telHref('98765 43210')).toBe('tel:9876543210'));
  it('keeps a country code', () => expect(telHref('+91 98765-43210')).toBe('tel:+919876543210'));
  it('returns nothing for a missing or too short number', () => {
    expect(telHref(undefined)).toBeUndefined();
    expect(telHref('12')).toBeUndefined();
  });
});

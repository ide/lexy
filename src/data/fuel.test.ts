import { describe, expect, it } from 'vitest';

import { FUEL_SEGMENTS, fuelGauge, fuelSegmentFills, isElectric } from './fuel';

describe('fuelSegmentFills', () => {
  it('returns one fill fraction per segment', () => {
    expect(fuelSegmentFills(50)).toHaveLength(FUEL_SEGMENTS);
  });

  it('fills whole quarters and partially fills the active one', () => {
    // 60% -> two full quarters, third at 40%, fourth empty.
    expect(fuelSegmentFills(60)).toEqual([1, 1, 0.4, 0]);
  });

  it('reads empty and full at the extremes', () => {
    expect(fuelSegmentFills(0)).toEqual([0, 0, 0, 0]);
    expect(fuelSegmentFills(100)).toEqual([1, 1, 1, 1]);
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(fuelSegmentFills(140)).toEqual([1, 1, 1, 1]);
    expect(fuelSegmentFills(-10)).toEqual([0, 0, 0, 0]);
    expect(fuelSegmentFills(Number.NaN)).toEqual([0, 0, 0, 0]);
  });
});

describe('isElectric', () => {
  it('matches electric fuel types', () => {
    expect(isElectric('Electric')).toBe(true);
    expect(isElectric('Gasoline')).toBe(false);
    expect(isElectric('Hybrid')).toBe(false);
  });
});

describe('fuelGauge', () => {
  it('labels combustion vehicles Fuel with the percentage readout', () => {
    const gauge = fuelGauge('Gasoline', 72);
    expect(gauge.label).toBe('Fuel');
    expect(gauge.symbol).toBe('fuelpump.fill');
    expect(gauge.valueText).toBe('72%');
    expect(gauge.level).toBe('high');
  });

  it('labels EVs Charge with a bolt', () => {
    const gauge = fuelGauge('Electric', 40);
    expect(gauge.label).toBe('Charge');
    expect(gauge.symbol).toBe('bolt.fill');
  });

  it('reads Full at 100%', () => {
    expect(fuelGauge('Gasoline', 100).valueText).toBe('Full');
    expect(fuelGauge('Gasoline', 100).level).toBe('full');
  });

  it('escalates the warning tier as the tank drains', () => {
    expect(fuelGauge('Gasoline', 99).level).toBe('high');
    expect(fuelGauge('Gasoline', 26).level).toBe('high');
    expect(fuelGauge('Gasoline', 25).level).toBe('medium');
    expect(fuelGauge('Gasoline', 16).level).toBe('medium');
    expect(fuelGauge('Gasoline', 15).level).toBe('low');
    expect(fuelGauge('Gasoline', 6).level).toBe('low');
    expect(fuelGauge('Gasoline', 5).level).toBe('critical');
    expect(fuelGauge('Gasoline', 0).level).toBe('critical');
  });

  it('rounds the displayed percentage', () => {
    expect(fuelGauge('Gasoline', 72.6).valueText).toBe('73%');
  });
});

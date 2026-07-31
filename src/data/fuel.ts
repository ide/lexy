import type { SFSymbol } from "sf-symbols-typescript";

// The fuel gauge is drawn as a bar divided into quarters — mirroring the car's
// dashboard — rather than a precise percentage, because the underlying reading
// is an estimate. The exact number is revealed on tap (see the Status screen).
export const FUEL_SEGMENTS = 4;

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return Math.max(0, Math.min(100, percent));
}

/**
 * Fill fraction (0–1) for each of the FUEL_SEGMENTS quarters. The active
 * quarter fills proportionally so, e.g., 60% reads as two full bars and a third
 * ~40% filled — an approximate level, not a false-precision number.
 */
export function fuelSegmentFills(percent: number): number[] {
  const p = clampPercent(percent);
  const per = 100 / FUEL_SEGMENTS;
  return Array.from({ length: FUEL_SEGMENTS }, (_, i) => {
    const lower = i * per;
    return Math.max(0, Math.min(1, (p - lower) / per));
  });
}

export function isElectric(fuelType: string): boolean {
  return /electric/i.test(fuelType);
}

/**
 * Color tier for the gauge: full reads green as a reward, a healthy level
 * stays neutral, and the warning colors escalate as the tank drains
 * (yellow ≤25%, orange ≤15%, red ≤5%).
 */
export type FuelLevel = "full" | "high" | "medium" | "low" | "critical";

export type FuelGauge = {
  /** Section label — "Fuel" for combustion/hybrid, "Charge" for EVs. */
  label: string;
  symbol: SFSymbol;
  /** The precise readout ("Full" at 100%). */
  valueText: string;
  level: FuelLevel;
  fills: number[];
};

function fuelLevel(percent: number): FuelLevel {
  if (percent >= 100) {
    return "full";
  }
  if (percent > 25) {
    return "high";
  }
  if (percent > 15) {
    return "medium";
  }
  if (percent > 5) {
    return "low";
  }
  return "critical";
}

/**
 * Everything the Status screen needs to draw the fuel/charge bar. EVs read
 * "Charge"; a full tank/battery reads "Full".
 */
export function fuelGauge(fuelType: string, percent: number): FuelGauge {
  const p = Math.round(clampPercent(percent));
  const electric = isElectric(fuelType);
  return {
    label: electric ? "Charge" : "Fuel",
    symbol: electric ? "bolt.fill" : "fuelpump.fill",
    valueText: p >= 100 ? "Full" : `${p}%`,
    level: fuelLevel(p),
    fills: fuelSegmentFills(p),
  };
}

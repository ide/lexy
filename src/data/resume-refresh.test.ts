import { describe, expect, it } from "vitest";

import {
  RESUME_PRIME_AFTER_MS,
  RESUME_REFETCH_AFTER_MS,
  resumeRefreshPlan,
} from "./resume-refresh";

const NOW = new Date("2026-07-30T12:00:00Z").getTime();
const plan = (ageMs: number) => resumeRefreshPlan(NOW - ageMs, NOW);

describe("resumeRefreshPlan", () => {
  it("leaves data from the last minute alone", () => {
    expect(plan(0)).toBe("none");
    expect(plan(RESUME_REFETCH_AFTER_MS - 1)).toBe("none");
  });

  it("re-reads data past the fresh window without waking the car", () => {
    expect(plan(RESUME_REFETCH_AFTER_MS)).toBe("refetch");
    expect(plan(RESUME_PRIME_AFTER_MS - 1)).toBe("refetch");
  });

  it("primes once a plain GET would likely return the same stale snapshot", () => {
    expect(plan(RESUME_PRIME_AFTER_MS)).toBe("prime");
    expect(plan(8 * 60 * 60 * 1000)).toBe("prime");
  });

  it("does nothing without cached data — the query's own load covers that", () => {
    expect(resumeRefreshPlan(0, NOW)).toBe("none");
  });

  it("does not read a clock that moved backwards as staleness", () => {
    expect(resumeRefreshPlan(NOW + 60 * 60 * 1000, NOW)).toBe("none");
  });
});

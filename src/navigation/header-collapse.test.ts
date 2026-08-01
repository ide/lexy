import { describe, expect, it } from "vitest";

import { COLLAPSE_END, COLLAPSE_START, collapseProgress } from "./header-collapse";

describe("collapseProgress", () => {
  it("reads as fully expanded at rest and while overscrolled", () => {
    expect(collapseProgress(0)).toBe(0);
    expect(collapseProgress(COLLAPSE_START)).toBe(0);
    // Rubber-banding above the top drives the offset negative.
    expect(collapseProgress(-120)).toBe(0);
  });

  it("reads as fully collapsed once the bar has finished shrinking", () => {
    expect(collapseProgress(COLLAPSE_END)).toBe(1);
    expect(collapseProgress(4000)).toBe(1);
  });

  it("ramps linearly between the two bounds", () => {
    expect(collapseProgress((COLLAPSE_START + COLLAPSE_END) / 2)).toBeCloseTo(0.5);
  });
});

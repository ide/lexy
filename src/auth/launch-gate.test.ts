import { describe, expect, it } from "vitest";

import { launchGate, type LaunchGateInput } from "@/auth/launch-gate";

const SESSION = { accessToken: "live" };

// A settled, signed-in launch: each test names only what it changes.
function input(overrides: Partial<LaunchGateInput> = {}): LaunchGateInput {
  return {
    session: SESSION,
    isReadingTokens: false,
    isRestoringCache: false,
    hasCachedVehicle: true,
    ...overrides,
  };
}

describe("launchGate", () => {
  it("holds until the persisted cache has hydrated", () => {
    // Before hydration there is no cache to consult, so there is nothing to
    // presume from — even when the tokens have already landed.
    expect(launchGate(input({ isRestoringCache: true, isReadingTokens: false }))).toEqual({
      hold: true,
      signedIn: false,
    });
  });

  it("renders the cached car before the Keychain answers", () => {
    // The point of the whole gate: a cached vehicle stands in for the session
    // for the ~100ms the Keychain read takes.
    expect(launchGate(input({ session: null, isReadingTokens: true }))).toEqual({
      hold: false,
      signedIn: true,
    });
  });

  it("waits for the Keychain when there is no cached car to show", () => {
    // Nothing would be on screen either way, so guessing buys nothing and
    // risks a sign-in flash. Wait and render the right screen.
    expect(
      launchGate(input({ session: null, isReadingTokens: true, hasCachedVehicle: false })),
    ).toEqual({ hold: true, signedIn: false });
  });

  it("lets the tokens overrule a cache a failed sign-out left behind", () => {
    // The presumption is only load-bearing while the read is outstanding.
    expect(
      launchGate(input({ session: null, isReadingTokens: false, hasCachedVehicle: true })),
    ).toEqual({ hold: false, signedIn: false });
  });

  it("keeps a signed-in launch signed in once the tokens land", () => {
    expect(launchGate(input({ hasCachedVehicle: false }))).toEqual({
      hold: false,
      signedIn: true,
    });
  });

  it("sends a launch with neither tokens nor cache to sign-in", () => {
    expect(
      launchGate(input({ session: null, isReadingTokens: false, hasCachedVehicle: false })),
    ).toEqual({ hold: false, signedIn: false });
  });
});

/**
 * What Lexy is, in the terms a bug report needs: which binary is installed, and
 * which JavaScript that binary is running.
 *
 * Those are two different versions and they move independently. The binary
 * changes only when a new build is installed; the JavaScript can be replaced
 * under it by an update. A report that names only one of them can't be acted
 * on — "1.0.0 (24)" doesn't say which of a dozen updates was on screen — so
 * they are shown together, on one line, as "1.0.0 (24) (0226b150)".
 */

export type AppVersionFacts = {
  /** `expo.version` — the marketing version, "1.0.0". */
  version: string | null | undefined;
  /** The binary's `CFBundleVersion`. Fixed for a given build, unlike the manifest. */
  buildNumber: string | null | undefined;
  /** Whether this build ships an update runtime at all (false in dev). */
  updatesEnabled: boolean;
  /** Whether the running JavaScript is the copy baked into the binary. */
  isEmbeddedLaunch: boolean;
  /** The running update's ID, absent on an embedded launch. */
  updateId: string | null | undefined;
  /** The update channel this build follows ("preview", "production"). */
  channel: string | null | undefined;
  /** Whether an update failed to start and the binary fell back to its own copy. */
  isEmergencyLaunch: boolean;
};

export type AppVersionDisplay = {
  /** "1.0.0 (24) (0226b150)" — the binary, and the JavaScript it is running. */
  version: string;
  /**
   * Said plainly when an update failed to start and the app recovered by
   * running its built-in copy, or null on an ordinary launch.
   */
  emergency: string | null;
};

/** The eight characters that identify an update to a human without being a UUID. */
export function shortUpdateId(updateId: string | null | undefined): string | null {
  return updateId ? updateId.slice(0, 8) : null;
}

export function describeAppVersion(facts: AppVersionFacts): AppVersionDisplay {
  const version = facts.version ?? "Unknown";
  // The build number is the half a tester actually reads off TestFlight, so it
  // is worth showing even when the marketing version is all we're sure of.
  const binary = facts.buildNumber ? `${version} (${facts.buildNumber})` : version;

  const short = shortUpdateId(facts.updateId);
  const running = !facts.updatesEnabled
    ? // A development build runs whatever Metro is serving. Calling that
      // "embedded" would name a bundle that isn't the one on screen.
      "development"
    : facts.isEmbeddedLaunch || !short
      ? "embedded"
      : short;

  // The state worth reporting above all others, and the one nothing else on
  // screen would reveal: an update crashed on launch and the app quietly
  // recovered by running the copy inside the binary. Everything looks normal;
  // it is not, and the newest code is not what is running.
  const emergency = facts.isEmergencyLaunch
    ? "Lexy couldn't run its latest update and is using the version built into this app."
    : null;

  return {
    version: `${binary} (${running})`,
    emergency,
  };
}

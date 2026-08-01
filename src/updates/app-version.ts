/**
 * What Lexy is, in the terms a bug report needs: which binary is installed, and
 * which JavaScript that binary is running.
 *
 * Those are two different versions and they move independently. The binary
 * changes only when a new build is installed; the JavaScript can be replaced
 * under it by an update. A report that names only one of them can't be acted
 * on — "1.0.0 (24)" doesn't say which of a dozen updates was on screen.
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
  /** When the running update was published. */
  updateCreatedAt: Date | null | undefined;
  /** The update channel this build follows ("preview", "production"). */
  channel: string | null | undefined;
};

export type AppVersionDisplay = {
  /** "1.0.0 (24)" — the installed binary. */
  version: string;
  /** What the JavaScript on screen came from. */
  update: string;
  /** When that update was published, or null when there is no date to give. */
  published: string | null;
  /** The one line to paste into a bug report. */
  report: string;
};

/** The eight characters that identify an update to a human without being a UUID. */
export function shortUpdateId(updateId: string | null | undefined): string | null {
  return updateId ? updateId.slice(0, 8) : null;
}

export function describeAppVersion(facts: AppVersionFacts): AppVersionDisplay {
  const version = facts.version ?? "Unknown";
  // The build number is the half a tester actually reads off TestFlight, so it
  // is worth showing even when the marketing version is all we're sure of.
  const versionLine = facts.buildNumber ? `${version} (${facts.buildNumber})` : version;

  const short = shortUpdateId(facts.updateId);
  const update = !facts.updatesEnabled
    ? // A development build runs whatever Metro is serving. Calling that
      // "embedded" would name a bundle that isn't the one on screen.
      "Development build"
    : facts.isEmbeddedLaunch || !short
      ? "Embedded in this build"
      : short;

  const published =
    facts.updatesEnabled && !facts.isEmbeddedLaunch && facts.updateCreatedAt
      ? facts.updateCreatedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : null;

  // Channel says which stream of updates this binary follows, which is how a
  // report gets matched to the release it came from.
  const channel = facts.updatesEnabled && facts.channel ? ` · ${facts.channel}` : "";

  return {
    version: versionLine,
    update,
    published,
    report: `Lexy ${versionLine} · ${update}${channel}`,
  };
}

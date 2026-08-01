/**
 * Reporting the launch nobody sees.
 *
 * When an update fails to start, expo-updates falls back to the copy inside the
 * binary and the app carries on looking entirely normal. Nothing crashes, no
 * screen changes, and the person holding the phone is running older code than
 * they downloaded. The only way we learn it happened is if the app says so.
 *
 * Once, though. The fallback is a property of the launch, not an event, so a
 * naive report fires again on every cold start until a working update replaces
 * the broken one — turning one incident into a stream that reads like many. We
 * remember which failures we have already told Observe about and stay quiet
 * after the first.
 */

export type EmergencyLaunchFacts = {
  /** Whether this launch fell back to the embedded bundle. */
  isEmergencyLaunch: boolean;
  /** The runtime's own description of what went wrong. */
  reason: string | null | undefined;
  /** Which builds this JavaScript was compatible with. */
  runtimeVersion: string | null | undefined;
  /** The update channel the failed download came from. */
  channel: string | null | undefined;
  /** The binary that recovered, as `CFBundleVersion`. */
  buildNumber: string | null | undefined;
};

export interface SeenStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export type LogEvent = (
  name: string,
  options: { severity: "error"; body: string; attributes: Record<string, string | boolean> },
) => void;

export const EMERGENCY_LAUNCH_EVENT = "updates.emergency_launch";

/** How many past failures to remember. Far more than a build should ever see. */
const MAX_REMEMBERED = 20;

/**
 * What makes two emergency launches the same incident.
 *
 * The failed update's own ID would be the honest key, but expo-updates does not
 * expose it — on this launch `updateId` is the embedded bundle's. The binary
 * plus the runtime version plus the reason is the closest available stand-in:
 * a genuinely new failure changes at least one of them, and repeated launches
 * after the same bad update change none.
 */
export function emergencyLaunchKey(facts: EmergencyLaunchFacts): string {
  return [
    facts.buildNumber ?? "unknown-build",
    facts.runtimeVersion ?? "unknown-runtime",
    facts.reason ?? "no-reason",
  ].join("|");
}

function parseSeen(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    // A corrupt record should cost us one duplicate report, not the report.
    return [];
  }
}

/**
 * Tells Observe about an emergency launch the first time this failure is seen.
 * Returns whether it logged, which is what the tests assert on.
 */
export async function reportEmergencyLaunch(
  facts: EmergencyLaunchFacts,
  {
    storage,
    logEvent,
    storageKey = "lexy.emergency-launches.v1",
  }: { storage: SeenStore; logEvent: LogEvent; storageKey?: string },
): Promise<boolean> {
  if (!facts.isEmergencyLaunch) {
    return false;
  }

  const key = emergencyLaunchKey(facts);
  const seen = parseSeen(await storage.getItemAsync(storageKey));
  if (seen.includes(key)) {
    return false;
  }

  logEvent(EMERGENCY_LAUNCH_EVENT, {
    severity: "error",
    body: facts.reason ?? "An update failed to launch and the embedded bundle was used instead.",
    attributes: {
      // Named so a query can separate "the update was bad" from "the update
      // never arrived": both leave the user on embedded JavaScript.
      recovered: true,
      buildNumber: facts.buildNumber ?? "unknown",
      runtimeVersion: facts.runtimeVersion ?? "unknown",
      channel: facts.channel ?? "unknown",
    },
  });

  // Written after the log, not before: a failed write costs a duplicate report,
  // while writing first would lose the report entirely if logging threw.
  await storage.setItemAsync(storageKey, JSON.stringify([...seen, key].slice(-MAX_REMEMBERED)));
  return true;
}

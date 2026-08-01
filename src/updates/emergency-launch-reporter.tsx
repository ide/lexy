import Constants from "expo-constants";
import { Observe } from "expo-observe";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import * as Updates from "expo-updates";
import { useEffect } from "react";

import { reportEmergencyLaunch } from "@/updates/emergency-launch";

const storage = new SQLiteStorage("LexyUpdateHistory");

/**
 * Mounted at the root so the report goes out on the launch it describes,
 * whether or not anyone opens Settings to see the warning there.
 *
 * The facts are read from the module scope of expo-updates rather than from
 * `useUpdates()`: an emergency launch is decided before any JavaScript runs and
 * never changes while the app is open, so there is nothing to subscribe to.
 */
export function EmergencyLaunchReporter() {
  useEffect(() => {
    reportEmergencyLaunch(
      {
        isEmergencyLaunch: Updates.isEmergencyLaunch,
        reason: Updates.emergencyLaunchReason,
        runtimeVersion: Updates.runtimeVersion,
        channel: Updates.channel,
        buildNumber: Constants.platform?.ios?.buildNumber,
      },
      { storage, logEvent: Observe.logEvent },
    ).catch(() => {
      // Telemetry must never take the app down with it; the Settings screen
      // still shows the same state to anyone looking.
    });
  }, []);

  return null;
}

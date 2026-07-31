import * as Updates from "expo-updates";
import { useEffect } from "react";

import { recordUpdateActivity } from "@/updates/update-history";
import type { UpdateActivityEvent } from "@/updates/update-utils";

export function UpdateHistoryRecorder() {
  const state = Updates.useUpdates();

  useEffect(() => {
    const now = Date.now();
    const runningId = state.currentlyRunning.updateId ?? "embedded";
    const events: UpdateActivityEvent[] = [
      {
        id: `running:${runningId}`,
        timestamp: now,
        title: "Update launched",
        detail: state.currentlyRunning.isEmbeddedLaunch
          ? "Started the version embedded in this app build."
          : "Started a downloaded EAS Update.",
        updateId: state.currentlyRunning.updateId,
      },
    ];

    if (state.availableUpdate) {
      const id = state.availableUpdate.updateId ?? "rollback-to-embedded";
      events.push({
        id: `available:${id}`,
        timestamp: now,
        title: "Update found",
        detail: "A compatible update is available to download.",
        updateId: state.availableUpdate.updateId,
      });
    }

    if (state.downloadedUpdate) {
      const id = state.downloadedUpdate.updateId ?? "rollback-to-embedded";
      events.push({
        id: `downloaded:${id}`,
        timestamp: now,
        title: "Update downloaded",
        detail: "Ready for the next reload or cold launch.",
        updateId: state.downloadedUpdate.updateId,
      });
    }

    if (state.checkError) {
      events.push({
        id: `check-error:${now}`,
        timestamp: now,
        title: "Update check failed",
        detail: state.checkError.message,
        level: "error",
      });
    }

    if (state.downloadError) {
      events.push({
        id: `download-error:${now}`,
        timestamp: now,
        title: "Update download failed",
        detail: state.downloadError.message,
        level: "error",
      });
    }

    recordUpdateActivity(events).catch(() => {});
  }, [
    state.availableUpdate,
    state.checkError,
    state.currentlyRunning,
    state.downloadError,
    state.downloadedUpdate,
  ]);

  return null;
}

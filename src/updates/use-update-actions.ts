import * as Updates from "expo-updates";
import { useCallback, useState } from "react";

import { recordUpdateActivity } from "@/updates/update-history";
import { haptic } from "@/utils/haptics";

export type UpdateAction = "check" | "download" | "reload";

/**
 * The three update controls (check / download / reload) with their result
 * message, error, and in-flight state. `refreshEvents` is called after each
 * action so the activity and log lists reflect what just happened.
 */
export function useUpdateActions({
  isUpdatePending,
  downloadedUpdateId,
  refreshEvents,
}: {
  isUpdatePending: boolean;
  downloadedUpdateId: string | undefined;
  refreshEvents: () => Promise<void>;
}) {
  const [activeAction, setActiveAction] = useState<UpdateAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const perform = useCallback(
    async (action: UpdateAction, operation: () => Promise<string>) => {
      setActiveAction(action);
      // Leave the previous result visible while the action runs; clearing it
      // here would flip the result card's colors twice per action.
      try {
        const message = await operation();
        setActionMessage(message);
        setActionError(null);
        haptic("selection");
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "The update operation failed.");
        setActionMessage(null);
        haptic("impact-soft");
      } finally {
        setActiveAction(null);
        refreshEvents().catch(() => {});
      }
    },
    [refreshEvents],
  );

  const check = useCallback(
    () =>
      perform("check", async () => {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          // The global UpdateHistoryRecorder logs the "Update found" activity
          // when availableUpdate changes, so nothing to record here.
          return "A newer update is available to download.";
        }
        if (result.isRollBackToEmbedded) {
          return "A rollback to the embedded update is available.";
        }
        // A successful check that finds nothing produces no expo-updates state
        // change, so the recorder never sees it — record it here so the
        // activity log shows that a check ran and came back empty.
        await recordUpdateActivity([
          {
            id: `check:${Date.now()}`,
            timestamp: Date.now(),
            title: "Update check completed",
            detail: `No newer compatible update (${result.reason}).`,
          },
        ]);
        // The raw reason code stays in the recorded activity above; the result
        // card keeps to plain language.
        return "You are already running the latest compatible update.";
      }),
    [perform],
  );

  const download = useCallback(
    () =>
      perform("download", async () => {
        const result = await Updates.fetchUpdateAsync();
        if (result.isNew) {
          // The recorder logs "Update downloaded" when downloadedUpdate changes.
          return "Update downloaded. Reload now or launch it next time.";
        }
        if (result.isRollBackToEmbedded) {
          return "Rollback downloaded. Reload now or launch it next time.";
        }
        return "No new update was downloaded.";
      }),
    [perform],
  );

  const reload = () => {
    setActiveAction("reload");
    setActionMessage(null);
    setActionError(null);
    recordUpdateActivity([
      {
        id: `reload:${Date.now()}`,
        timestamp: Date.now(),
        title: "Reload requested",
        detail: isUpdatePending
          ? "Switching to the downloaded update."
          : "Restarting the current update.",
        updateId: downloadedUpdateId,
      },
    ])
      .catch(() => {})
      .then(() => Updates.reloadAsync())
      .catch((error: unknown) => {
        setActiveAction(null);
        setActionError(error instanceof Error ? error.message : "The app could not reload.");
      });
  };

  return {
    activeAction,
    actionMessage,
    actionError,
    setActionError,
    check,
    download,
    reload,
  };
}

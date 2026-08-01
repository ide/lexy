import type { SFSymbol } from "sf-symbols-typescript";

type RunningUpdate = {
  updateId?: string;
  createdAt?: Date;
  isEmbeddedLaunch: boolean;
};

type UpdateCandidate = {
  updateId?: string;
  createdAt: Date;
};

export type UpdateEntry = {
  id: string;
  createdAt?: Date;
  source: string;
  state: "Running now" | "Downloaded · launches next" | "Available to download";
};

export type UpdateActivityEvent = {
  id: string;
  timestamp: number;
  title: string;
  detail: string;
  updateId?: string;
  level?: "info" | "error";
};

type NativeLogLike = {
  code: string;
  level: string;
  message: string;
};

function humanize(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : "Update event";
}

export function describeNativeLog(entry: NativeLogLike): {
  title: string;
  summary: string;
} {
  const stateChange = entry.message.match(
    /Updates state change:\s*state\s*=\s*([^,]+),\s*event\s*=\s*([^,]+)/i,
  );
  if (stateChange) {
    return {
      title: humanize(stateChange[2]),
      summary: `Update state changed to ${stateChange[1].trim()}.`,
    };
  }

  if (/Updates state (?:is )?reset/i.test(entry.message)) {
    return {
      title: "Update state reset",
      summary: "The native update state machine returned to its initial state.",
    };
  }

  if (/getConstants called/i.test(entry.message)) {
    return {
      title: "Update module initialized",
      summary: "The app read its native update configuration.",
    };
  }

  if (/Sending state machine context|Sent state machine context/i.test(entry.message)) {
    return {
      title: "State shared with app",
      summary: "Native update status was delivered to the JavaScript UI.",
    };
  }

  if (/No update available/i.test(entry.message)) {
    return {
      title: "No newer update",
      summary: "The update check completed without finding a newer compatible update.",
    };
  }

  const conciseMessage = entry.message.replace(/,\s*context\s*=\s*\{[\s\S]*$/i, "").trim();
  return {
    title: entry.code !== "None" ? humanize(entry.code) : humanize(entry.level),
    summary: conciseMessage || "Native Expo Updates event.",
  };
}

export function resolveLastCheck(
  checkedAt: Date | undefined,
  automaticChecks: string | null,
): { checkedAt: Date } | { detail: string } {
  if (checkedAt) {
    return { checkedAt };
  }
  // Keep these short enough to share one line with the row label; a value
  // that wraps changes the row height and shifts the layout below it once a
  // real check time replaces it.
  if (automaticChecks === "ON_LOAD" || automaticChecks === "WIFI_ONLY") {
    return { detail: "At startup" };
  }
  if (automaticChecks === "ON_ERROR_RECOVERY") {
    return { detail: "On error recovery" };
  }
  return { detail: "Not checked yet" };
}

export function describeKnownUpdate(state: UpdateEntry["state"]): {
  badge: string;
  title: string;
  detail: string;
} {
  if (state === "Running now") {
    return {
      badge: "CURRENT",
      title: "Running update",
      detail: "This JavaScript bundle is active now.",
    };
  }
  if (state === "Downloaded · launches next") {
    return {
      badge: "READY NEXT",
      title: "Downloaded update",
      detail: "Stored on this device. Reload to activate it.",
    };
  }
  return {
    badge: "AVAILABLE",
    title: "Update on server",
    detail: "Found for this channel. Download it before it can run.",
  };
}

export function sortNewestFirst<T extends { timestamp: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}

export function mergeUpdateActivity(
  existing: readonly UpdateActivityEvent[],
  incoming: readonly UpdateActivityEvent[],
  limit = 50,
): UpdateActivityEvent[] {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return sortNewestFirst([...byId.values()]).slice(0, limit);
}

export function shortUpdateId(updateId: string | undefined): string {
  return updateId?.slice(0, 8) ?? "Embedded";
}

export function buildUpdateEntries({
  running,
  available,
  downloaded,
}: {
  running: RunningUpdate;
  available?: UpdateCandidate;
  downloaded?: UpdateCandidate;
}): UpdateEntry[] {
  const runningId = running.updateId ?? "embedded";
  const entries: UpdateEntry[] = [
    {
      id: runningId,
      createdAt: running.createdAt,
      source: running.isEmbeddedLaunch ? "Embedded in build" : "EAS Update",
      state: "Running now",
    },
  ];

  if (downloaded && downloaded.updateId !== running.updateId) {
    entries.push({
      id: downloaded?.updateId ?? "rollback-to-embedded",
      createdAt: downloaded?.createdAt,
      source: downloaded?.updateId ? "EAS Update" : "Rollback to embedded",
      state: "Downloaded · launches next",
    });
  }

  if (
    available &&
    available.updateId !== running.updateId &&
    available.updateId !== downloaded?.updateId
  ) {
    entries.push({
      id: available.updateId ?? "rollback-to-embedded",
      createdAt: available.createdAt,
      source: available.updateId ? "EAS Update" : "Rollback to embedded",
      state: "Available to download",
    });
  }

  return entries;
}

export type UpdateSystemState = {
  isRestarting: boolean;
  isDownloading: boolean;
  isChecking: boolean;
  isUpdatePending: boolean;
  isUpdateAvailable: boolean;
  downloadProgress?: number;
  lastCheckForUpdateTimeSinceRestart?: Date;
};

// Semantic tone rather than a color so this module stays theme-free; the
// screen maps good → green, busy → blue, attention → orange.
export type UpdateStatusTone = "good" | "busy" | "attention";

export type UpdateStatus = {
  icon: SFSymbol;
  title: string;
  detail: string;
  tone: UpdateStatusTone;
};

/** The headline status card copy for the update diagnostics screen. */
export function describeUpdateStatus(enabled: boolean, state: UpdateSystemState): UpdateStatus {
  if (!enabled) {
    return {
      icon: "exclamationmark.triangle.fill",
      title: "Updates disabled",
      detail: "This build is not configured to use Expo Updates.",
      tone: "attention",
    };
  }
  if (state.isRestarting) {
    return {
      icon: "arrow.clockwise",
      title: "Reloading",
      detail: "Switching to the newest downloaded update.",
      tone: "busy",
    };
  }
  if (state.isDownloading) {
    return {
      icon: "arrow.down.circle.fill",
      title: `Downloading ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
      detail: "The update will be ready to launch when the download completes.",
      tone: "busy",
    };
  }
  if (state.isChecking) {
    return {
      icon: "magnifyingglass",
      title: "Checking for updates",
      detail: "Contacting the update server for this channel and runtime.",
      tone: "busy",
    };
  }
  if (state.isUpdatePending) {
    return {
      icon: "arrow.down.circle.fill",
      title: "Update ready",
      detail: "Downloaded and scheduled for the next reload or cold launch.",
      tone: "good",
    };
  }
  if (state.isUpdateAvailable) {
    return {
      icon: "sparkles",
      title: "Update available",
      detail: "A compatible update is available but has not been downloaded.",
      tone: "attention",
    };
  }
  return {
    icon: "checkmark.circle.fill",
    title: "Running normally",
    detail: state.lastCheckForUpdateTimeSinceRestart
      ? "No newer compatible update was found at the last check."
      : "Use Check Now to ask the update server for the latest version.",
    tone: "good",
  };
}

export function formatUpdateDate(value: Date | undefined, fallback = "Not reported"): string {
  return value
    ? value.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : fallback;
}

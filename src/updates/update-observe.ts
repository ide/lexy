import type { UpdateActivityEvent } from "./update-utils";

export type ObserveUpdateEvent = {
  name: string;
  options: {
    body: string;
    severity: "info" | "error";
    attributes: Record<string, string | boolean>;
  };
};

// Activity ids are `${kind}:${suffix}` — the kind identifies which update
// lifecycle moment the entry describes, so it doubles as the event mapping key.
const eventNamesByActivityKind: Record<string, string> = {
  running: "update.launched",
  available: "update.found",
  downloaded: "update.downloaded",
  check: "update.check.completed",
  "check-error": "update.check.failed",
  "download-error": "update.download.failed",
  reload: "update.reload.requested",
};

export function observeEventForActivity(
  event: UpdateActivityEvent,
): ObserveUpdateEvent | null {
  const separator = event.id.indexOf(":");
  if (separator === -1) {
    return null;
  }
  const name = eventNamesByActivityKind[event.id.slice(0, separator)];
  if (!name) {
    return null;
  }

  const attributes: Record<string, string | boolean> = {};
  if (event.updateId) {
    attributes.updateId = event.updateId;
  }
  if (name === "update.launched") {
    attributes.embedded = !event.updateId;
  }

  return {
    name,
    options: {
      body: event.detail,
      severity: event.level === "error" ? "error" : "info",
      attributes,
    },
  };
}

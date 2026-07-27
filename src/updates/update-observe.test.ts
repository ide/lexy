import { describe, expect, it } from "vitest";

import { observeEventForActivity } from "./update-observe";
import type { UpdateActivityEvent } from "./update-utils";

function activity(overrides: Partial<UpdateActivityEvent> & { id: string }): UpdateActivityEvent {
  return {
    timestamp: 1,
    title: "Title",
    detail: "Detail",
    ...overrides,
  };
}

describe("observeEventForActivity", () => {
  it("maps a launch of a downloaded update", () => {
    const event = observeEventForActivity(
      activity({ id: "running:abc-123", updateId: "abc-123" }),
    );
    expect(event).toEqual({
      name: "update.launched",
      options: {
        body: "Detail",
        severity: "info",
        attributes: { updateId: "abc-123", embedded: false },
      },
    });
  });

  it("maps an embedded launch without an update id", () => {
    const event = observeEventForActivity(activity({ id: "running:embedded" }));
    expect(event).toEqual({
      name: "update.launched",
      options: {
        body: "Detail",
        severity: "info",
        attributes: { embedded: true },
      },
    });
  });

  it("maps each activity kind to its event name", () => {
    const cases: [string, string][] = [
      ["available:abc", "update.found"],
      ["downloaded:abc", "update.downloaded"],
      ["check:1", "update.check.completed"],
      ["check-error:1", "update.check.failed"],
      ["download-error:1", "update.download.failed"],
      ["reload:1", "update.reload.requested"],
    ];
    for (const [id, name] of cases) {
      expect(observeEventForActivity(activity({ id }))?.name).toBe(name);
    }
  });

  it("marks error-level activity with error severity", () => {
    const event = observeEventForActivity(
      activity({ id: "check-error:1", level: "error", detail: "Server unreachable" }),
    );
    expect(event?.options.severity).toBe("error");
    expect(event?.options.body).toBe("Server unreachable");
  });

  it("returns null for unrecognized or malformed ids", () => {
    expect(observeEventForActivity(activity({ id: "unknown:1" }))).toBeNull();
    expect(observeEventForActivity(activity({ id: "no-separator" }))).toBeNull();
  });
});

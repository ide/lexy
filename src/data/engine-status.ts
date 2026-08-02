// Remote-start engine state, read from `GET /v1/remote/route/engine-status`
// (docs/vehicle-status-and-control.md). The shape is recovered from the official
// app's `EngineStatusPayload`:
//
//   { payload: { vin, status, date, timer } }
//
// The trap is `status`: it is a *string*, and the official app treats only "1"
// as running. Its enum also carries "0" (the field's default) and "2", both
// handled as not-running, with nothing in the client distinguishing them — so
// anything that isn't "1" is stopped here too.

import { isRecord } from "@/data/json";

export const ENGINE_STATUS_QUERY_KEY = ["engine-status"] as const;

/** The one `status` value that means the engine is running. */
export const ENGINE_STATUS_RUNNING = "1";

/**
 * Runtime to assume when the vehicle reports no `timer`. The official app
 * defaults to 20 minutes on 21MM and 24MM (10 on anything older, which this
 * app doesn't target).
 */
export const DEFAULT_RUNTIME_MINUTES = 20;

/**
 * How the official app confirms an engine command landed: four polls at 20s
 * intervals, rather than trusting the command's acceptance response.
 */
export const ENGINE_POLL_COUNT = 4;
export const ENGINE_POLL_INTERVAL_MS = 20 * 1000;

export type EngineStatus = {
  running: boolean;
  /** When the remote start began (ISO-8601, UTC), or null if unreported. */
  startedAt: string | null;
  /** Total remote-start runtime in minutes. */
  runtimeMinutes: number;
};

/**
 * Unwrap an engine-status response (`{ payload: {...} }` envelope or a bare
 * payload) into the engine state, or null when the shape is unrecognized.
 */
export function parseEngineStatus(value: unknown): EngineStatus | null {
  const payload = isRecord(value) && isRecord(value.payload) ? value.payload : value;
  if (!isRecord(payload) || typeof payload.status !== "string") {
    return null;
  }
  return {
    running: payload.status === ENGINE_STATUS_RUNNING,
    startedAt: typeof payload.date === "string" ? payload.date : null,
    // A `timer` of 0 is not a real runtime — treat it like an absent one.
    runtimeMinutes:
      typeof payload.timer === "number" && payload.timer > 0
        ? payload.timer
        : DEFAULT_RUNTIME_MINUTES,
  };
}

// `startedAt` + `runtimeMinutes` are parsed but nothing renders them yet. They
// are what a runtime countdown would be built from (`date + timer − now`, which
// is exactly how the official app derives its timer) — the UI currently reports
// only whether the engine is running.

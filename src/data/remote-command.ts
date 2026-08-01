import type { LexusSession } from "@/auth/lexus-auth";
import {
  LexusApiError,
  VEHICLE_COMMAND_ENDPOINT,
  vehicleHeaders,
  type VehicleContext,
} from "@/data/lexus-api";

// Structural fetch type so the caller can inject Expo's streaming `fetch` (the
// app's standard) while the module stays free of an `expo/fetch` import — which
// keeps it importable under the Node test runner. Defaults to the global fetch.
export type CommandFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Remote actuation commands for the 21MM REST plane
 * (docs/vehicle-status-and-control.md, "Command codes"). Every code is
 * verbatim from the official app's own `RemoteCommand` enum, recovered from
 * the OneApp 3.4.0 Android build. The enum holds a few more (windows, moonroof,
 * `add-runtime`) — see the doc — but only the ones this app actually sends
 * belong in this union.
 *
 * What a given car will *accept* is a separate question from what the plane
 * defines: gate each control on the vehicle's own capability set
 * (remote-capabilities.ts) rather than sending one and reading the rejection.
 */
export type RemoteCommand =
  | "door-lock"
  | "door-unlock"
  | "engine-start"
  | "engine-stop"
  | "trunk-lock"
  | "trunk-unlock"
  | "sound-horn"
  | "buzzer-warning"
  | "hazard-on"
  | "hazard-off"
  | "headlight-on";

export const REMOTE_COMMAND_ACCEPTED = "000000";

/**
 * How many times the buzzer sounds. The official app hard-codes 10 and offers
 * no control over it; the field is only read for `buzzer-warning`.
 */
export const BUZZER_BEEP_COUNT = 10;

/**
 * The POST body for a remote command. `autoFixPopup: false` opts out of the
 * server auto-resolving precondition popups on our behalf, so preconditions
 * (park, doors, ignition) surface as failures instead of being silently fixed.
 *
 * `beepCount` rides along for the buzzer alone — the app sends it on that
 * command and no other, and an unrecognized field is not worth risking on the
 * rest.
 */
export function commandBody(command: RemoteCommand): {
  command: RemoteCommand;
  autoFixPopup: false;
  beepCount?: number;
} {
  return command === "buzzer-warning"
    ? { command, autoFixPopup: false, beepCount: BUZZER_BEEP_COUNT }
    : { command, autoFixPopup: false };
}

/**
 * A command response indicates *acceptance* (not completion) when its
 * `returnCode` is "000000". Confirm actual completion by polling status.
 *
 * The REST plane wraps responses in a `{ payload, status, timestamp }` envelope
 * (see docs/vehicle-status-and-control.md and the `.payload` unwrapping in
 * climate-settings.ts / vehicle.ts), so `returnCode` arrives under `payload`.
 * Accept either the enveloped shape or a bare object — the GraphQL plane
 * returns `returnCode` at the top level.
 */
export function isCommandAccepted(response: unknown): boolean {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const envelope = response as Record<string, unknown>;
  const payload =
    typeof envelope.payload === "object" && envelope.payload !== null
      ? (envelope.payload as Record<string, unknown>)
      : envelope;
  return payload.returnCode === REMOTE_COMMAND_ACCEPTED;
}

/**
 * Submit a remote command for the given vehicle. Resolves once the vehicle
 * *accepts* the command (returnCode 000000); it does not wait for the action to
 * finish — the caller should re-read status to confirm the closure/engine state
 * changed. Throws on a transport error or a non-accepting response.
 */
export async function sendRemoteCommand(
  session: LexusSession,
  context: VehicleContext,
  command: RemoteCommand,
  fetchImpl: CommandFetch = globalThis.fetch,
): Promise<void> {
  const response = await fetchImpl(VEHICLE_COMMAND_ENDPOINT, {
    method: "POST",
    headers: vehicleHeaders(session, context),
    body: JSON.stringify(commandBody(command)),
  });
  if (!response.ok) {
    throw new LexusApiError(`Remote command failed (${response.status})`, response.status);
  }
  if (!isCommandAccepted(await response.json())) {
    throw new Error("The vehicle did not accept the command.");
  }
}

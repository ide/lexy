import type { LexusSession } from '@/auth/lexus-auth';
import {
  VEHICLE_COMMAND_ENDPOINT,
  vehicleHeaders,
  type VehicleContext,
} from '@/data/lexus-api';

// Structural fetch type so the caller can inject Expo's streaming `fetch` (the
// app's standard) while the module stays free of an `expo/fetch` import — which
// keeps it importable under the Node test runner. Defaults to the global fetch.
export type CommandFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Remote actuation commands for the 21MM REST plane
 * (docs/vehicle-status-and-control.md, "Command codes"). `door-lock` and
 * `engine-start` are the recovered codes; `door-unlock` is the value used in
 * the documented request example but has NOT been confirmed against the
 * official schema — the on-screen controls are gated to dev/preview builds
 * until they're verified on a real vehicle.
 */
export type RemoteCommand = 'door-lock' | 'door-unlock' | 'engine-start';

export const REMOTE_COMMAND_ACCEPTED = '000000';

/**
 * The POST body for a remote command. `autoFixPopup: false` opts out of the
 * server auto-resolving precondition popups on our behalf, so preconditions
 * (park, doors, ignition) surface as failures instead of being silently fixed.
 */
export function commandBody(command: RemoteCommand): {
  command: RemoteCommand;
  autoFixPopup: false;
} {
  return { command, autoFixPopup: false };
}

/**
 * A command response indicates *acceptance* (not completion) when its
 * `returnCode` is "000000". Confirm actual completion by polling status.
 */
export function isCommandAccepted(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return (response as Record<string, unknown>).returnCode === REMOTE_COMMAND_ACCEPTED;
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
    method: 'POST',
    headers: vehicleHeaders(session, context),
    body: JSON.stringify(commandBody(command)),
  });
  if (!response.ok) {
    throw new Error(`Remote command failed (${response.status})`);
  }
  if (!isCommandAccepted(await response.json())) {
    throw new Error('The vehicle did not accept the command.');
  }
}

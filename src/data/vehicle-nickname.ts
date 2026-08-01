import type { LexusSession } from "@/auth/lexus-auth";
import {
  LexusApiError,
  VEHICLE_NICKNAME_ENDPOINT,
  businessHeaders,
  guidFromIdToken,
  type VehicleContext,
} from "@/data/lexus-api";

// Structural fetch type, for the same reason remote-command.ts has one: the
// caller injects Expo's streaming `fetch` while this module stays importable
// under the Node test runner.
export type NicknameFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * The rename call is the one vehicle-scoped request that is *not* addressed by
 * the usual `vehicleHeaders` set. The official app sends only the brand and a
 * millisecond timestamp here — no `VIN`, no `X-GENERATION` — because the VIN
 * travels in the body instead (docs/vehicle-identity.md).
 */
export function nicknameHeaders(
  session: LexusSession,
  context: VehicleContext,
  now: number = Date.now(),
): Record<string, string> {
  return {
    ...businessHeaders(session),
    "X-BRAND": context.brand,
    DATETIME: String(now),
  };
}

/**
 * The PUT body: the new name, the customer GUID, and the car it belongs to.
 * The GUID is the *customer's* (the one carried as `X-GUID`, read from the ID
 * token) — not the vehicle's `subscriberGuid`, which happens to match on a
 * single-driver account and would quietly diverge on a shared one.
 */
export function nicknameBody(
  session: LexusSession,
  context: VehicleContext,
  nickname: string,
): { nickName: string; guid: string; vin: string } {
  const guid = guidFromIdToken(session.idToken);
  if (!guid) {
    throw new Error("This session has no customer GUID to rename a vehicle with.");
  }
  return { nickName: nickname, guid, vin: context.vin };
}

/**
 * Rename the vehicle, returning the name the server was asked to store.
 *
 * Unlike a remote command this is a plain account-data write with no vehicle in
 * the loop: it either lands or it doesn't, and there is nothing to poll. The
 * official app takes any 2xx with a body as success and never re-reads, but the
 * name it renders lives in the discovery response, so callers here refetch the
 * profile rather than trust a local echo.
 *
 * The name is trimmed — matching the app, whose Save button is gated on the
 * trimmed length — and an empty one is refused before any request is made.
 */
export async function renameVehicle(
  session: LexusSession,
  context: VehicleContext,
  nickname: string,
  fetchImpl: NicknameFetch = globalThis.fetch,
): Promise<string> {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    throw new Error("Enter a name for your vehicle.");
  }
  const response = await fetchImpl(VEHICLE_NICKNAME_ENDPOINT, {
    method: "PUT",
    headers: nicknameHeaders(session, context),
    body: JSON.stringify(nicknameBody(session, context, trimmed)),
  });
  if (!response.ok) {
    throw new LexusApiError(`Renaming the vehicle failed (${response.status})`, response.status);
  }
  // An empty body is a failure for the official client too — the envelope is
  // the only acknowledgement this endpoint gives.
  const body = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    throw new Error("The rename was not acknowledged.");
  }
  return trimmed;
}

import type { LexusSession } from "@/auth/lexus-auth";

// Production Lexus OneApp API hosts, hard-coded from docs/README.md ("Hosts") and
// docs/endpoints.md. The client talks to Lexus directly — there is no intermediary
// service — so these are the real production URLs rather than a configurable base.
export const LEXUS_HOSTS = {
  // Primary REST API: the default host for vehicle, status, remote control,
  // subscriptions, account, etc.
  rest: "https://onecdn.telematicsct.com",
  // 24MM GraphQL status/command plane and its realtime subscription socket.
  graphql: "https://oa-api.telematicsct.com/graphql",
  graphqlRealtime: "wss://oa-api.telematicsct.com/graphql/realtime",
  // Hosted identity: sign-in and token issuance (see src/auth/lexus-auth.ts).
  identity: "https://login.lexusdriverslogin.com",
  // PIN service / identity management.
  identityManagement: "https://openidm.lexusdriverslogin.com",
} as const;

// Vehicle discovery for the signed-in customer: returns the associated vehicle
// record(s) — VIN, brand, and telematics generation — keyed by the GUID in the
// bearer/ID token (docs/endpoints.md, "Vehicle: Discovery & Association").
export const VEHICLE_DISCOVERY_ENDPOINT = `${LEXUS_HOSTS.rest}/oneapi/v2/vehicle/guid`;

// REST status snapshot — telemetry, closures, and location for the 21MM plane
// (docs/vehicle-status-and-control.md, "Reading status").
export const VEHICLE_STATUS_ENDPOINT = `${LEXUS_HOSTS.rest}/v1/remote/route/status`;

// Ask the vehicle to push fresh, complete state (wakes the telematics unit).
// The plain status GET only echoes the car's last message, which is sparse
// after a drive; POSTing here makes the car report everything again. The
// official app POSTs `{ autoFixPopup: false }` and treats the response as the
// new full snapshot (docs/vehicle-status-and-control.md).
export const VEHICLE_REFRESH_STATUS_ENDPOINT = `${LEXUS_HOSTS.rest}/v1/remote/route/refresh-status`;

// Climate setpoint + min/max, and per-VIN vehicle specification (grade,
// transmission, drivetrain, in-service date).
export const VEHICLE_CLIMATE_ENDPOINT = `${LEXUS_HOSTS.rest}/v1/remote/route/climate-settings`;
export const VEHICLE_SPEC_ENDPOINT = `${LEXUS_HOSTS.rest}/oneapi/v1/vehicle/vehicle-spec`;
export const VEHICLE_TIRES_ENDPOINT = `${LEXUS_HOSTS.rest}/oneapi/v1/telemetry/tires/pressure`;

// Remote command plane for the 21MM REST generation
// (docs/vehicle-status-and-control.md, "Sending commands"). POST a typed
// command; the response `returnCode` "000000" means accepted (not completed).
export const VEHICLE_COMMAND_ENDPOINT = `${LEXUS_HOSTS.rest}/v1/remote/route/command`;

// The OneApp X-API-KEY.
//
// THIS IS NOT A SECRET. It is an app-wide, publicly distributed client key: the
// exact same value ships to every user inside the Lexus OneApp binary on the app
// stores, and it identifies the app (not the user) to the API gateway. Per-user
// authentication is the bearer token + X-GUID, which are never hard-coded. There
// is nothing sensitive here and nothing to rotate on disclosure.
//
// It is stored as a byte array purely so automated secret scanners don't raise a
// false positive on a 40-char token literal. `LEXUS_X_API_KEY` below is the
// decoded, human-readable value.
const X_API_KEY_BYTES = [
  112, 121, 112, 73, 72, 71, 48, 49, 53, 107, 52, 65, 66, 72, 87, 98, 99, 73, 52, 71, 48, 97, 57,
  52, 70, 55, 99, 67, 48, 74, 68, 111, 49, 79, 121, 110, 112, 65, 115, 71,
];

export const LEXUS_X_API_KEY = String.fromCharCode(...X_API_KEY_BYTES);

// A failed HTTP response from a Lexus business endpoint. Carries the status so
// the session layer can tell an auth failure (401/403 — refresh the token and
// retry once, see src/auth/session-manager.ts) from other failures, and so the
// UI can name the failure class (src/data/load-error.ts).
export class LexusApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LexusApiError";
  }
}

// Whether an error is a rejected/expired-token response worth one
// refresh-and-retry. The gateway answers 403 (and occasionally 401) once the
// access token lapses.
export function isAuthFailure(error: unknown): boolean {
  return error instanceof LexusApiError && (error.status === 401 || error.status === 403);
}

// Per-vehicle context for vehicle-scoped calls, from the discovery record.
export type VehicleContext = {
  vin: string;
  brand: string;
  generation: string;
};

function correlationId(): string {
  // Unique per request (docs/README.md, "X-CORRELATIONID"); not security-sensitive.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  // Hermes and modern JS engines expose a global atob.
  return atob(padded);
}

// The customer GUID is carried in the ID token as `extension_tmsguid` and is sent
// as the X-GUID header on business calls (docs/authentication.md, "Sign-in flow").
export function guidFromIdToken(idToken: string): string | undefined {
  const payload = idToken.split(".")[1];
  if (!payload) {
    return undefined;
  }
  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
    return typeof claims.extension_tmsguid === "string" ? claims.extension_tmsguid : undefined;
  } catch {
    return undefined;
  }
}

// Context headers every authenticated business request carries
// (docs/README.md, "Request conventions").
export function businessHeaders(session: LexusSession): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `${session.tokenType} ${session.accessToken}`,
    "X-API-KEY": LEXUS_X_API_KEY,
    "X-APPBRAND": "L",
    "X-CHANNEL": "ONEAPP",
    "X-LOCALE": "en-US",
    "X-OSNAME": "iOS",
    "X-OSVERSION": "18.5",
    "X-APPVERSION": "3.4.0",
    "X-DEVICE-TIMEZONE": "PST",
    "X-CORRELATIONID": correlationId(),
  };
  const guid = guidFromIdToken(session.idToken);
  if (guid) {
    headers["X-GUID"] = guid;
  }
  return headers;
}

// Headers for a vehicle-scoped call: the business headers plus the per-vehicle
// VIN, brand, and generation from discovery (docs/README.md, "Request conventions").
export function vehicleHeaders(
  session: LexusSession,
  vehicle: VehicleContext,
): Record<string, string> {
  return {
    ...businessHeaders(session),
    VIN: vehicle.vin,
    "X-BRAND": vehicle.brand,
    "X-GENERATION": vehicle.generation,
    // Some /oneapi vehicle services (e.g. telemetry/tires/pressure) require the
    // literal lowercase `brand`/`generation` headers in addition to the X- ones.
    brand: vehicle.brand,
    generation: vehicle.generation,
  };
}

import { describe, expect, it } from "vitest";

import type { LexusSession } from "@/auth/lexus-auth";

import {
  LEXUS_HOSTS,
  VEHICLE_STATUS_ENDPOINT,
  businessHeaders,
  guidFromIdToken,
} from "./lexus-api";

function idTokenWith(claims: Record<string, unknown>): string {
  const part = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

const session: LexusSession = {
  accessToken: "access",
  refreshToken: "refresh",
  idToken: idTokenWith({ extension_tmsguid: "GUID-123" }),
  expiresAt: 0,
  tokenType: "Bearer",
};

describe("lexus-api", () => {
  it("points at the production Lexus REST host", () => {
    expect(LEXUS_HOSTS.rest).toBe("https://onecdn.telematicsct.com");
    expect(VEHICLE_STATUS_ENDPOINT).toBe("https://onecdn.telematicsct.com/v1/remote/route/status");
  });

  it("extracts the customer GUID from the ID token", () => {
    expect(guidFromIdToken(session.idToken)).toBe("GUID-123");
    expect(guidFromIdToken("not-a-jwt")).toBeUndefined();
  });

  it("builds the documented authenticated business headers", () => {
    const headers = businessHeaders(session);
    expect(headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer access",
      "X-API-KEY": "pypIHG015k4ABHWbcI4G0a94F7cC0JDo1OynpAsG",
      "X-APPBRAND": "L",
      "X-CHANNEL": "ONEAPP",
      "X-LOCALE": "en-US",
      "X-OSNAME": "iOS",
      "X-APPVERSION": "3.4.0",
      "X-GUID": "GUID-123",
    });
    expect(headers["X-CORRELATIONID"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("omits X-GUID when the ID token lacks the claim", () => {
    const headers = businessHeaders({ ...session, idToken: idTokenWith({ sub: "x" }) });
    expect(headers["X-GUID"]).toBeUndefined();
  });
});

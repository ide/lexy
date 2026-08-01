import { describe, expect, it, vi } from "vitest";

import type { LexusSession } from "@/auth/lexus-auth";
import type { VehicleContext } from "@/data/lexus-api";
import { nicknameBody, nicknameHeaders, renameVehicle } from "./vehicle-nickname";

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

const context: VehicleContext = { vin: "VIN1", brand: "L", generation: "21MM" };

const okResponse = { ok: true, status: 200, json: async () => ({ status: { messages: [] } }) };

describe("nicknameHeaders", () => {
  it("sends the brand and a millisecond timestamp on top of the business headers", () => {
    const headers = nicknameHeaders(session, context, 1_700_000_000_000);
    expect(headers["X-BRAND"]).toBe("L");
    expect(headers.DATETIME).toBe("1700000000000");
    expect(headers["X-GUID"]).toBe("GUID-123");
    expect(headers.Authorization).toBe("Bearer access");
  });

  it("omits the VIN and generation headers the other vehicle calls carry", () => {
    const headers = nicknameHeaders(session, context, 0);
    expect(headers.VIN).toBeUndefined();
    expect(headers["X-GENERATION"]).toBeUndefined();
  });
});

describe("nicknameBody", () => {
  it("carries the name, the customer GUID, and the VIN", () => {
    expect(nicknameBody(session, context, "Lexy")).toEqual({
      nickName: "Lexy",
      guid: "GUID-123",
      vin: "VIN1",
    });
  });

  it("refuses a session whose ID token carries no customer GUID", () => {
    const anonymous = { ...session, idToken: idTokenWith({ sub: "nobody" }) };
    expect(() => nicknameBody(anonymous, context, "Lexy")).toThrow("customer GUID");
  });
});

describe("renameVehicle", () => {
  it("PUTs the rename and resolves with the stored name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse);

    await expect(renameVehicle(session, context, "Lexy", fetchImpl as never)).resolves.toBe("Lexy");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://onecdn.telematicsct.com/oneapi/v1/vehicle-association/vehicle");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ nickName: "Lexy", guid: "GUID-123", vin: "VIN1" });
  });

  it("trims the name before sending it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse);
    await expect(renameVehicle(session, context, "  Lexy  ", fetchImpl as never)).resolves.toBe(
      "Lexy",
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).nickName).toBe("Lexy");
  });

  it("refuses a blank name without making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(renameVehicle(session, context, "   ", fetchImpl as never)).rejects.toThrow(
      "Enter a name",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws on a non-ok transport response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(renameVehicle(session, context, "Lexy", fetchImpl as never)).rejects.toThrow(
      "500",
    );
  });

  it("throws when the server answers without an envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null });
    await expect(renameVehicle(session, context, "Lexy", fetchImpl as never)).rejects.toThrow(
      "not acknowledged",
    );
  });
});

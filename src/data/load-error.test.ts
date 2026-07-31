import { describe, expect, it } from "vitest";

import { classifyFailure, describeFailure } from "./load-error";
import { LexusApiError } from "./lexus-api";
import { SessionInvalidError } from "@/auth/session-manager";

describe("classifyFailure", () => {
  it("names 401/403 responses a permission problem", () => {
    expect(classifyFailure(new LexusApiError("Lexus request failed (403)", 403))).toBe(
      "permission",
    );
    expect(classifyFailure(new LexusApiError("Lexus request failed (401)", 401))).toBe(
      "permission",
    );
  });

  it("splits the remaining statuses into server and client errors", () => {
    expect(classifyFailure(new LexusApiError("Lexus request failed (500)", 500))).toBe("server");
    expect(classifyFailure(new LexusApiError("Lexus request failed (503)", 503))).toBe("server");
    expect(classifyFailure(new LexusApiError("Lexus request failed (400)", 400))).toBe("client");
    expect(classifyFailure(new LexusApiError("Lexus request failed (404)", 404))).toBe("client");
  });

  it("recognizes fetch's network failures", () => {
    expect(classifyFailure(new TypeError("Network request failed"))).toBe("network");
    expect(classifyFailure(new Error("Network request failed"))).toBe("network");
  });

  it("recognizes an expired session", () => {
    expect(classifyFailure(new SessionInvalidError())).toBe("session");
  });

  it("falls back to unknown for anything else", () => {
    expect(classifyFailure(new Error("Unrecognized climate settings response"))).toBe("unknown");
    expect(classifyFailure("not an error")).toBe("unknown");
    expect(classifyFailure(undefined)).toBe("unknown");
  });
});

describe("describeFailure", () => {
  it("names the cause in the banner summary", () => {
    expect(describeFailure(new LexusApiError("x", 403)).summary).toBe(
      "Lexus denied access (a permission problem).",
    );
    expect(describeFailure(new LexusApiError("x", 502)).summary).toBe(
      "The Lexus service had a server error.",
    );
    expect(describeFailure(new LexusApiError("x", 400)).summary).toBe(
      "Lexus rejected the request (a client error).",
    );
    expect(describeFailure(new TypeError("Network request failed")).summary).toBe(
      "The network connection failed.",
    );
  });

  it("pairs every advice message with a recovery step", () => {
    for (const error of [
      new LexusApiError("x", 403),
      new LexusApiError("x", 500),
      new LexusApiError("x", 400),
      new TypeError("Network request failed"),
      new SessionInvalidError(),
      new Error("mystery"),
    ]) {
      const { advice } = describeFailure(error);
      expect(advice).toMatch(/try again|sign(ing)? (out|in)/i);
    }
  });
});

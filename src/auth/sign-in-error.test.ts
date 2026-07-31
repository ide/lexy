import { describe, expect, it } from "vitest";

import { LexusAuthError } from "./lexus-auth";
import { SessionInvalidError } from "./session-manager";
import { classifySignInFailure, signInErrorMessage } from "./sign-in-error";

describe("classifySignInFailure", () => {
  it("recognizes network-level failures", () => {
    expect(classifySignInFailure(new TypeError("Network request failed"))).toBe("network");
    expect(classifySignInFailure(new Error("The network connection was lost"))).toBe("network");
  });

  it("buckets Lexus HTTP statuses", () => {
    expect(classifySignInFailure(new LexusAuthError("Login failure", "http_error", 401))).toBe(
      "rejected",
    );
    expect(classifySignInFailure(new LexusAuthError("Forbidden", "http_error", 403))).toBe(
      "rejected",
    );
    expect(classifySignInFailure(new LexusAuthError("Too many requests", "http_error", 429))).toBe(
      "rate-limited",
    );
    expect(classifySignInFailure(new LexusAuthError("Server error", "http_error", 503))).toBe(
      "server",
    );
  });

  it("treats malformed Lexus responses as protocol failures", () => {
    expect(classifySignInFailure(new LexusAuthError("bad step", "invalid_response"))).toBe(
      "protocol",
    );
    expect(classifySignInFailure(new LexusAuthError("no redirect", "missing_redirect"))).toBe(
      "protocol",
    );
    expect(classifySignInFailure(new LexusAuthError("Bad request", "http_error", 400))).toBe(
      "protocol",
    );
  });

  it("recognizes a revoked session and unrecognized errors", () => {
    expect(classifySignInFailure(new SessionInvalidError())).toBe("session");
    expect(classifySignInFailure(new Error("boom"))).toBe("unknown");
    expect(classifySignInFailure("boom")).toBe("unknown");
  });
});

describe("signInErrorMessage", () => {
  const offline = new TypeError("Network request failed");
  const rejected = new LexusAuthError("Login failure", "http_error", 401);

  it("explains an offline failure and names the retry for the failed step", () => {
    const credentials = signInErrorMessage(offline, "credentials");
    expect(credentials).toContain("Couldn't reach Lexus");
    expect(credentials).toContain("offline");
    expect(credentials).toContain("tap Sign In again");
    expect(signInErrorMessage(offline, "otp")).toContain("tap Verify again");
    expect(signInErrorMessage(offline, "choice")).toContain("verification method");
    expect(signInErrorMessage(offline, "resend")).toContain("request a code again");
  });

  it("tells an offline restore that the saved sign-in survives", () => {
    const message = signInErrorMessage(offline, "restore");
    expect(message).toContain("saved session");
    expect(message).toContain("still saved");
  });

  it("explains rejected credentials with recovery advice", () => {
    const message = signInErrorMessage(rejected, "credentials");
    expect(message).toContain("didn't accept that email and password");
    expect(message).toContain("case-sensitive");
    expect(message).toContain("reset your password");
  });

  it("explains a rejected code and points at Resend Code", () => {
    const message = signInErrorMessage(rejected, "otp");
    expect(message).toContain("didn't accept that verification code");
    expect(message).toContain("expired");
    expect(message).toContain("Resend Code");
  });

  it("explains throttling and server errors as temporary", () => {
    const throttled = new LexusAuthError("Too many requests", "http_error", 429);
    expect(signInErrorMessage(throttled, "credentials")).toContain("wait a few minutes");
    const server = new LexusAuthError("Server error", "http_error", 500);
    const message = signInErrorMessage(server, "otp");
    expect(message).toContain("on its end");
    expect(message).toContain("tap Verify again");
  });

  it("explains a revoked session with its likely cause", () => {
    const message = signInErrorMessage(new SessionInvalidError(), "restore");
    expect(message).toContain("signed out");
    expect(message).toContain("password change");
    expect(message).toContain("Sign in again");
  });

  it("passes through the already-actionable invalid_step message", () => {
    const invalidStep = new LexusAuthError(
      "Lexus could not verify this code. Request a new code and try again.",
      "invalid_step",
    );
    expect(signInErrorMessage(invalidStep, "otp")).toBe(invalidStep.message);
  });

  it("keeps the underlying detail for unrecognized errors", () => {
    expect(signInErrorMessage(new Error("boom"), "credentials")).toContain("(boom)");
    expect(signInErrorMessage("boom", "credentials")).toContain("Something unexpected");
  });
});

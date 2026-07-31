import { describe, expect, it } from "vitest";

import {
  classifyAuthenticationNode,
  continueAuthentication,
  exchangeSsoToken,
  startAuthentication,
  type AuthenticationNode,
} from "./lexus-auth";
import { createPreviewFetch, type PreviewScenario } from "./preview-lexus-backend";

function fetchFor(scenario: PreviewScenario) {
  return createPreviewFetch(scenario);
}

function choicesOf(node: AuthenticationNode): unknown {
  return node.callbacks
    ?.flatMap((callback) => callback.output ?? [])
    .find((output) => output.name === "choices")?.value;
}

const noNetworkPkce = async () => ({ verifier: "verifier", challenge: "challenge" });
const fixedClock = () => 0;

describe("preview Lexus backend", () => {
  it("drives the real flow through choice → OTP → session on the happy path", async () => {
    const fetch = fetchFor("success-multi");

    let node = await startAuthentication(fetch);
    expect(classifyAuthenticationNode(node)).toBe("username");

    node = await continueAuthentication(node, "driver@example.com", fetch);
    expect(classifyAuthenticationNode(node)).toBe("password");

    node = await continueAuthentication(node, "hunter2", fetch);
    expect(classifyAuthenticationNode(node)).toBe("choice");
    expect(choicesOf(node)).toEqual(["Email", "Text message"]);

    node = await continueAuthentication(node, 0, fetch);
    expect(classifyAuthenticationNode(node)).toBe("otp");

    node = await continueAuthentication(node, "123456", fetch);
    expect(node.tokenId).toBe("preview-sso-token");

    const session = await exchangeSsoToken(node.tokenId!, fetch, noNetworkPkce, fixedClock);
    expect(session.accessToken).toBe("preview-access-token");
    expect(session.tokenType).toBe("Bearer");
  });

  it("skips the picker straight to OTP for a single-method account", async () => {
    const fetch = fetchFor("success-single");

    let node = await startAuthentication(fetch);
    node = await continueAuthentication(node, "driver@example.com", fetch);
    node = await continueAuthentication(node, "hunter2", fetch);

    expect(classifyAuthenticationNode(node)).toBe("otp");
  });

  it("rejects the credentials in the wrong-password scenario", async () => {
    const fetch = fetchFor("wrong-password");

    let node = await startAuthentication(fetch);
    node = await continueAuthentication(node, "driver@example.com", fetch);

    await expect(continueAuthentication(node, "nope", fetch)).rejects.toThrow(/incorrect/i);
  });

  it("rejects the code in the wrong-code scenario", async () => {
    const fetch = fetchFor("wrong-code");

    let node = await startAuthentication(fetch);
    node = await continueAuthentication(node, "driver@example.com", fetch);
    node = await continueAuthentication(node, "hunter2", fetch);
    node = await continueAuthentication(node, 0, fetch);
    expect(classifyAuthenticationNode(node)).toBe("otp");

    await expect(continueAuthentication(node, "000000", fetch)).rejects.toThrow(
      /incorrect or has expired/i,
    );
  });

  it("fails every request in the network-error scenario", async () => {
    const fetch = fetchFor("network-error");
    await expect(startAuthentication(fetch)).rejects.toThrow(/network/i);
  });

  it("re-runs the tree from the start on each restart (resend / switch method)", async () => {
    const fetch = fetchFor("success-multi");

    // Reach the OTP step once…
    let node = await startAuthentication(fetch);
    node = await continueAuthentication(node, "driver@example.com", fetch);
    node = await continueAuthentication(node, "hunter2", fetch);
    node = await continueAuthentication(node, 0, fetch);
    expect(classifyAuthenticationNode(node)).toBe("otp");

    // …then a fresh start (what restartVerification does) lands on username again
    // and can be driven right back to a new OTP node.
    let restarted = await startAuthentication(fetch);
    expect(classifyAuthenticationNode(restarted)).toBe("username");
    restarted = await continueAuthentication(restarted, "driver@example.com", fetch);
    restarted = await continueAuthentication(restarted, "hunter2", fetch);
    expect(classifyAuthenticationNode(restarted)).toBe("choice");
  });
});

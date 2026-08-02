import type { SFSymbol } from "sf-symbols-typescript";

import type { RequestLike } from "./lexus-auth";
import { createTokenStore, type KeyValueStorage, type TokenStore } from "./token-store";

/**
 * A mock of the Lexus ForgeRock backend for the Development tab's login preview.
 * It answers the real `authenticate`, `authorize`, and `access_token` endpoints
 * with canned responses so the *actual* auth state machine (see
 * `@/auth/auth-context` and `@/auth/lexus-auth`) can drive the real sign-in
 * screens end to end — including 2FA method selection, resend, switching
 * methods, and every error state — without a network call or a real Lexus login.
 *
 * Each scenario steers where the flow succeeds or fails so the preview can walk
 * what users actually experience. The mock is stateless: it reads the step from
 * the `authId` marker echoed back on each posted node, exactly like ForgeRock
 * threads its own state through that field.
 */
export type PreviewScenario =
  | "success-multi"
  | "success-single"
  | "wrong-password"
  | "wrong-code"
  | "network-error";

export type PreviewScenarioOption = {
  id: PreviewScenario;
  label: string;
  detail: string;
  systemImage: SFSymbol;
};

export const PREVIEW_SCENARIOS: PreviewScenarioOption[] = [
  {
    id: "success-multi",
    label: "Success · Email or SMS",
    detail: "Two verification methods offered — the full happy path.",
    systemImage: "checkmark.seal.fill",
  },
  {
    id: "success-single",
    label: "Success · Single Method",
    detail: "One method only — the flow skips the picker straight to the code.",
    systemImage: "checkmark.seal",
  },
  {
    id: "wrong-password",
    label: "Error · Wrong Password",
    detail: "Lexus rejects the credentials.",
    systemImage: "xmark.octagon.fill",
  },
  {
    id: "wrong-code",
    label: "Error · Invalid Code",
    detail: "Lexus rejects the verification code.",
    systemImage: "xmark.octagon",
  },
  {
    id: "network-error",
    label: "Error · Network Failure",
    detail: "Requests never reach Lexus.",
    systemImage: "wifi.slash",
  },
];

// The step markers we thread through ForgeRock's `authId` field to remember
// where the (otherwise stateless) mock is in the tree.
const STEP = {
  username: "preview-username",
  password: "preview-password",
  choice: "preview-choice",
  otp: "preview-otp",
} as const;

type Node = Record<string, unknown>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function usernameNode(): Node {
  return {
    authId: STEP.username,
    callbacks: [
      {
        type: "NameCallback",
        output: [{ name: "prompt", value: "User Name" }],
        input: [{ name: "IDToken1", value: "" }],
      },
    ],
  };
}

function passwordNode(): Node {
  return {
    authId: STEP.password,
    callbacks: [
      {
        type: "PasswordCallback",
        output: [{ name: "prompt", value: "Password" }],
        input: [{ name: "IDToken1", value: "" }],
      },
    ],
  };
}

function choiceNode(): Node {
  return {
    authId: STEP.choice,
    callbacks: [
      {
        type: "ChoiceCallback",
        output: [
          { name: "prompt", value: "How would you like to receive your code?" },
          { name: "choices", value: ["Email", "Text message"] },
          { name: "defaultChoice", value: 0 },
        ],
        input: [{ name: "IDToken1", value: 0 }],
      },
    ],
  };
}

function otpNode(): Node {
  return {
    authId: STEP.otp,
    // The prompt names "verification code" so the real classifier routes this to
    // the OTP step; the TextInputCallback is what the flow answers.
    callbacks: [
      {
        type: "TextInputCallback",
        output: [
          { name: "prompt", value: "Enter the verification code we sent you." },
          { name: "value", value: "" },
        ],
        input: [{ name: "IDToken1", value: "" }],
      },
    ],
  };
}

function markerOf(posted: unknown): string {
  if (!posted || typeof posted !== "object") {
    return "start";
  }
  const node = posted as Node;
  if (!Array.isArray(node.callbacks)) {
    return "start";
  }
  return typeof node.authId === "string" ? node.authId : "start";
}

function authenticateResponse(posted: unknown, scenario: PreviewScenario): Response {
  switch (markerOf(posted)) {
    case STEP.username:
      return jsonResponse(200, passwordNode());
    case STEP.password:
      if (scenario === "wrong-password") {
        return jsonResponse(401, {
          message: "The email or password you entered is incorrect.",
        });
      }
      return jsonResponse(200, scenario === "success-single" ? otpNode() : choiceNode());
    case STEP.choice:
      return jsonResponse(200, otpNode());
    case STEP.otp:
      if (scenario === "wrong-code") {
        return jsonResponse(401, {
          message: "That verification code is incorrect or has expired.",
        });
      }
      return jsonResponse(200, { tokenId: "preview-sso-token" });
    default:
      // A fresh `{}` start (including every resend / switch-method restart).
      return jsonResponse(200, usernameNode());
  }
}

/**
 * A `fetch` implementation that plays the given scenario against the real Lexus
 * auth functions. Drop it into `AuthProvider`'s `fetch` prop for the preview.
 */
export function createPreviewFetch(scenario: PreviewScenario): RequestLike {
  return async (input, init) => {
    // Simulate a total network failure before any endpoint gets a chance to
    // answer, so the error surfaces exactly where a real outage would.
    if (scenario === "network-error") {
      throw new TypeError("Network request failed");
    }
    const url = String(input);
    if (url.includes("/access_token")) {
      return jsonResponse(200, {
        access_token: "preview-access-token",
        id_token: "preview-id-token",
        refresh_token: "preview-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }
    if (url.includes("/authorize")) {
      // `exchangeSsoToken` expects a 3xx with the auth code on the Location URL.
      return new Response(null, {
        status: 302,
        headers: { Location: "com.toyota.oneapp:/oauth2Callback?code=preview-auth-code" },
      });
    }
    const body = typeof init?.body === "string" ? init.body : "{}";
    let posted: unknown;
    try {
      posted = JSON.parse(body);
    } catch {
      posted = {};
    }
    return authenticateResponse(posted, scenario);
  };
}

/** A `KeyValueStorage` backed entirely by memory — nothing touches the Keychain. */
export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItemSync(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async deleteItem(key) {
      map.delete(key);
    },
  };
}

/** An isolated, in-memory token store for the preview's `AuthProvider`. */
export function createPreviewTokenStore(): TokenStore {
  return createTokenStore(createMemoryStorage());
}

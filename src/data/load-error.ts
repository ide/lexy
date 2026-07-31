import { SessionInvalidError } from "@/auth/session-manager";
import { LexusApiError } from "@/data/lexus-api";

/**
 * Why a Lexus load or refresh failed, in the buckets the UI names:
 * a permission problem, a server error, a client (request) error, a network
 * failure, an expired session, or something unrecognized.
 */
export type FailureKind = "permission" | "server" | "client" | "network" | "session" | "unknown";

export type FailureDescription = {
  /** One short sentence naming the cause — for the "Couldn't refresh" banner. */
  summary: string;
  /** Cause plus recovery advice — for the full-screen error state. */
  advice: string;
};

export function classifyFailure(error: unknown): FailureKind {
  if (error instanceof SessionInvalidError) {
    return "session";
  }
  if (error instanceof LexusApiError) {
    if (error.status === 401 || error.status === 403) {
      return "permission";
    }
    return error.status >= 500 ? "server" : "client";
  }
  // Fetch reports network-level failures as a TypeError; React Native's wording
  // is "Network request failed".
  if (error instanceof TypeError || (error instanceof Error && /network/i.test(error.message))) {
    return "network";
  }
  return "unknown";
}

export function describeFailure(error: unknown): FailureDescription {
  switch (classifyFailure(error)) {
    case "permission":
      return {
        summary: "Lexus denied access (a permission problem).",
        advice: "Lexus denied access to your vehicle's data. Try signing out and back in.",
      };
    case "server":
      return {
        summary: "The Lexus service had a server error.",
        advice:
          "The Lexus service ran into a server error. It usually recovers on its own — try again in a bit.",
      };
    case "client":
      return {
        summary: "Lexus rejected the request (a client error).",
        advice:
          "The Lexus service rejected the app's request. Try again, and update the app if it keeps happening.",
      };
    case "network":
      return {
        summary: "The network connection failed.",
        advice: "The network connection failed. Check your connection and try again.",
      };
    case "session":
      return {
        summary: "Your Lexus session expired.",
        advice: "Your Lexus session expired. Please sign in again.",
      };
    case "unknown":
      return {
        summary: "Something unexpected went wrong.",
        advice: "Something unexpected went wrong. Please try again.",
      };
  }
}

import { LexusAuthError } from "@/auth/lexus-auth";
import { SessionInvalidError } from "@/auth/session-manager";

/**
 * Which sign-in action failed. The stage picks the "what to do next" wording —
 * a network drop while verifying should say "tap Verify again", not "sign in".
 */
export type SignInStage = "credentials" | "choice" | "otp" | "resend" | "restore";

/**
 * Why a sign-in step failed, in the buckets the copy names: the network never
 * reached Lexus, Lexus refused what was submitted, Lexus throttled the account,
 * the Lexus service itself errored, the response was unintelligible, the saved
 * session was revoked, or something unrecognized.
 */
export type SignInFailureKind =
  | "network"
  | "rejected"
  | "rate-limited"
  | "server"
  | "protocol"
  | "session"
  | "unknown";

export function classifySignInFailure(error: unknown): SignInFailureKind {
  if (error instanceof SessionInvalidError) {
    return "session";
  }
  if (error instanceof LexusAuthError) {
    if (error.code === "invalid_step") {
      // Not a Lexus failure at all — the flow tried to answer a step that has
      // no answer slot. The error's own message is already user-ready.
      return "unknown";
    }
    if (typeof error.status === "number") {
      if (error.status === 401 || error.status === 403) {
        return "rejected";
      }
      if (error.status === 429) {
        return "rate-limited";
      }
      if (error.status >= 500) {
        return "server";
      }
    }
    return "protocol";
  }
  // Fetch reports network-level failures as a TypeError; React Native's wording
  // is "Network request failed".
  if (error instanceof TypeError || (error instanceof Error && /network/i.test(error.message))) {
    return "network";
  }
  return "unknown";
}

// What tapping "try again" is called on the screen where the failure happened.
function retryAction(stage: SignInStage): string {
  switch (stage) {
    case "credentials":
      return "tap Sign In again";
    case "choice":
      return "choose your verification method again";
    case "otp":
      return "tap Verify again";
    case "resend":
      return "request a code again";
    case "restore":
      return "sign in again";
  }
}

function rejectedMessage(stage: SignInStage): string {
  switch (stage) {
    case "credentials":
      return (
        "Lexus didn't accept that email and password. One of them is likely " +
        "mistyped (passwords are case-sensitive), or the account is locked " +
        "after too many attempts. Check both fields and try again, or reset " +
        "your password in the Lexus app."
      );
    case "otp":
      return (
        "Lexus didn't accept that verification code. It may be mistyped, " +
        "expired, or already used, since codes work once and only for a few " +
        "minutes. Tap Resend Code and enter the fresh code right away."
      );
    case "choice":
      return (
        "Lexus couldn't send a code by that method. The contact info on your " +
        "account may be out of date. Try another method, or update your " +
        "details in the Lexus app."
      );
    case "resend":
      return (
        "Lexus refused to send another code, usually because too many were " +
        "requested in a row. Wait a few minutes and request a code again."
      );
    case "restore":
      // A rejected restore is normally a SessionInvalidError (handled as
      // "session"); this is the fallback if a rejection arrives another way.
      return "Lexus no longer accepts the app's saved sign-in. Sign in again to reconnect your car.";
  }
}

/**
 * A user-facing message for a sign-in failure: what happened, why, and what to
 * do next. The stage names the action that failed so the advice matches the
 * screen the user is looking at.
 */
export function signInErrorMessage(error: unknown, stage: SignInStage): string {
  switch (classifySignInFailure(error)) {
    case "network":
      if (stage === "restore") {
        return (
          "Couldn't reach Lexus to reconnect your saved session. Your device " +
          "looks offline, or the connection dropped. Your sign-in is still " +
          "saved: get back online and reopen the app, or sign in again now."
        );
      }
      return (
        "Couldn't reach Lexus. Your device looks offline, or the connection " +
        `dropped mid-request. Check Wi-Fi or cellular, then ${retryAction(stage)}.`
      );
    case "rejected":
      return rejectedMessage(stage);
    case "rate-limited":
      return (
        "Lexus is limiting sign-in attempts after too many recent tries. " +
        `This clears on its own. Wait a few minutes, then ${retryAction(stage)}.`
      );
    case "server":
      return (
        "The Lexus sign-in service hit an error on its end, not something " +
        "you entered. It usually recovers quickly, so wait a moment, " +
        `then ${retryAction(stage)}.`
      );
    case "protocol":
      return (
        "Lexus sent a response the app couldn't understand, so sign-in " +
        "couldn't continue. Their service may be having a hiccup. Try again " +
        "in a moment, and update Lexy if it keeps happening."
      );
    case "session":
      return (
        "You've been signed out because Lexus no longer accepts the app's " +
        "saved session. This happens after a password change, or when Lexus " +
        "expires it on their end. Sign in again to reconnect your car."
      );
    case "unknown": {
      // invalid_step LexusAuthErrors already carry user-ready advice; other
      // errors get their message surfaced so the failure stays diagnosable.
      const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
      if (error instanceof LexusAuthError && error.code === "invalid_step") {
        return error.message;
      }
      return (
        `Something unexpected stopped sign-in${detail}. ` +
        "Try again, and restart Lexy if it keeps happening."
      );
    }
  }
}

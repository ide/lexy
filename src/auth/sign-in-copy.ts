import type { SFSymbol } from "sf-symbols-typescript";

import type { AuthenticationStep } from "@/auth/lexus-auth";

export type SignInScreenName = "credentials" | "choice" | "otp";

export function signInScreenFor(step: AuthenticationStep | null): SignInScreenName {
  return step === "choice" ? "choice" : step === "otp" ? "otp" : "credentials";
}

/**
 * Classify a verification-method label (server copy like "Text message to
 * ***-1234" or "Email to l***@example.com") into a delivery channel. Shared by
 * the OTP copy and the choice icons so a new channel is added in one place.
 */
export function classifyDeliveryMethod(
  value: string | null | undefined,
): "email" | "sms" | "unknown" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("email") || normalized.includes("e-mail")) {
    return "email";
  }
  if (
    normalized.includes("sms") ||
    normalized.includes("text") ||
    normalized.includes("phone") ||
    normalized.includes("mobile") ||
    normalized.includes("call")
  ) {
    return "sms";
  }
  return "unknown";
}

// The OTP node's server prompt is often generic, so the copy (and icon) are
// derived from the verification method the user actually chose. This is what
// keeps an email selection from mislabeling its screen as an SMS code.
export function otpCopy(method: string | null): {
  icon: SFSymbol;
  title: string;
  subtitle: string;
  placeholder: string;
} {
  switch (classifyDeliveryMethod(method)) {
    case "email":
      return {
        icon: "envelope.fill",
        title: "Enter your email code",
        subtitle: "We sent a verification code to your email.",
        placeholder: "Email code",
      };
    case "sms":
      return {
        icon: "message.fill",
        title: "Enter your SMS code",
        subtitle: "We texted a verification code to your phone.",
        placeholder: "SMS code",
      };
    default:
      return {
        icon: "number",
        title: "Enter your verification code",
        subtitle: "Enter the code from your chosen verification method.",
        placeholder: "Verification code",
      };
  }
}

export function choiceIcon(choice: string): SFSymbol {
  switch (classifyDeliveryMethod(choice)) {
    case "email":
      return "envelope";
    case "sms":
      return "message";
    default:
      return "shield.lefthalf.filled";
  }
}

/** The hero icon/title and subtitle for each step of the sign-in flow. */
export function signInHero(
  screen: SignInScreenName,
  method: string | null,
  prompt: string | null,
): { icon: SFSymbol; title: string; subtitle: string } {
  const otp = otpCopy(method);
  if (screen === "choice") {
    return {
      icon: "lock.shield.fill",
      title: "Verify it's you",
      subtitle: prompt ?? "Choose how you'd like to receive your verification code.",
    };
  }
  if (screen === "otp") {
    return { icon: otp.icon, title: otp.title, subtitle: prompt ?? otp.subtitle };
  }
  return {
    icon: "key.fill",
    title: "Sign in",
    subtitle: "Sign in with your Lexus account.",
  };
}

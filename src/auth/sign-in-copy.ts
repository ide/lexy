import type { AuthenticationStep } from "@/auth/lexus-auth";
import type { IconName } from "@/components/ui/icon-registry";

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
//
// Icons are named from the registry rather than as SF Symbols: this module is
// shared by both platform trees, so it says what an icon means and each `Icon`
// resolves that to its own glyph.
export function otpCopy(method: string | null): {
  icon: IconName;
  title: string;
  subtitle: string;
  placeholder: string;
} {
  switch (classifyDeliveryMethod(method)) {
    case "email":
      return {
        icon: "mail-filled",
        title: "Check Your Email",
        subtitle: "We sent a verification code to your email address.",
        placeholder: "Verification Code",
      };
    case "sms":
      return {
        icon: "message-filled",
        title: "Check Your Messages",
        subtitle: "We texted a verification code to your phone.",
        placeholder: "Verification Code",
      };
    default:
      return {
        icon: "one-time-code",
        title: "Enter Your Code",
        subtitle: "Enter the verification code you received.",
        placeholder: "Verification Code",
      };
  }
}

export function choiceIcon(choice: string): IconName {
  switch (classifyDeliveryMethod(choice)) {
    case "email":
      return "mail";
    case "sms":
      return "message";
    default:
      return "shield-half";
  }
}

/** The hero icon/title and subtitle for each step of the sign-in flow. */
export function signInHero(
  screen: SignInScreenName,
  method: string | null,
  prompt: string | null,
): { icon: IconName; title: string; subtitle: string } {
  const otp = otpCopy(method);
  if (screen === "choice") {
    return {
      icon: "shield-lock",
      title: "Verify It's You",
      subtitle: prompt ?? "Choose how you'd like to receive your verification code.",
    };
  }
  if (screen === "otp") {
    // The server's OTP prompt is boilerplate ("Enter the verification code…"),
    // so the friendlier copy derived from the chosen method wins here; the
    // choice step still surfaces the prompt since it can carry real context.
    return { icon: otp.icon, title: otp.title, subtitle: otp.subtitle };
  }
  return {
    icon: "key",
    title: "Welcome to Lexy",
    subtitle: "Sign in with your Lexus account to see and control your vehicle.",
  };
}

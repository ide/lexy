import { describe, expect, it } from "vitest";

import {
  choiceIcon,
  classifyDeliveryMethod,
  otpCopy,
  signInHero,
  signInScreenFor,
} from "./sign-in-copy";

describe("signInScreenFor", () => {
  it("maps auth steps to screens, defaulting to credentials", () => {
    expect(signInScreenFor("choice")).toBe("choice");
    expect(signInScreenFor("otp")).toBe("otp");
    expect(signInScreenFor("username")).toBe("credentials");
    expect(signInScreenFor("password")).toBe("credentials");
    expect(signInScreenFor(null)).toBe("credentials");
  });
});

describe("classifyDeliveryMethod", () => {
  it("recognizes email labels", () => {
    expect(classifyDeliveryMethod("Email to l***@example.com")).toBe("email");
    expect(classifyDeliveryMethod("E-mail")).toBe("email");
  });

  it("recognizes the SMS/phone family", () => {
    for (const label of [
      "SMS",
      "Text message to ***-1234",
      "Phone",
      "Mobile number",
      "Voice call",
    ]) {
      expect(classifyDeliveryMethod(label)).toBe("sms");
    }
  });

  it("falls back to unknown", () => {
    expect(classifyDeliveryMethod("Authenticator app")).toBe("unknown");
    expect(classifyDeliveryMethod(null)).toBe("unknown");
  });
});

describe("otpCopy", () => {
  it("labels an email selection as an email code, not SMS", () => {
    expect(otpCopy("Email to l***@example.com").title).toBe(
      "Enter your email code",
    );
    expect(otpCopy("Text to ***-1234").placeholder).toBe("SMS code");
    expect(otpCopy(null).icon).toBe("number");
  });
});

describe("choiceIcon", () => {
  it("matches the channel of each choice", () => {
    expect(choiceIcon("Email")).toBe("envelope");
    expect(choiceIcon("Text message")).toBe("message");
    expect(choiceIcon("Security questions")).toBe("shield.lefthalf.filled");
  });
});

describe("signInHero", () => {
  it("prefers the server prompt as the subtitle on choice and otp", () => {
    expect(signInHero("choice", null, "Pick one.").subtitle).toBe("Pick one.");
    expect(signInHero("otp", "Email", "Code sent.").subtitle).toBe("Code sent.");
  });

  it("derives the otp hero from the chosen method when the prompt is generic", () => {
    const hero = signInHero("otp", "Email to l***@example.com", null);
    expect(hero.icon).toBe("envelope.fill");
    expect(hero.subtitle).toBe("We sent a verification code to your email.");
  });

  it("uses the static credentials hero", () => {
    expect(signInHero("credentials", null, null)).toEqual({
      icon: "key.fill",
      title: "Sign in",
      subtitle: "Sign in with your Lexus account.",
    });
  });
});

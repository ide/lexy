import { describe, expect, it } from "vitest";

import {
  choiceIcon,
  classifyDeliveryMethod,
  otpCopy,
  signInHero,
  signInScreenFor,
} from "./sign-in-copy";
import { iconRegistry } from "@/components/ui/icon-registry";

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
  it("derives the copy from the chosen delivery channel", () => {
    expect(otpCopy("Email to l***@example.com").title).toBe("Check Your Email");
    expect(otpCopy("Text to ***-1234").title).toBe("Check Your Messages");
    expect(otpCopy(null).icon).toBe("one-time-code");
  });

  it("uses one placeholder across channels", () => {
    expect(otpCopy("Email").placeholder).toBe("Verification Code");
    expect(otpCopy("Text to ***-1234").placeholder).toBe("Verification Code");
    expect(otpCopy(null).placeholder).toBe("Verification Code");
  });
});

describe("choiceIcon", () => {
  it("matches the channel of each choice", () => {
    expect(choiceIcon("Email")).toBe("mail");
    expect(choiceIcon("Text message")).toBe("message");
    expect(choiceIcon("Security questions")).toBe("shield-half");
  });
});

describe("the icon names the copy hands out", () => {
  // The copy module speaks registry names so both platform trees can draw it;
  // a name it invents that the registry doesn't carry renders nothing at all.
  it("are all in the icon registry", () => {
    const names = [
      choiceIcon("Email"),
      choiceIcon("Text message"),
      choiceIcon("Security questions"),
      otpCopy("Email").icon,
      otpCopy("Text message").icon,
      otpCopy(null).icon,
      signInHero("credentials", null, null).icon,
      signInHero("choice", null, null).icon,
      signInHero("otp", "Email", null).icon,
    ];
    for (const name of names) {
      expect(iconRegistry).toHaveProperty(name);
    }
  });
});

describe("signInHero", () => {
  it("prefers the server prompt as the subtitle on choice only", () => {
    expect(signInHero("choice", null, "Pick one.").subtitle).toBe("Pick one.");
    // The OTP prompt is boilerplate; the channel-derived copy wins.
    expect(signInHero("otp", "Email", "Code sent.").subtitle).toBe(
      "We sent a verification code to your email address.",
    );
  });

  it("derives the otp hero from the chosen method", () => {
    const hero = signInHero("otp", "Email to l***@example.com", null);
    expect(hero.icon).toBe("mail-filled");
    expect(hero.title).toBe("Check Your Email");
  });

  it("uses the static credentials hero", () => {
    expect(signInHero("credentials", null, null)).toEqual({
      icon: "key",
      title: "Welcome to Lexy",
      subtitle: "Sign in with your Lexus account to see and control your vehicle.",
    });
  });
});

import {
  Button,
  Divider,
  HStack,
  Host,
  Image,
  ScrollView,
  SecureField,
  type SecureFieldRef,
  type TextFieldRef,
  Text,
  TextField,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  autocorrectionDisabled,
  background,
  bold,
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  multilineTextAlignment,
  onSubmit,
  padding,
  scrollDismissesKeyboard,
  shapes,
  submitLabel,
  textContentType,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useObserve } from "expo-observe";
import { useEffect, useRef, useState } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import type { AuthenticationStep } from "@/auth/lexus-auth";
import { Spacing, colors } from "@/constants/theme";

/**
 * The slice of auth state the sign-in UI renders. The real screen wires this to
 * `useAuth()`, but the Development tab's login preview supplies a mock so the
 * flow can be walked without any network calls or session changes.
 */
export type SignInController = {
  busy: boolean;
  canChangeMethod: boolean;
  changeMethod: () => void | Promise<void>;
  choices: string[];
  error: string | null;
  method: string | null;
  prompt: string | null;
  resendCode: () => void | Promise<void>;
  step: AuthenticationStep | null;
  submit: (value: string | number) => void | Promise<void>;
  submitCredentials: (username: string, password: string) => void | Promise<void>;
};

type Screen = "credentials" | "choice" | "otp";

// The official Lexus app (Toyota Motor Sales) — where drivers create their
// Lexus account and enroll a vehicle. Lexy signs in with those credentials.
const LEXUS_APP_URL = "https://apps.apple.com/us/app/lexus/id1468484450";

function tapImpact() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function openLexusApp() {
  tapImpact();
  Linking.openURL(LEXUS_APP_URL);
}

// The OTP node's server prompt is often generic, so the copy (and icon) are
// derived from the verification method the user actually chose. This is what
// keeps an email selection from mislabeling its screen as an SMS code.
function otpCopy(method: string | null): {
  icon: SFSymbol;
  title: string;
  subtitle: string;
  placeholder: string;
} {
  const normalized = (method ?? "").toLowerCase();
  if (normalized.includes("email") || normalized.includes("e-mail")) {
    return {
      icon: "envelope.fill",
      title: "Enter your email code",
      subtitle: "We sent a verification code to your email.",
      placeholder: "Email code",
    };
  }
  if (
    normalized.includes("sms") ||
    normalized.includes("text") ||
    normalized.includes("phone") ||
    normalized.includes("mobile") ||
    normalized.includes("call")
  ) {
    return {
      icon: "message.fill",
      title: "Enter your SMS code",
      subtitle: "We texted a verification code to your phone.",
      placeholder: "SMS code",
    };
  }
  return {
    icon: "number",
    title: "Enter your verification code",
    subtitle: "Enter the code from your chosen verification method.",
    placeholder: "Verification code",
  };
}

function choiceIcon(choice: string): SFSymbol {
  const normalized = choice.toLowerCase();
  if (normalized.includes("email") || normalized.includes("e-mail")) {
    return "envelope";
  }
  if (
    normalized.includes("sms") ||
    normalized.includes("text") ||
    normalized.includes("phone") ||
    normalized.includes("mobile") ||
    normalized.includes("call")
  ) {
    return "message";
  }
  return "shield.lefthalf.filled";
}

function Hero({
  icon,
  title,
  subtitle,
}: {
  icon: SFSymbol;
  title: string;
  subtitle: string;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={Spacing.three}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <HStack alignment="center" spacing={Spacing.three}>
        <ZStack
          modifiers={[
            frame({ width: 56, height: 56 }),
            background(
              colors.card,
              shapes.roundedRectangle({
                cornerRadius: 18,
                roundedCornerStyle: "continuous",
              }),
            ),
          ]}
        >
          <Image
            systemName={icon}
            size={26}
            color={colors.systemBlue as string}
          />
        </ZStack>
        <Text
          modifiers={[
            font({ textStyle: "title", weight: "bold" }),
            fixedSize({ horizontal: false, vertical: true }),
          ]}
        >
          {title}
        </Text>
      </HStack>
      <Text
        modifiers={[
          font({ textStyle: "subheadline", weight: "medium" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
          fixedSize({ horizontal: false, vertical: true }),
          frame({ maxWidth: Infinity, alignment: "leading" }),
        ]}
      >
        {subtitle}
      </Text>
    </VStack>
  );
}

function PrimaryButton({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("borderedProminent"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {/* A full-width *label* is what stretches a bordered button edge to edge;
          `frame(maxWidth: Infinity)` on the Button alone leaves it hugging its
          text and centered in the column. */}
      <Text
        modifiers={[
          font({ textStyle: "body", weight: "semibold" }),
          foregroundStyle("white"),
          frame({ maxWidth: Infinity }),
          padding({ vertical: Spacing.one }),
        ]}
      >
        {busy ? `${label}…` : label}
      </Text>
    </Button>
  );
}

function SecondaryAction({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      modifiers={[
        buttonStyle("plain"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    />
  );
}

function NewToLexusCallout() {
  return (
    <Button
      onPress={openLexusApp}
      modifiers={[buttonStyle("plain"), frame({ maxWidth: Infinity })]}
    >
      <VStack
        alignment="leading"
        spacing={Spacing.two}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          contentShape(shapes.rectangle()),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
          background(
            colors.card,
            shapes.roundedRectangle({
              cornerRadius: 14,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "bold" }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          Don't have a Lexus account yet?
        </Text>
        {/* One paragraph. "your" stays bold; the App Store line flows inline in
            blue (same weight as the sentence) via nested Text concatenation. */}
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "medium" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          Create <Text modifiers={[bold()]}>your</Text> account and add your car
          in the Lexus app, then come back here to sign in.{" "}
          <Text modifiers={[foregroundStyle(colors.systemBlue)]}>
            Get the Lexus app from the App Store.
          </Text>
        </Text>
      </VStack>
    </Button>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <HStack
      alignment="center"
      spacing={Spacing.two}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        background(
          colors.card,
          shapes.roundedRectangle({
            cornerRadius: 14,
            roundedCornerStyle: "continuous",
          }),
        ),
      ]}
    >
      <Image
        systemName="exclamationmark.triangle.fill"
        size={18}
        color={colors.systemOrange as string}
      />
      <Text
        modifiers={[
          font({ textStyle: "footnote", weight: "medium" }),
          fixedSize({ horizontal: false, vertical: true }),
          frame({ maxWidth: Infinity, alignment: "leading" }),
        ]}
      >
        {message}
      </Text>
    </HStack>
  );
}

export default function SignInScreen() {
  return <SignInView controller={useAuth()} />;
}

export function SignInView({ controller }: { controller: SignInController }) {
  const {
    busy,
    canChangeMethod,
    changeMethod,
    choices,
    error,
    method,
    prompt,
    resendCode,
    step,
    submit,
    submitCredentials,
  } = controller;
  const { markInteractive } = useObserve();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<SecureFieldRef>(null);
  const codeRef = useRef<TextFieldRef>(null);

  /**
   * Resign whichever field is focused before a submit that can end the flow.
   *
   * A successful sign-in flips the root navigator's auth guard, which unmounts
   * this screen — and its Host — while its field is still first responder. The
   * keyboard goes away with the view, but nothing ever resigns it, so the
   * scene's keyboard safe area is never walked back to zero and every host
   * created afterwards (each tab's scroll view) inherits the leftover inset.
   * Resigning first ends the keyboard the ordinary way.
   *
   * React Native's `Keyboard.dismiss()` cannot do this: it blurs the currently
   * focused *RN* TextInput, and these fields are SwiftUI.
   */
  const dismissKeyboard = () => {
    emailRef.current?.blur();
    passwordRef.current?.blur();
    codeRef.current?.blur();
  };

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  const screen: Screen =
    step === "choice" ? "choice" : step === "otp" ? "otp" : "credentials";
  // A numeric key for the `animation(...)` dependency so switching screens
  // animates the relayout rather than snapping.
  const screenIndex = screen === "credentials" ? 0 : screen === "choice" ? 1 : 2;

  const signIn = () => {
    if (busy || email.trim().length === 0 || password.length === 0) {
      return;
    }
    tapImpact();
    dismissKeyboard();
    submitCredentials(email.trim(), password);
  };

  const chooseMethod = (index: number) => {
    if (busy) {
      return;
    }
    tapImpact();
    submit(index);
  };

  const verify = () => {
    if (busy || code.trim().length === 0) {
      return;
    }
    tapImpact();
    dismissKeyboard();
    submit(code.trim());
  };

  // Resend a fresh code / switch delivery method by restarting verification. The
  // previously entered code is cleared since it's no longer the active one.
  const resend = () => {
    if (busy) {
      return;
    }
    tapImpact();
    setCode("");
    resendCode();
  };

  const switchMethod = () => {
    if (busy) {
      return;
    }
    tapImpact();
    setCode("");
    changeMethod();
  };

  const otp = otpCopy(method);
  const hero =
    screen === "choice"
      ? { icon: "lock.shield.fill" as SFSymbol, title: "Verify it's you" }
      : screen === "otp"
        ? { icon: otp.icon, title: otp.title }
        : { icon: "key.fill" as SFSymbol, title: "Sign in" };
  const subtitle =
    screen === "credentials"
      ? "Sign in with your Lexus account."
      : screen === "choice"
        ? (prompt ?? "Choose how you'd like to receive your verification code.")
        : (prompt ?? otp.subtitle);

  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      {/* A single native ScrollView is the state-of-the-art keyboard story on
          iOS: SwiftUI insets the content above the keyboard automatically (the
          Host keeps the keyboard safe area), so the focused field is always
          visible, and dragging the scroll view dismisses the keyboard. */}
      <ScrollView modifiers={[scrollDismissesKeyboard("interactively")]}>
        <VStack
          spacing={Spacing.four}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "center" }),
            padding({
              top: Spacing.six,
              horizontal: Spacing.three,
              bottom: Spacing.six,
            }),
            animation(Animation.spring({ duration: 0.35 }), screenIndex),
          ]}
        >
          <Hero icon={hero.icon} title={hero.title} subtitle={subtitle} />

          {screen === "credentials" ? (
            <VStack spacing={Spacing.three} modifiers={[frame({ maxWidth: Infinity })]}>
              <VStack
                spacing={0}
                modifiers={[
                  frame({ maxWidth: Infinity }),
                  background(
                    colors.card,
                    shapes.roundedRectangle({
                      cornerRadius: 16,
                      roundedCornerStyle: "continuous",
                    }),
                  ),
                ]}
              >
                <TextField
                  ref={emailRef}
                  placeholder="Email address"
                  autoFocus
                  onTextChange={setEmail}
                  modifiers={[
                    textFieldStyle("plain"),
                    keyboardType("email-address"),
                    textContentType("username"),
                    textInputAutocapitalization("never"),
                    autocorrectionDisabled(),
                    submitLabel("next"),
                    onSubmit(() => {
                      passwordRef.current?.focus();
                    }),
                    frame({ maxWidth: Infinity }),
                    padding({ horizontal: Spacing.three, vertical: Spacing.three }),
                  ]}
                />
                <Divider modifiers={[padding({ leading: Spacing.three })]} />
                <SecureField
                  ref={passwordRef}
                  placeholder="Password"
                  onTextChange={setPassword}
                  modifiers={[
                    textFieldStyle("plain"),
                    textContentType("password"),
                    submitLabel("go"),
                    onSubmit(signIn),
                    frame({ maxWidth: Infinity }),
                    padding({ horizontal: Spacing.three, vertical: Spacing.three }),
                  ]}
                />
              </VStack>
              {/* Only the empty-field state dims the button. While `busy` the
                  button stays prominent (the `signIn` handler already guards
                  against a double submit) so tapping it doesn't flicker the
                  fill from vibrant blue to disabled grey and back. */}
              <PrimaryButton
                busy={busy}
                disabled={email.trim().length === 0 || password.length === 0}
                label="Sign in to Lexus"
                onPress={signIn}
              />
            </VStack>
          ) : null}

          {screen === "choice" ? (
            <VStack spacing={Spacing.two} modifiers={[frame({ maxWidth: Infinity })]}>
              {choices.map((choice, index) => (
                <Button
                  key={choice}
                  label={choice}
                  systemImage={choiceIcon(choice)}
                  onPress={() => chooseMethod(index)}
                  modifiers={[
                    buttonStyle("bordered"),
                    controlSize("large"),
                    tint(colors.systemBlue),
                    disabledModifier(busy),
                    frame({ maxWidth: Infinity }),
                  ]}
                />
              ))}
            </VStack>
          ) : null}

          {screen === "otp" ? (
            <VStack spacing={Spacing.three} modifiers={[frame({ maxWidth: Infinity })]}>
              <TextField
                ref={codeRef}
                placeholder={otp.placeholder}
                autoFocus
                onTextChange={setCode}
                modifiers={[
                  textFieldStyle("plain"),
                  keyboardType("numeric"),
                  textContentType("oneTimeCode"),
                  submitLabel("done"),
                  onSubmit(verify),
                  frame({ maxWidth: Infinity }),
                  padding({ horizontal: Spacing.three, vertical: Spacing.three }),
                  background(
                    colors.card,
                    shapes.roundedRectangle({
                      cornerRadius: 16,
                      roundedCornerStyle: "continuous",
                    }),
                  ),
                ]}
              />
              <PrimaryButton
                busy={busy}
                disabled={busy || code.trim().length === 0}
                label="Verify"
                onPress={verify}
              />
              <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
                <SecondaryAction
                  disabled={busy}
                  label="Resend code"
                  onPress={resend}
                />
                {canChangeMethod ? (
                  <SecondaryAction
                    disabled={busy}
                    label="Use a different method"
                    onPress={switchMethod}
                  />
                ) : null}
              </VStack>
            </VStack>
          ) : null}

          {error ? <ErrorNotice message={error} /> : null}

          {screen === "credentials" ? <NewToLexusCallout /> : null}

          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              multilineTextAlignment("center"),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity }),
              padding({ top: Spacing.two, horizontal: Spacing.two }),
            ]}
          >
            Your password and verification code are sent directly to Lexus. Lexy
            never stores them nor collects your information.
          </Text>
        </VStack>
      </ScrollView>
    </Host>
  );
}

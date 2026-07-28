import {
  Button,
  Divider,
  HStack,
  Host,
  Image,
  ScrollView,
  SecureField,
  type SecureFieldRef,
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
  buttonStyle,
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
  choices: string[];
  error: string | null;
  method: string | null;
  prompt: string | null;
  step: AuthenticationStep | null;
  submit: (value: string | number) => void | Promise<void>;
  submitCredentials: (username: string, password: string) => void | Promise<void>;
};

type Screen = "credentials" | "choice" | "otp";

function tapImpact() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
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
      spacing={Spacing.two}
      modifiers={[frame({ maxWidth: Infinity, alignment: "center" })]}
    >
      <ZStack
        modifiers={[
          frame({ width: 72, height: 72 }),
          background(
            colors.card,
            shapes.roundedRectangle({
              cornerRadius: 22,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
      >
        <Image systemName={icon} size={30} color={colors.systemBlue as string} />
      </ZStack>
      <Text
        modifiers={[
          font({ textStyle: "title2", weight: "bold" }),
          multilineTextAlignment("center"),
          padding({ top: Spacing.two }),
        ]}
      >
        {title}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: "subheadline", weight: "medium" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
          multilineTextAlignment("center"),
          fixedSize({ horizontal: false, vertical: true }),
          frame({ maxWidth: Infinity }),
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
      label={busy ? `${label}…` : label}
      onPress={onPress}
      modifiers={[
        buttonStyle("borderedProminent"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    />
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
  const { busy, choices, error, method, prompt, step, submit, submitCredentials } = controller;
  const { markInteractive } = useObserve();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const passwordRef = useRef<SecureFieldRef>(null);

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
    submit(code.trim());
  };

  const otp = otpCopy(method);
  const hero =
    screen === "choice"
      ? { icon: "lock.shield.fill" as SFSymbol, title: "Verify it's you" }
      : screen === "otp"
        ? { icon: otp.icon, title: otp.title }
        : { icon: "key.fill" as SFSymbol, title: "Sign in to Lexus" };
  const subtitle =
    screen === "credentials"
      ? "Connect Lexy directly to your Lexus account."
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
              <PrimaryButton
                busy={busy}
                disabled={busy || email.trim().length === 0 || password.length === 0}
                label="Sign in"
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
            </VStack>
          ) : null}

          {error ? <ErrorNotice message={error} /> : null}

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
            Your password and verification code are sent directly to Lexus. Lexy never stores
            them, and the app does not collect any information about you.
          </Text>
        </VStack>
      </ScrollView>
    </Host>
  );
}

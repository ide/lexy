import {
  Divider,
  Host,
  ScrollView,
  SecureField,
  type SecureFieldRef,
  type TextFieldRef,
  Text,
  TextField,
  VStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  autocorrectionDisabled,
  background,
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
} from "@expo/ui/swift-ui/modifiers";
import { useObserve } from "expo-observe";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/auth/auth-context";
import { choiceIcon, otpCopy, signInHero, signInScreenFor } from "@/auth/sign-in-copy";
import {
  ChoiceButton,
  ErrorNotice,
  Hero,
  NewToLexusCallout,
  PrimaryButton,
  SecondaryAction,
} from "@/components/sign-in/sign-in-elements";
import { Spacing, colors } from "@/constants/theme";
import { haptic } from "@/utils/haptics";

const SCREEN_ORDER = ["credentials", "choice", "otp"] as const;

export default function SignInScreen() {
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
  } = useAuth();
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

  const screen = signInScreenFor(step);
  // A numeric key for the `animation(...)` dependency so switching screens
  // animates the relayout rather than snapping.
  const screenIndex = SCREEN_ORDER.indexOf(screen);

  // Every action ignores taps while busy and gives light impact feedback;
  // callers add their own field-emptiness guards before this one.
  const guarded = (run: () => void) => {
    if (busy) {
      return;
    }
    haptic("impact-light");
    run();
  };

  const signIn = () => {
    if (email.trim().length === 0 || password.length === 0) {
      return;
    }
    guarded(() => {
      dismissKeyboard();
      submitCredentials(email.trim(), password);
    });
  };

  const chooseMethod = (index: number) => guarded(() => submit(index));

  const verify = () => {
    if (code.trim().length === 0) {
      return;
    }
    guarded(() => {
      dismissKeyboard();
      submit(code.trim());
    });
  };

  // Resend a fresh code / switch delivery method by restarting verification. The
  // previously entered code is cleared since it's no longer the active one.
  const resend = () =>
    guarded(() => {
      setCode("");
      resendCode();
    });

  const switchMethod = () =>
    guarded(() => {
      setCode("");
      changeMethod();
    });

  const otp = otpCopy(method);
  const hero = signInHero(screen, method, prompt);

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
          <Hero icon={hero.icon} title={hero.title} subtitle={hero.subtitle} />

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
                  placeholder="Email"
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
                busyLabel="Signing In…"
                disabled={email.trim().length === 0 || password.length === 0}
                label="Sign In"
                onPress={signIn}
              />
            </VStack>
          ) : null}

          {screen === "choice" ? (
            <VStack spacing={Spacing.two} modifiers={[frame({ maxWidth: Infinity })]}>
              {choices.map((choice, index) => (
                <ChoiceButton
                  key={choice}
                  disabled={busy}
                  icon={choiceIcon(choice)}
                  label={choice}
                  onPress={() => chooseMethod(index)}
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
              {/* Like the sign-in button: only the empty-field state dims the
                  button — while busy it stays prominent (verify() guards the
                  double submit) instead of flickering to disabled grey. */}
              <PrimaryButton
                busy={busy}
                busyLabel="Verifying…"
                disabled={code.trim().length === 0}
                label="Verify"
                onPress={verify}
              />
              <VStack spacing={Spacing.one} modifiers={[frame({ maxWidth: Infinity })]}>
                <SecondaryAction disabled={busy} label="Resend Code" onPress={resend} />
                {canChangeMethod ? (
                  <SecondaryAction
                    disabled={busy}
                    label="Use a Different Method"
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
            Your password and verification code go directly to Lexus. Lexy never stores them or
            collects your information.
          </Text>
        </VStack>
      </ScrollView>
    </Host>
  );
}

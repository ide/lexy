import {
  Button,
  Column,
  Host,
  RNHostView,
  Row,
  Text,
  TextInput,
  type TextInputRef,
  useNativeState,
} from "@expo/ui";
import { HorizontalDivider } from "@expo/ui/jetpack-compose";
import {
  animateContentSize,
  background,
  clip,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import * as Linking from "expo-linking";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { otpCopy, signInHero, signInScreenFor } from "@/auth/sign-in-copy";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon-registry";
import { Spacing, colors } from "@/constants/theme";
import { LEXUS_APP_STORE_URL } from "@/data/lexus-app";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

/** The corner radius of the screen's cards, in dp. */
const CARD_RADIUS = 16;
/** Material's medium button height — the size a screen's primary call to action takes. */
const BUTTON_HEIGHT = 56;

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // The code field is the one field the screen writes back into — resending and
  // switching method both clear it — so it hands its text to Compose as native
  // state. React state mirrors all three because the buttons' enabled state is
  // a React render, which a native state change does not trigger.
  const codeText = useNativeState("");
  const emailRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const codeRef = useRef<TextInputRef>(null);

  /**
   * Drop focus before a submit that can end the flow.
   *
   * Android does not have iOS's stuck-keyboard-inset bug — the IME is a window
   * state here, and it comes down on its own when the focused field leaves the
   * composition — so this is not load-bearing the way the SwiftUI version is.
   * It stays for a plainer reason: `imePadding` below is animating the whole
   * column up by the keyboard's height, and clearing focus first lets that
   * settle before the auth guard swaps the screen out from under it.
   */
  const dismissKeyboard = () => {
    emailRef.current?.blur();
    passwordRef.current?.blur();
    codeRef.current?.blur();
  };

  useMarkInteractive();

  const screen = signInScreenFor(step);

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

  const clearCode = () => {
    codeText.value = "";
    setCode("");
  };

  // Resend a fresh code / switch delivery method by restarting verification. The
  // previously entered code is cleared since it's no longer the active one.
  const resend = () =>
    guarded(() => {
      clearCode();
      resendCode();
    });

  const switchMethod = () =>
    guarded(() => {
      clearCode();
      changeMethod();
    });

  const otp = otpCopy(method);
  const hero = signInHero(screen, method, prompt);

  return (
    // No `seedColor`: left alone, the host themes its Compose children from the
    // device's own Material 3 palette, which is where `@/constants/theme` reads
    // its Android colours from too. Seeding it here would theme the controls
    // from one fixed hue and drift from everything drawn beside them.
    <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      {/* The keyboard story, in one modifier chain: `imePadding` shrinks the
          scrolling viewport by the IME's height, and Compose's own text fields
          ask that scroll container to bring them into view when they take
          focus. Nothing here measures or pads by hand. The window is already
          `adjustResize` (Expo's manifest default), which is what lets the IME
          inset reach Compose at all. */}
      <Column modifiers={[fillMaxSize(), imePadding(), verticalScroll()]}>
        <Column
          alignment="center"
          spacing={Spacing.four}
          modifiers={[
            // The screen changes shape under a fixed hero, so the column
            // animates its own height rather than snapping to the new one.
            animateContentSize(),
            fillMaxWidth(),
            padding(Spacing.three, Spacing.six, Spacing.three, Spacing.six),
          ]}
        >
          <Hero icon={hero.icon} title={hero.title} subtitle={hero.subtitle} />

          {screen === "credentials" ? (
            <Column spacing={Spacing.three} modifiers={[fillMaxWidth()]}>
              <Column
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(CARD_RADIUS)),
                  background(colors.card),
                ]}
              >
                <TextInput
                  ref={emailRef}
                  placeholder="Email"
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  // Maps to Compose's `ContentType.Username`, so the platform
                  // password manager fills this field and the next one.
                  autoComplete="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onChangeText={setEmail}
                  modifiers={[fillMaxWidth(), fieldPadding()]}
                  textStyle={fieldTextStyle}
                  placeholderTextColor={colors.tertiaryLabel}
                  cursorColor={colors.systemBlue}
                />
                <HorizontalDivider
                  color={colors.separator}
                  modifiers={[padding(Spacing.three, 0, 0, 0)]}
                />
                <TextInput
                  ref={passwordRef}
                  placeholder="Password"
                  secureTextEntry
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={signIn}
                  onChangeText={setPassword}
                  modifiers={[fillMaxWidth(), fieldPadding()]}
                  textStyle={fieldTextStyle}
                  placeholderTextColor={colors.tertiaryLabel}
                  cursorColor={colors.systemBlue}
                />
              </Column>
              {/* Only the empty-field state dims the button. While `busy` it
                  keeps its fill (the `signIn` handler already guards against a
                  double submit) and says what it is doing instead. */}
              <PrimaryButton
                busy={busy}
                busyLabel="Signing In…"
                disabled={email.trim().length === 0 || password.length === 0}
                label="Sign In"
                onPress={signIn}
              />
            </Column>
          ) : null}

          {screen === "choice" ? (
            // `weight(1)` on each button is what splits the row evenly: the
            // buttons divide the width between them rather than each hugging
            // its own label, however long the server's wording runs.
            <Row spacing={Spacing.two} modifiers={[fillMaxWidth()]}>
              {choices.map((choice, index) => (
                <Button
                  key={choice}
                  variant="outlined"
                  label={choice}
                  disabled={busy}
                  onPress={() => chooseMethod(index)}
                  modifiers={[weight(1), defaultMinSize({ minHeight: BUTTON_HEIGHT })]}
                />
              ))}
            </Row>
          ) : null}

          {screen === "otp" ? (
            <Column spacing={Spacing.three} modifiers={[fillMaxWidth()]}>
              <TextInput
                ref={codeRef}
                value={codeText}
                placeholder={otp.placeholder}
                autoFocus
                keyboardType="number-pad"
                // `ContentType.SmsOtpCode`: the code Android reads out of the
                // incoming message is offered straight to this field.
                autoComplete="sms-otp"
                returnKeyType="done"
                onSubmitEditing={verify}
                onChangeText={setCode}
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(CARD_RADIUS)),
                  background(colors.card),
                  fieldPadding(),
                ]}
                textStyle={fieldTextStyle}
                placeholderTextColor={colors.tertiaryLabel}
                cursorColor={colors.systemBlue}
              />
              {/* Like Sign In: dimmed only by an empty field, never by busy. */}
              <PrimaryButton
                busy={busy}
                busyLabel="Verifying…"
                disabled={code.trim().length === 0}
                label="Verify"
                onPress={verify}
              />
              <Column spacing={Spacing.one} modifiers={[fillMaxWidth()]}>
                <Button
                  variant="text"
                  label="Resend Code"
                  disabled={busy}
                  onPress={resend}
                  modifiers={[fillMaxWidth()]}
                />
                {canChangeMethod ? (
                  <Button
                    variant="text"
                    label="Use a Different Method"
                    disabled={busy}
                    onPress={switchMethod}
                    modifiers={[fillMaxWidth()]}
                  />
                ) : null}
              </Column>
            </Column>
          ) : null}

          {error ? <ErrorNotice message={error} /> : null}

          {screen === "credentials" ? <NewToLexusCallout /> : null}

          <Text
            textStyle={{
              fontSize: 12,
              fontWeight: "500",
              color: colors.secondaryLabel,
              textAlign: "center",
            }}
            modifiers={[fillMaxWidth(), padding(Spacing.two, Spacing.two, Spacing.two, 0)]}
          >
            Your password and verification code go directly to Lexus. Lexy never stores them or
            collects your information.
          </Text>
        </Column>
      </Column>
    </Host>
  );
}

// The three fields are one control repeated, so their insets and type live here
// rather than three times inline. Compose modifiers apply outside in, so this
// one comes last in a field's chain: inside the card's fill, not around it.
const fieldPadding = () => padding(Spacing.three, Spacing.three, Spacing.three, Spacing.three);
const fieldTextStyle = { fontSize: 16, color: colors.label } as const;

/**
 * The centered icon → title → description column that opens each step.
 *
 * The glyph is the one piece of this tree React Native still draws: the app
 * names its icons semantically and resolves them to a Material *font* on
 * Android, which a Compose `Icon` — it wants an XML vector drawable — cannot
 * take. `RNHostView` hosts the real icon inside the Compose column, sized by
 * its own layout, which is the same bridge the iOS scroll view uses in reverse.
 */
function Hero({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <Column alignment="center" spacing={Spacing.two} modifiers={[fillMaxWidth()]}>
      {/* Centered inside its host rather than sized to it: the hosted view is
          measured by React Native, and whether that measurement hugs the glyph
          or stretches to the column, the glyph itself lands in the middle. */}
      <RNHostView matchContents>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={44} tint={colors.systemBlue} />
        </View>
      </RNHostView>
      <Text
        textStyle={{ fontSize: 26, fontWeight: "700", color: colors.label, textAlign: "center" }}
        modifiers={[fillMaxWidth()]}
      >
        {title}
      </Text>
      <Text
        textStyle={{ fontSize: 15, color: colors.secondaryLabel, textAlign: "center" }}
        modifiers={[fillMaxWidth(), padding(Spacing.two, 0, Spacing.two, 0)]}
      >
        {subtitle}
      </Text>
    </Column>
  );
}

function PrimaryButton({
  busy,
  busyLabel,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  /** Progressive label shown while busy, e.g. "Signing In…" for "Sign In". */
  busyLabel: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant="filled"
      label={busy ? busyLabel : label}
      disabled={disabled}
      onPress={onPress}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: BUTTON_HEIGHT })]}
    />
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <Row
      alignment="center"
      spacing={Spacing.two}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(14)),
        background(colors.card),
        padding(Spacing.three, Spacing.three, Spacing.three, Spacing.three),
      ]}
    >
      {/* Width fixed so the glyph can't stretch and push the message out of
          the card; height is left to the icon's own line box. */}
      <RNHostView matchContents>
        <View style={{ width: 20, alignItems: "center" }}>
          <Icon name="warning" size={18} tint={colors.systemOrange} />
        </View>
      </RNHostView>
      {/* The weight is what makes the message wrap inside the card instead of
          pushing its own width past it. */}
      <Text textStyle={{ fontSize: 13, color: colors.label }} modifiers={[weight(1)]}>
        {message}
      </Text>
    </Row>
  );
}

function NewToLexusCallout() {
  return (
    <Column
      spacing={Spacing.two}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(14)),
        background(colors.card),
        padding(Spacing.three, Spacing.three, Spacing.three, Spacing.two),
      ]}
    >
      <Text textStyle={{ fontSize: 13, fontWeight: "600", color: colors.label }}>
        New to Lexus?
      </Text>
      <Text textStyle={{ fontSize: 13, color: colors.secondaryLabel }}>
        Create an account and add your vehicle in the Lexus app, then come back here to sign in.
      </Text>
      <Button
        variant="text"
        label="Get the Lexus App"
        onPress={() => {
          haptic("impact-light");
          // The Play listing, not the app's link: this callout is for someone
          // with no Lexus account yet, so the store page — where they install
          // the app to create one — is the right destination.
          Linking.openURL(LEXUS_APP_STORE_URL);
        }}
      />
    </Column>
  );
}

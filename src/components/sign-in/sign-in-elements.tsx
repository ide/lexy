import { Button, HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Linking from "expo-linking";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";
import { LEXUS_APP_STORE_URL } from "@/data/lexus-app";
import { haptic } from "@/utils/haptics";

// The stateless SwiftUI pieces of the sign-in flow; the screen owns all state.

export function Hero({
  icon,
  title,
  subtitle,
}: {
  icon: SFSymbol;
  title: string;
  subtitle: string;
}) {
  // The centered icon → title → description column Apple uses for sign-in and
  // feature-introduction screens.
  return (
    <VStack spacing={Spacing.two} modifiers={[frame({ maxWidth: Infinity })]}>
      <Image
        systemName={icon}
        size={44}
        color={colors.systemBlue}
        modifiers={[padding({ bottom: Spacing.one })]}
      />
      <Text
        modifiers={[
          font({ textStyle: "title", weight: "bold" }),
          multilineTextAlignment("center"),
          fixedSize({ horizontal: false, vertical: true }),
        ]}
      >
        {title}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: "subheadline" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
          multilineTextAlignment("center"),
          fixedSize({ horizontal: false, vertical: true }),
          frame({ maxWidth: Infinity }),
          padding({ horizontal: Spacing.two }),
        ]}
      >
        {subtitle}
      </Text>
    </VStack>
  );
}

export function PrimaryButton({
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
        {busy ? busyLabel : label}
      </Text>
    </Button>
  );
}

/**
 * A verification-method choice: a full-width bordered button whose label —
 * icon and text — is what stretches edge to edge (see PrimaryButton), so every
 * choice renders at the same size instead of hugging its own text.
 */
export function ChoiceButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled: boolean;
  icon: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("bordered"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <HStack
        alignment="center"
        spacing={Spacing.two}
        modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: Spacing.one })]}
      >
        <Image systemName={icon} size={17} color={colors.systemBlue} />
        <Text
          modifiers={[
            font({ textStyle: "body", weight: "semibold" }),
            foregroundStyle(colors.systemBlue),
          ]}
        >
          {label}
        </Text>
      </HStack>
    </Button>
  );
}

export function SecondaryAction({
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
        // Borderless (not plain) so the label picks up the blue tint and reads
        // as tappable rather than as static text.
        buttonStyle("borderless"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    />
  );
}

export function NewToLexusCallout() {
  return (
    <Button
      onPress={() => {
        haptic("impact-light");
        // The App Store page, not the app's universal link: this callout is
        // for someone with no Lexus account yet, so the store listing (where
        // they install the app to create one) is the right destination.
        Linking.openURL(LEXUS_APP_STORE_URL);
      }}
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
            font({ textStyle: "footnote", weight: "semibold" }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          New to Lexus?
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "footnote" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          Create an account and add your car in the Lexus app, then come back here to sign in.
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundStyle(colors.systemBlue),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          Get the Lexus App
        </Text>
      </VStack>
    </Button>
  );
}

export function ErrorNotice({ message }: { message: string }) {
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
      <Image systemName="exclamationmark.triangle.fill" size={18} color={colors.systemOrange} />
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

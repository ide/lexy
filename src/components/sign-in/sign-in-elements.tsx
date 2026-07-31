import {
  Button,
  HStack,
  Image,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
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
            color={colors.systemBlue}
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

export function PrimaryButton({
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
        buttonStyle("plain"),
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
      <Image
        systemName="exclamationmark.triangle.fill"
        size={18}
        color={colors.systemOrange}
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

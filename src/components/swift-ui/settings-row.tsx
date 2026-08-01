import { Button, Divider, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  opacity,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";

/** The trailing chevron of a row that pushes another screen. */
export function RowChevron() {
  return <Image systemName="chevron.right" size={14} color={colors.secondaryLabel} />;
}

/**
 * The trailing glyph of a row that leaves the app — a website in Safari rather
 * than another screen in the stack, so it is not the pushing chevron.
 */
export function RowExternalLink() {
  return <Image systemName="arrow.up.forward" size={14} color={colors.secondaryLabel} />;
}

/**
 * The trailing checkmark of a selectable row. Always in the layout (hidden via
 * opacity when unselected) so choosing an option doesn't reflow the row text.
 */
export function RowCheckmark({ selected }: { selected: boolean }) {
  return (
    <Image
      systemName="checkmark"
      size={16}
      color={colors.systemBlue}
      modifiers={[opacity(selected ? 1 : 0)]}
    />
  );
}

/**
 * A grouped-list row that reads rather than acts: a label and its value, with
 * no icon and nothing to tap. The value is selectable, so a long press offers
 * Copy — the whole point of showing a version string to someone writing a bug
 * report.
 */
export function InfoRow({
  label,
  value,
  last = true,
}: {
  label: string;
  value: string;
  /** When false, a divider (full width — there is no icon to inset past) follows. */
  last?: boolean;
}) {
  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        ]}
      >
        <Text modifiers={[font({ textStyle: "body", weight: "regular" })]}>{label}</Text>
        <Spacer />
        <Text
          modifiers={[
            font({ textStyle: "body", weight: "regular" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            textSelection(true),
            multilineTextAlignment("trailing"),
          ]}
        >
          {value}
        </Text>
      </HStack>
      {last ? null : <Divider modifiers={[padding({ leading: Spacing.three })]} />}
    </VStack>
  );
}

/**
 * A grouped-list row inside a `GroupCard`: leading icon, title over subtitle,
 * and an optional trailing accessory. Renders its own divider unless `last`.
 */
export function SettingsRow({
  icon,
  tint,
  title,
  titleColor,
  subtitle,
  accessory,
  disabled = false,
  last = true,
  onPress,
}: {
  icon: SFSymbol;
  tint: string;
  title: string;
  /** Overrides the default label color (e.g. destructive red). */
  titleColor?: string;
  subtitle: string;
  accessory?: React.ReactNode;
  disabled?: boolean;
  /** When false, a divider (inset past the icon) follows the row. */
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle("plain"),
          ...(disabled ? [disabledModifier(true)] : []),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <HStack
          alignment="center"
          spacing={Spacing.three}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            contentShape(shapes.rectangle()),
            padding({ horizontal: Spacing.three, vertical: Spacing.three }),
          ]}
        >
          <Image systemName={icon} size={22} color={tint} />
          <VStack
            alignment="leading"
            spacing={Spacing.half}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <Text
              modifiers={[
                font({ textStyle: "body", weight: "semibold" }),
                ...(titleColor ? [foregroundStyle(titleColor)] : []),
              ]}
            >
              {title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {subtitle}
            </Text>
          </VStack>
          {accessory ? (
            <>
              <Spacer />
              {accessory}
            </>
          ) : null}
        </HStack>
      </Button>
      {last ? null : <Divider modifiers={[padding({ leading: Spacing.six })]} />}
    </VStack>
  );
}

import { Host } from "@expo/ui";
import { Column, HorizontalDivider, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  clickable,
  clip,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { iconDrawables, type DrawableIconName } from "@/components/jetpack-compose/icon-drawables";
import { Spacing, colors } from "@/constants/theme";
import { haptic } from "@/utils/haptics";

/** The corner radius of the grouped cards, matching the RN Card's 18pt. */
const CARD_RADIUS = 18;
/** A row's leading glyph size; the divider inset is derived from it. */
const ROW_ICON_SIZE = 22;
/** Row padding: three horizontal, three-minus-one vertical, like the RN rows had. */
const rowPadding = () =>
  padding(Spacing.three, Spacing.three - Spacing.one, Spacing.three, Spacing.three - Spacing.one);

/**
 * The Android frame for settings-style screens — the Material counterpart of
 * `src/components/swift-ui/settings-screen-scaffold.tsx`, and like it, one
 * native tree: a single `Host` whose whole content is Jetpack Compose, so the
 * grouped background, the scroll, and every row live in Compose's own layout
 * with no RN views to bridge per row.
 */
export function SettingsScreenScaffold({ children }: { children: ReactNode }) {
  return (
    <Host style={styles.host}>
      <Column
        verticalArrangement={{ spacedBy: Spacing.four }}
        modifiers={[
          fillMaxSize(),
          background(colors.groupedBackground),
          verticalScroll(),
          padding(Spacing.three, Spacing.three, Spacing.three, Spacing.six),
        ]}
      >
        {children}
      </Column>
    </Host>
  );
}

/**
 * One labelled section: header, card, optional footnote, spaced as a unit.
 *
 * `Spacing.two` between the header and what it labels is the app's own
 * convention — the same gap the React Native `SectionTitle` carries — so a
 * grouped screen reads the same whichever toolkit drew it.
 */
export function Section({ children }: { children: ReactNode }) {
  return (
    <Column verticalArrangement={{ spacedBy: Spacing.two }} modifiers={[fillMaxWidth()]}>
      {children}
    </Column>
  );
}

export function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      style={{ fontSize: 14, fontWeight: "500", letterSpacing: 0.5 }}
      color={colors.secondaryLabel}
      modifiers={[padding(Spacing.two, 0, 0, 0)]}
    >
      {children}
    </Text>
  );
}

export function SectionFooter({ children }: { children: string }) {
  return (
    <Text
      style={{ fontSize: 14 }}
      color={colors.secondaryLabel}
      modifiers={[padding(Spacing.two, 0, Spacing.three, 0)]}
    >
      {children}
    </Text>
  );
}

/**
 * A content card: the elevated surface with its own inset, for panels and runs
 * of data rows rather than the self-padding rows `GroupCard` holds.
 */
export function Card({ children, spacing = 0 }: { children: ReactNode; spacing?: number }) {
  return (
    <Column
      verticalArrangement={{ spacedBy: spacing }}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(CARD_RADIUS)),
        background(colors.card),
        padding(Spacing.three, Spacing.three, Spacing.three, Spacing.three),
      ]}
    >
      {children}
    </Column>
  );
}

/**
 * A label/value line inside a `Card`. Denser than `InfoRow`, and the emphasis
 * is the other way round: the value is the reading someone came to look up, so
 * the label is the muted half and keeps its one line while the value takes the
 * slack.
 */
export function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: Spacing.three }}
        modifiers={[fillMaxWidth(), padding(0, Spacing.two, 0, Spacing.two)]}
      >
        <Text style={{ fontSize: 14 }} color={colors.secondaryLabel} maxLines={1} softWrap={false}>
          {label}
        </Text>
        <Text
          style={{ fontSize: 14, textAlign: "end" }}
          color={colors.label}
          modifiers={[weight(1)]}
        >
          {value}
        </Text>
      </Row>
      {last ? null : <HorizontalDivider color={colors.separator} />}
    </Column>
  );
}

/** Rows on the elevated card surface; rows draw their own separators. */
export function GroupCard({ children }: { children: ReactNode }) {
  return (
    <Column
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(CARD_RADIUS)), background(colors.card)]}
    >
      {children}
    </Column>
  );
}

/**
 * A settings row: tinted glyph, title over an optional subtitle, optional
 * trailing chevron. `clickable`'s default indication is the Material ripple —
 * the platform's own pressed state, per AGENTS.md.
 */
export function SettingsRow({
  icon,
  tint,
  title,
  subtitle,
  chevron = false,
  trailingIcon,
  selected,
  destructive = false,
  disabled = false,
  last = false,
  onPress,
}: {
  icon: DrawableIconName;
  tint: string;
  title: string;
  subtitle?: string;
  chevron?: boolean;
  /** A trailing glyph in the chevron's slot — e.g. external-link for rows that leave the app. */
  trailingIcon?: DrawableIconName;
  /** Radio-style rows: `true` draws the accent check, `false` reserves its slot. */
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** Suppresses the hairline under the row, for the card's final row. */
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        ...(disabled
          ? [alpha(0.4)]
          : [
              clickable(() => {
                haptic("selection");
                onPress();
              }),
            ]),
      ]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: Spacing.three }}
        modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 52 }), rowPadding()]}
      >
        <Icon source={iconDrawables[icon]} size={ROW_ICON_SIZE} tint={tint} />
        <Column verticalArrangement={{ spacedBy: Spacing.half }} modifiers={[weight(1)]}>
          <Text style={{ fontSize: 16 }} color={destructive ? colors.systemRed : colors.label}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 14 }} color={colors.secondaryLabel}>{subtitle}</Text>
          ) : null}
        </Column>
        {chevron ? (
          <Icon source={iconDrawables["chevron-right"]} size={18} tint={colors.tertiaryLabel} />
        ) : null}
        {trailingIcon ? (
          <Icon source={iconDrawables[trailingIcon]} size={16} tint={colors.tertiaryLabel} />
        ) : null}
        {selected !== undefined ? (
          <Icon
            source={iconDrawables.check}
            size={18}
            tint={selected ? colors.systemBlue : "transparent"}
          />
        ) : null}
      </Row>
      {last ? null : (
        <HorizontalDivider
          color={colors.separator}
          // Inset past the glyph column so the hairline underlines the text
          // block, matching the grouped-list convention on both platforms.
          modifiers={[padding(Spacing.three + ROW_ICON_SIZE + Spacing.three, 0, 0, 0)]}
        />
      )}
    </Column>
  );
}

/** A read-only row. See the settings spec's Platform notes on the copy affordance. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Row
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 52 }), rowPadding()]}
    >
      <Text style={{ fontSize: 16 }} color={colors.label} modifiers={[weight(1)]}>
        {label}
      </Text>
      <Text style={{ fontSize: 14 }} color={colors.secondaryLabel}>{value}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});

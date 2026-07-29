import {
  Divider,
  Host,
  HStack,
  RNHostView,
  ScrollView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  font,
  foregroundStyle,
  frame,
  padding,
  redacted,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { OfflineBanner } from "@/components/offline-banner";
import { Spacing, colors } from "@/constants/theme";

/**
 * Loading placeholder for the Details screen. The real screen is a stack of
 * grouped cards (vehicle spec, capabilities, trips, services), so this mirrors
 * that shape with representative rows and leans on SwiftUI's native
 * `redacted(.placeholder)` to gray them out — no hand-drawn fill blocks or
 * pulse animation. The section labels and card chrome stay real; only the row
 * content inside the redacted subtree is masked.
 *
 * Unlike the Status skeleton, everything here is native @expo/ui rather than RN
 * views, so `redacted` reaches the whole tree. When `offline`, a banner sits
 * above the redacted content (and is itself unredacted so it stays legible).
 */

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });

// Row label/value text is arbitrary — it never renders (the subtree is
// redacted), it only sizes the placeholder bars. Varied widths read as a real
// list rather than a column of identical stripes.
const VEHICLE_ROWS = [
  ["VIN", "JTHBW1GG0A2123456"],
  ["Model code", "GSE30L"],
  ["Exterior", "Ultra White"],
  ["Trim", "F Sport"],
  ["Region", "North America"],
  ["Telematics", "Gen 4"],
  ["Head unit", "Premium Audio"],
  ["Fuel type", "Gasoline"],
];
const TRIP_ROWS = [
  ["Trip A", "123 mi"],
  ["Trip B", "456 mi"],
];
const SERVICE_ROWS = [
  ["Safety Connect", "Active"],
  ["Remote Connect", "Active"],
];

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <HStack
        alignment="center"
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        ]}
      >
        <Text modifiers={[font({ size: 14 }), secondary]}>{label}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14 })]}>{value}</Text>
      </HStack>
      {last ? null : <Divider modifiers={[padding({ leading: Spacing.three })]} />}
    </VStack>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={Spacing.two}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text
        modifiers={[
          font({ size: 13, weight: "semibold" }),
          secondary,
          padding({ horizontal: Spacing.two }),
        ]}
      >
        {title}
      </Text>
      <VStack
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity }),
          background(
            colors.card,
            shapes.roundedRectangle({
              cornerRadius: 18,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
      >
        {children}
      </VStack>
    </VStack>
  );
}

function rows(items: string[][]) {
  return items.map(([label, value], i) => (
    <Row
      key={label}
      label={label}
      value={value}
      last={i === items.length - 1}
    />
  ));
}

export function DetailsSkeleton({ offline = false }: { offline?: boolean }) {
  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView>
        <VStack
          alignment="leading"
          spacing={Spacing.three}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({
              top: Spacing.three,
              horizontal: Spacing.three,
              bottom: Spacing.six,
            }),
          ]}
        >
          {offline ? (
            <RNHostView matchContents>
              <OfflineBanner message="No internet connection — connect to load your vehicle" />
            </RNHostView>
          ) : null}
          <VStack
            alignment="leading"
            spacing={Spacing.three}
            modifiers={[
              frame({ maxWidth: Infinity, alignment: "leading" }),
              redacted("placeholder"),
            ]}
          >
            <Section title="VEHICLE">{rows(VEHICLE_ROWS)}</Section>
            <Section title="TRIPS">{rows(TRIP_ROWS)}</Section>
            <Section title="CONNECTED SERVICES">{rows(SERVICE_ROWS)}</Section>
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}

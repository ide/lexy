import { Button, Host, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";

// Universal link that opens the installed Lexus app; the Branch-hosted domain
// redirects to the App Store when it isn't installed. The inline markdown link
// below opens it through SwiftUI's default openURL action.
const LEXUS_APP_URL = "https://ctlexusapp.com";

// Secondary, center-aligned body copy shared by both states.
const messageModifiers = [
  font({ textStyle: "body" }),
  foregroundStyle({ type: "hierarchical", style: "secondary" }),
  multilineTextAlignment("center"),
];

/**
 * The primary recovery action: a native SwiftUI `borderedProminent` button at
 * the large control size, so it gets the system's tap target, tint, and
 * pressed/haptic behavior. The label is regular weight — these are recovery
 * actions, not shouted calls to action.
 */
function RetryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      onPress={onPress}
      modifiers={[buttonStyle("borderedProminent"), controlSize("large"), tint(colors.systemBlue)]}
    >
      <Text
        modifiers={[
          font({ textStyle: "body" }),
          foregroundStyle("white"),
          padding({ horizontal: Spacing.three }),
        ]}
      >
        {label}
      </Text>
    </Button>
  );
}

/**
 * The shared centered empty/error layout. The entire screen is a single SwiftUI
 * `Host` with no React Native views nested inside — icon, title, message, and
 * action are all SwiftUI. The title is center-aligned so it stays balanced when
 * it wraps on narrow screens.
 */
function StateScreen({
  symbol,
  title,
  children,
}: {
  symbol: SFSymbol;
  title: string;
  children: ReactNode;
}) {
  return (
    <Host style={{ flex: 1 }} seedColor={colors.systemBlue}>
      <VStack
        spacing={Spacing.three}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ horizontal: Spacing.four }),
        ]}
      >
        <Image systemName={symbol} size={44} color={colors.secondaryLabel} />
        <Text
          modifiers={[
            font({ textStyle: "largeTitle", weight: "bold" }),
            multilineTextAlignment("center"),
          ]}
        >
          {title}
        </Text>
        {children}
      </VStack>
    </Host>
  );
}

export function VehicleError({ retry, detail }: { retry: () => void; detail?: string }) {
  return (
    <StateScreen symbol="exclamationmark.triangle" title="Vehicle data unavailable">
      <Text modifiers={messageModifiers}>
        {detail ??
          "We couldn't reach the Lexus vehicle service. Check your connection and try again."}
      </Text>
      <RetryButton label="Try again" onPress={retry} />
    </StateScreen>
  );
}

/**
 * Shown when the account authenticates but has no vehicle enrolled — a distinct
 * empty state from a load failure. Guides the user to add a car in the Lexus
 * app, then retry (discovery re-runs on tap / pull-to-refresh).
 */
export function NoVehicleState({ retry }: { retry: () => void }) {
  return (
    <StateScreen symbol="car.2" title="No vehicle found">
      <Text markdownEnabled modifiers={messageModifiers}>
        {`There's no vehicle associated with this Lexus account. Add your car in the [Lexus app](${LEXUS_APP_URL}), then check again here.`}
      </Text>
      <RetryButton label="Check again" onPress={retry} />
    </StateScreen>
  );
}

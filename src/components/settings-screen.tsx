import { Button, Host, HStack, Image, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter, type Href } from "expo-router";
import { useObserve } from "expo-observe";
import { useEffect } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import { GroupCard, SectionHeader } from "@/components/swift-ui/section";
import { RowChevron, SettingsRow } from "@/components/swift-ui/settings-row";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { describeMapsProviderChoice } from "@/data/maps-providers";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { haptic } from "@/utils/haptics";

type DevItem = {
  icon: SFSymbol;
  tint: string;
  title: string;
  subtitle: string;
  href: Href;
};

// The Development tab folded into Settings: these rows are only rendered when
// SHOW_DEV_TOOLS is true (local dev + internal preview builds), never in
// production.
const DEV_ITEMS: DevItem[] = [
  {
    icon: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    tint: colors.systemBlue,
    title: "Updates",
    subtitle: "expo-updates status, controls, and activity log.",
    href: "/settings/updates",
  },
  {
    icon: "person.badge.key.fill",
    tint: colors.systemGreen,
    title: "Login Flow",
    subtitle: "Walk the sign-in screens without signing out.",
    href: "/settings/login",
  },
  {
    icon: "square.stack.3d.up.fill",
    tint: colors.systemOrange,
    title: "Data State",
    subtitle: "Force loading, offline, error, and empty states.",
    href: "/settings/data-state",
  },
];

// Choose which navigation app the car-location map hands off to. The resolved
// provider sits below the row title instead of in a trailing column, preserving
// the full width for long app names and Dynamic Type. When no maps app is
// installed the row reads "Unavailable" and taps explain how to fix it.
function MapsProviderRow() {
  const { resolved, saved, promptChoice } = useMapsProvider();

  return (
    <SettingsRow
      icon="map.fill"
      tint={colors.systemBlue}
      title="Maps app"
      subtitle={describeMapsProviderChoice(resolved, saved)}
      accessory=<RowChevron />
      onPress={() => {
        haptic("selection");
        // promptChoice presents the chooser, or explains when nothing is
        // installed.
        promptChoice();
      }}
    />
  );
}

function SignOutRow() {
  const { signOut } = useAuth();
  const red = colors.systemRed;

  const onPress = () => {
    haptic("impact-medium");
    // signOut clears the stored session + query cache; the Stack.Protected
    // guard in the root layout then swaps back to the sign-in screen.
    signOut().catch(() => {
      // Clearing the Keychain is best-effort; on failure the user stays signed
      // in and can retry.
    });
  };

  return (
    <Button onPress={onPress} modifiers={[buttonStyle("plain"), frame({ maxWidth: Infinity })]}>
      <HStack
        alignment="center"
        spacing={Spacing.two}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "center" }),
          contentShape(shapes.rectangle()),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        ]}
      >
        <Image systemName="rectangle.portrait.and.arrow.right" size={20} color={red} />
        <Text modifiers={[font({ textStyle: "body", weight: "semibold" }), foregroundStyle(red)]}>
          Sign Out
        </Text>
      </HStack>
    </Button>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { markInteractive } = useObserve();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  const open = (href: Href) => {
    haptic("selection");
    router.push(href);
  };

  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView>
        <VStack
          alignment="leading"
          spacing={Spacing.four}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({
              top: Spacing.three,
              horizontal: Spacing.three,
              bottom: Spacing.six,
            }),
          ]}
        >
          {SHOW_DEV_TOOLS ? (
            <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <SectionHeader>DEVELOPER TOOLS</SectionHeader>
              <GroupCard>
                {DEV_ITEMS.map((item, index) => (
                  <SettingsRow
                    key={item.title}
                    icon={item.icon}
                    tint={item.tint}
                    title={item.title}
                    subtitle={item.subtitle}
                    accessory=<RowChevron />
                    last={index === DEV_ITEMS.length - 1}
                    onPress={() => open(item.href)}
                  />
                ))}
              </GroupCard>
            </VStack>
          ) : null}

          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <SectionHeader>MAPS</SectionHeader>
            <GroupCard>
              <MapsProviderRow />
            </GroupCard>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "regular" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                padding({
                  top: Spacing.two,
                  horizontal: Spacing.three,
                }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              The app used to open your car&apos;s location for directions.
            </Text>
          </VStack>

          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <SectionHeader>LEXUS ACCOUNT</SectionHeader>
            <GroupCard>
              <SignOutRow />
            </GroupCard>
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}

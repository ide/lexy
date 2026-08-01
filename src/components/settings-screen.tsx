import { Button, Host, HStack, Image, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import { useObserve } from "expo-observe";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import { GroupCard, SectionHeader } from "@/components/swift-ui/section";
import { InfoRow, RowChevron, SettingsRow } from "@/components/swift-ui/settings-row";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { describeMapsProviderChoice } from "@/data/maps-providers";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { describeAppVersion } from "@/updates/app-version";
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
    icon: "square.stack.3d.up.fill",
    tint: colors.systemBlue,
    title: "Updates",
    subtitle: "Expo Updates status, controls, and activity log.",
    href: "/settings/updates",
  },
  {
    icon: "cylinder.split.1x2.fill",
    tint: colors.systemOrange,
    title: "Data State",
    subtitle: "Force loading, offline, error, and empty states.",
    href: "/settings/data-state",
  },
  {
    icon: "person.badge.key.fill",
    tint: colors.systemGreen,
    title: "Login Flow",
    subtitle: "Walk the sign-in screens without signing out.",
    href: "/settings/login",
  },
  {
    icon: "cloud.fill",
    tint: colors.systemCyan,
    title: "Expo Application Services",
    subtitle: "Open this project's EAS dashboard.",
    href: "/settings/eas",
  },
];

// Choose which navigation app the vehicle-location map hands off to. The resolved
// provider sits below the row title instead of in a trailing column, preserving
// the full width for long app names and Dynamic Type. When no maps app is
// installed the row reads "Unavailable" and taps explain how to fix it.
function MapsProviderRow() {
  const { resolved, saved, promptChoice } = useMapsProvider();

  return (
    <SettingsRow
      icon="map.fill"
      tint={colors.systemBlue}
      title="Maps App"
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

// The vehicle's name on the Lexus account — shown here rather than on the
// details screen because it is the one identity field that is *editable*, and
// changing it writes to the account, not the car.
function VehicleNameRow() {
  const router = useRouter();
  const profile = useVehicleProfile();
  const nickname = profile.data?.profile.nickname;

  return (
    <SettingsRow
      icon="car.fill"
      tint={colors.systemBlue}
      title="Name"
      subtitle={nickname ?? "…"}
      accessory=<RowChevron />
      // Nothing to edit until the current name is known; the rename screen
      // needs it as the field's starting value.
      disabled={nickname === undefined}
      onPress={() => {
        haptic("selection");
        router.push("/settings/vehicle-name");
      }}
    />
  );
}

/**
 * What to quote when something goes wrong: the binary that is installed, and
 * the JavaScript it is running. `Constants.platform.ios.buildNumber` reads the
 * binary's own Info.plist rather than the manifest, so an update cannot make
 * this row describe a build the phone doesn't have.
 */
function AboutSection() {
  const shown = describeAppVersion({
    version: Constants.expoConfig?.version,
    buildNumber: Constants.platform?.ios?.buildNumber,
    updatesEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    updateCreatedAt: Updates.createdAt,
    channel: Updates.channel,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    emergencyLaunchReason: Updates.emergencyLaunchReason,
  });

  return (
    <VStack
      alignment="leading"
      spacing={Spacing.two}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        <SectionHeader>ABOUT</SectionHeader>
        <GroupCard>
          <InfoRow label="Version" value={shown.version} last={false} />
          <InfoRow label="Update" value={shown.update} last={shown.published === null} />
          {shown.published ? <InfoRow label="Published" value={shown.published} /> : null}
        </GroupCard>
      </VStack>
      {/* Nothing else on screen would say this: the app is running older code
          than it downloaded, and it looks entirely normal doing it. */}
      {shown.emergency ? (
        <HStack
          alignment="firstTextBaseline"
          spacing={Spacing.two}
          modifiers={[
            padding({ horizontal: Spacing.three }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          <Image systemName="exclamationmark.triangle.fill" size={13} color={colors.systemOrange} />
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "regular" }),
              foregroundStyle(colors.systemOrange),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {shown.emergency}
          </Text>
        </HStack>
      ) : null}
      <VStack
        alignment="leading"
        spacing={Spacing.one}
        modifiers={[
          padding({ horizontal: Spacing.three }),
          frame({ maxWidth: Infinity, alignment: "leading" }),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "regular" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          Include this when reporting a problem — press and hold to copy it.
        </Text>
        {/* The same facts as the rows above, on one line, because a report is
            pasted rather than transcribed. */}
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "regular" }),
            textSelection(true),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          {shown.report}
        </Text>
      </VStack>
    </VStack>
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
              The app used to open your vehicle&apos;s location for directions.
            </Text>
          </VStack>

          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <SectionHeader>VEHICLE</SectionHeader>
            <GroupCard>
              <VehicleNameRow />
            </GroupCard>
          </VStack>

          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <SectionHeader>LEXUS ACCOUNT</SectionHeader>
            <GroupCard>
              <SignOutRow />
            </GroupCard>
          </VStack>

          <AboutSection />
        </VStack>
      </ScrollView>
    </Host>
  );
}

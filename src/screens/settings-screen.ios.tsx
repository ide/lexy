import { Button, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import * as Updates from "expo-updates";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import { MapsProviderPrompt } from "@/features/maps/maps-provider-prompt";
import { GroupCard, SectionFooter, SectionHeader } from "@/components/swift-ui/section";
import { Section, SettingsScreenScaffold } from "@/components/swift-ui/settings-screen-scaffold";
import { fillWidthLeading } from "@/components/swift-ui/modifier-presets";
import { InfoRow, RowChevron, SettingsRow } from "@/components/swift-ui/settings-row";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { describeMapsProviderChoice } from "@/data/maps-providers";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { describeAppVersion } from "@/updates/app-version";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

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
  const { resolved, saved, promptChoice, prompt, dismissPrompt } = useMapsProvider();

  return (
    // The row is the dialog's trigger — SwiftUI presents from the view that
    // was tapped rather than from a call, so the chooser is attached here
    // instead of fired inside `promptChoice`.
    <MapsProviderPrompt prompt={prompt} onDismiss={dismissPrompt}>
      <SettingsRow
        icon="map.fill"
        tint={colors.systemBlue}
        title="Maps App"
        subtitle={describeMapsProviderChoice(resolved, saved)}
        accessory=<RowChevron />
        // promptChoice offers the chooser, or explains when nothing is
        // installed.
        onPress={promptChoice}
      />
    </MapsProviderPrompt>
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
      onPress={() => router.push("/settings/vehicle-name")}
    />
  );
}

/**
 * What to quote when something goes wrong: the binary that is installed, and
 * the JavaScript it is running, on one line. `Constants.platform.ios.buildNumber`
 * reads the binary's own Info.plist rather than the manifest, so an update
 * cannot make this row describe a build the phone doesn't have. The value is
 * selectable, so a long press offers Copy without a line of text saying so.
 */
function AboutSection() {
  const shown = describeAppVersion({
    version: Constants.expoConfig?.version,
    buildNumber: Constants.platform?.ios?.buildNumber,
    updatesEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
  });

  return (
    <Section>
      <SectionHeader>ABOUT</SectionHeader>
      <GroupCard>
        <InfoRow label="Version" value={shown.version} />
      </GroupCard>
      {/* Nothing else on screen would say this: the app is running older code
          than it downloaded, and it looks entirely normal doing it. */}
      {shown.emergency ? (
        <HStack
          alignment="firstTextBaseline"
          spacing={Spacing.two}
          modifiers={[padding({ top: Spacing.two, horizontal: Spacing.three }), fillWidthLeading]}
        >
          <Image systemName="exclamationmark.triangle.fill" size={13} color={colors.systemOrange} />
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "regular" }),
              foregroundStyle(colors.systemOrange),
              fixedSize({ horizontal: false, vertical: true }),
              fillWidthLeading,
            ]}
          >
            {shown.emergency}
          </Text>
        </HStack>
      ) : null}
    </Section>
  );
}

function SignOutRow() {
  const { signOut } = useAuth();
  const red = colors.systemRed;

  const onPress = () => {
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

  useMarkInteractive();

  return (
    <SettingsScreenScaffold>
      {SHOW_DEV_TOOLS ? (
        <Section>
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
                onPress={() => router.push(item.href)}
              />
            ))}
          </GroupCard>
        </Section>
      ) : null}

      <Section>
        <SectionHeader>MAPS</SectionHeader>
        <GroupCard>
          <MapsProviderRow />
        </GroupCard>
        <SectionFooter>
          The app used to open your vehicle&apos;s location for directions.
        </SectionFooter>
      </Section>

      <Section>
        <SectionHeader>VEHICLE</SectionHeader>
        <GroupCard>
          <VehicleNameRow />
        </GroupCard>
      </Section>

      <Section>
        <SectionHeader>LEXUS ACCOUNT</SectionHeader>
        <GroupCard>
          <SignOutRow />
        </GroupCard>
      </Section>

      <AboutSection />
    </SettingsScreenScaffold>
  );
}

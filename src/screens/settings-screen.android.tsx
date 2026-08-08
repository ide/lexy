import { Icon, Row, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import * as Updates from "expo-updates";

import { useAuth } from "@/auth/auth-context";
import {
  iconDrawables,
  type DrawableIconName,
} from "@/components/jetpack-compose/icon-drawables";
import {
  GroupCard,
  InfoRow,
  Section,
  SectionHeader,
  SettingsRow,
  SettingsScreenScaffold,
} from "@/components/jetpack-compose/settings";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { describeAppVersion } from "@/updates/app-version";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

type DevItem = {
  icon: DrawableIconName;
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
    icon: "updates",
    tint: colors.systemBlue,
    title: "Updates",
    subtitle: "Expo Updates status, controls, and activity log.",
    href: "/settings/updates",
  },
  {
    icon: "database",
    tint: colors.systemOrange,
    title: "Data State",
    subtitle: "Force loading, offline, error, and empty states.",
    href: "/settings/data-state",
  },
  {
    icon: "person-key",
    tint: colors.systemGreen,
    title: "Login Flow",
    subtitle: "Walk the sign-in screens without signing out.",
    href: "/settings/login",
  },
  {
    icon: "cloud",
    tint: colors.systemCyan,
    title: "Expo Application Services",
    subtitle: "Open this project's EAS dashboard.",
    href: "/settings/eas",
  },
];

// The vehicle's name on the Lexus account — shown here rather than on the
// details screen because it is the one identity field that is *editable*, and
// changing it writes to the account, not the car.
function VehicleNameRow() {
  const router = useRouter();
  const profile = useVehicleProfile();
  const nickname = profile.data?.profile.nickname;

  return (
    <SettingsRow
      icon="car"
      tint={colors.systemBlue}
      title="Name"
      subtitle={nickname ?? "…"}
      chevron
      last
      // Nothing to edit until the current name is known; the rename screen
      // needs it as the field's starting value.
      disabled={nickname === undefined}
      onPress={() => router.push("/settings/vehicle-name")}
    />
  );
}

/**
 * What to quote when something goes wrong: the binary that is installed, and
 * the JavaScript it is running, on one line. `Constants.platform.android.versionCode`
 * comes from the installed package's own build config rather than the update
 * manifest — the same guarantee the iOS row gets from Info.plist — so an
 * update cannot make this row describe a build the phone doesn't have.
 */
function AboutSection() {
  const versionCode = Constants.platform?.android?.versionCode;
  const shown = describeAppVersion({
    version: Constants.expoConfig?.version,
    buildNumber: versionCode === undefined ? undefined : String(versionCode),
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
        <Row
          horizontalArrangement={{ spacedBy: Spacing.two }}
          modifiers={[fillMaxWidth(), padding(Spacing.three, Spacing.two, Spacing.three, 0)]}
        >
          <Icon source={iconDrawables.warning} size={13} tint={colors.systemOrange} />
          <Text
            style={{ fontSize: 14 }} color={colors.systemOrange}
            modifiers={[weight(1)]}
          >
            {shown.emergency}
          </Text>
        </Row>
      ) : null}
    </Section>
  );
}

function SignOutRow() {
  const { signOut } = useAuth();

  const onPress = () => {
    // signOut clears the stored session + query cache; the Stack.Protected
    // guard in the root layout then swaps back to the sign-in screen.
    signOut().catch(() => {
      // Clearing the store is best-effort; on failure the user stays signed
      // in and can retry.
    });
  };

  return (
    <SettingsRow
      icon="sign-out"
      tint={colors.systemRed}
      title="Sign Out"
      destructive
      last
      onPress={onPress}
    />
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
                chevron
                last={index === DEV_ITEMS.length - 1}
                onPress={() => router.push(item.href)}
              />
            ))}
          </GroupCard>
        </Section>
      ) : null}

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

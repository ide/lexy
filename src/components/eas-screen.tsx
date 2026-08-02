import { Host, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { SFSymbol } from "sf-symbols-typescript";

import { GroupCard, SectionHeader } from "@/components/swift-ui/section";
import { RowExternalLink, SettingsRow } from "@/components/swift-ui/settings-row";
import { Spacing, colors } from "@/constants/theme";
import { easProjectUrl, type EasProjectIdentity } from "@/data/eas-dashboard";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

type Destination = {
  icon: SFSymbol;
  tint: string;
  title: string;
  subtitle: string;
  /** The dashboard path segment, or undefined for the project home. */
  page?: string;
};

const DESTINATIONS: Destination[] = [
  {
    icon: "house.fill",
    tint: colors.systemBlue,
    title: "Project Home",
    subtitle: "The project overview and its recent activity.",
  },
  {
    icon: "waveform.path.ecg",
    tint: colors.systemGreen,
    title: "Observe",
    subtitle: "Launch, render, and navigation metrics from real devices.",
    page: "observe",
  },
  {
    icon: "hammer.fill",
    tint: colors.systemOrange,
    title: "Builds",
    subtitle: "Native builds, their logs, and install links.",
    page: "builds",
  },
  {
    icon: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    tint: colors.systemCyan,
    title: "Updates",
    subtitle: "Published update groups per channel and branch.",
    page: "updates",
  },
];

// Who this build belongs to on EAS, read from the app config the bundle was
// built with. `easConfig` is the linked project (present in EAS builds); the
// `extra.eas` copy is what `app.json` carries locally.
function projectIdentity(): EasProjectIdentity {
  const config = Constants.expoConfig;
  return {
    owner: config?.owner,
    slug: config?.slug,
    projectId:
      Constants.easConfig?.projectId ??
      (config?.extra?.eas as { projectId?: string } | undefined)?.projectId,
  };
}

export default function EasScreen() {
  useMarkInteractive();

  const identity = projectIdentity();

  // The dashboard is a website, not an app, so these leave Lexy. Safari is the
  // deliberate target rather than an in-app browser: the session that makes
  // these pages worth opening lives in the user's browser cookies.
  const open = (page?: string) => {
    const url = easProjectUrl(identity, page);
    if (!url) {
      return;
    }
    haptic("selection");
    Linking.openURL(url).catch(() => {
      // Nothing to recover: the row stays put and can be tapped again.
    });
  };

  const linked = easProjectUrl(identity) !== null;

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
          <VStack
            alignment="leading"
            spacing={Spacing.two}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <SectionHeader>DASHBOARD</SectionHeader>
              <GroupCard>
                {DESTINATIONS.map((destination, index) => (
                  <SettingsRow
                    key={destination.title}
                    icon={destination.icon}
                    tint={destination.tint}
                    title={destination.title}
                    subtitle={destination.subtitle}
                    accessory=<RowExternalLink />
                    disabled={!linked}
                    last={index === DESTINATIONS.length - 1}
                    onPress={() => open(destination.page)}
                  />
                ))}
              </GroupCard>
            </VStack>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "regular" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                padding({ horizontal: Spacing.three }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {linked
                ? `Opens expo.dev in Safari for ${identity.owner ?? "this account"}/${
                    identity.slug ?? "this project"
                  }. Sign in there to see anything.`
                : "This build isn't linked to an EAS project, so there is no dashboard to open."}
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}

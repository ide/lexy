import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { SFSymbol } from "sf-symbols-typescript";

import { GroupCard, SectionFooter, SectionHeader } from "@/components/swift-ui/section";
import { Section, SettingsScreenScaffold } from "@/components/swift-ui/settings-screen-scaffold";
import { RowExternalLink, SettingsRow } from "@/components/swift-ui/settings-row";
import { colors } from "@/constants/theme";
import { easProjectUrl, type EasProjectIdentity } from "@/data/eas-dashboard";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import { haptic } from "@/utils/haptics";

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
    <SettingsScreenScaffold>
      <Section>
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
        <SectionFooter>
          {linked
            ? `Opens expo.dev in Safari for ${identity.owner ?? "this account"}/${
                identity.slug ?? "this project"
              }. Sign in there to see anything.`
            : "This build isn't linked to an EAS project, so there is no dashboard to open."}
        </SectionFooter>
      </Section>
    </SettingsScreenScaffold>
  );
}

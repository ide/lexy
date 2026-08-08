import Constants from "expo-constants";
import * as Linking from "expo-linking";

import type { DrawableIconName } from "@/components/jetpack-compose/icon-drawables";
import {
  GroupCard,
  Section,
  SectionFooter,
  SectionHeader,
  SettingsRow,
  SettingsScreenScaffold,
} from "@/components/jetpack-compose/settings";
import { colors } from "@/constants/theme";
import { easProjectUrl, type EasProjectIdentity } from "@/data/eas-dashboard";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import { haptic } from "@/utils/haptics";

type Destination = {
  icon: DrawableIconName;
  tint: string;
  title: string;
  subtitle: string;
  /** The dashboard path segment, or undefined for the project home. */
  page?: string;
};

const DESTINATIONS: Destination[] = [
  {
    icon: "home",
    tint: colors.systemBlue,
    title: "Project Home",
    subtitle: "The project overview and its recent activity.",
  },
  {
    icon: "observe",
    tint: colors.systemGreen,
    title: "Observe",
    subtitle: "Launch, render, and navigation metrics from real devices.",
    page: "observe",
  },
  {
    icon: "builds",
    tint: colors.systemOrange,
    title: "Builds",
    subtitle: "Native builds, their logs, and install links.",
    page: "builds",
  },
  {
    icon: "updates-sync",
    tint: colors.systemCyan,
    title: "Updates",
    subtitle: "Published update groups per channel and branch.",
    page: "updates",
  },
];

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

  // The dashboard is a website, not an app, so these leave Lexy. The system
  // browser is the deliberate target rather than an in-app one: the session
  // that makes these pages worth opening lives in the user's browser cookies.
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
              trailingIcon="external-link"
              disabled={!linked}
              last={index === DESTINATIONS.length - 1}
              onPress={() => open(destination.page)}
            />
          ))}
        </GroupCard>
        <SectionFooter>
          {linked
            ? `Opens expo.dev in your browser for ${identity.owner ?? "this account"}/${
                identity.slug ?? identity.projectId ?? "this project"
              }. You must be signed in on the dashboard to see anything.`
            : "This build isn't linked to an EAS project, so there is no dashboard to open."}
        </SectionFooter>
      </Section>
    </SettingsScreenScaffold>
  );
}

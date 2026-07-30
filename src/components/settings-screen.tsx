import {
  Button,
  Divider,
  Host,
  HStack,
  Image,
  ScrollView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useObserve } from "expo-observe";
import { useEffect } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { useMapsProvider } from "@/hooks/use-maps-provider";

type DevItem = {
  icon: SFSymbol;
  tint: string;
  title: string;
  subtitle: string;
  href: string;
};

// The Development tab folded into Settings: these rows are only rendered when
// SHOW_DEV_TOOLS is true (local dev + internal preview builds), never in
// production.
const DEV_ITEMS: DevItem[] = [
  {
    icon: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    tint: colors.systemBlue as string,
    title: "Updates",
    subtitle: "expo-updates status, controls, and activity log.",
    href: "/settings/updates",
  },
  {
    icon: "person.badge.key.fill",
    tint: colors.systemGreen as string,
    title: "Login Flow",
    subtitle: "Walk the sign-in screens without signing out.",
    href: "/settings/login",
  },
  {
    icon: "square.stack.3d.up.fill",
    tint: colors.systemOrange as string,
    title: "Data State",
    subtitle: "Force loading, offline, error, and empty states.",
    href: "/settings/data-state",
  },
];

function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "semibold" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        padding({ leading: Spacing.three, bottom: Spacing.one }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
      ]}
    >
      {children}
    </Text>
  );
}

function GroupCard({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

function DevRow({
  item,
  last,
  onPress,
}: {
  item: DevItem;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Button
        onPress={onPress}
        modifiers={[buttonStyle("plain"), frame({ maxWidth: Infinity })]}
      >
        <HStack
          alignment="center"
          spacing={Spacing.three}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            contentShape(shapes.rectangle()),
            padding({ horizontal: Spacing.three, vertical: Spacing.three }),
          ]}
        >
          <Image systemName={item.icon} size={22} color={item.tint} />
          <VStack
            alignment="leading"
            spacing={Spacing.half}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>
              {item.title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {item.subtitle}
            </Text>
          </VStack>
          <Spacer />
          <Image
            systemName="chevron.right"
            size={14}
            color={colors.secondaryLabel as string}
          />
        </HStack>
      </Button>
      {last ? null : <Divider modifiers={[padding({ leading: Spacing.six })]} />}
    </VStack>
  );
}

// Choose which navigation app the car-location map hands off to. The trailing
// value tracks the resolved provider; tapping opens the chooser (installed apps
// only). When no maps app is installed the row reads "Unavailable" and taps
// explain how to fix it.
function MapsProviderRow() {
  const { resolved, saved, promptChoice } = useMapsProvider();

  const none = resolved?.kind === "none";
  // What to show on the right: the deliberate saved choice, else the
  // auto-resolved single app, else "Not set" (multiple installed, none chosen).
  const value = none
    ? "Unavailable"
    : saved
      ? saved.name
      : resolved?.kind === "ready"
        ? resolved.provider.name
        : "Not set";
  const subtitle = none
    ? "Install Apple Maps, Google Maps, or Waze to open your car's location."
    : "The app used to open your car's location for directions.";

  const onPress = () => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.selectionAsync();
    }
    // promptChoice presents the chooser, or explains when nothing is installed.
    promptChoice();
  };

  return (
    <Button
      onPress={onPress}
      modifiers={[buttonStyle("plain"), frame({ maxWidth: Infinity })]}
    >
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          contentShape(shapes.rectangle()),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        ]}
      >
        <Image
          systemName="map.fill"
          size={22}
          color={colors.systemBlue as string}
        />
        <VStack
          alignment="leading"
          spacing={Spacing.half}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>
            Maps app
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {subtitle}
          </Text>
        </VStack>
        <Spacer />
        <Text
          modifiers={[
            font({ textStyle: "body", weight: "regular" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          {value}
        </Text>
        <Image
          systemName="chevron.right"
          size={14}
          color={colors.secondaryLabel as string}
        />
      </HStack>
    </Button>
  );
}

function SignOutRow() {
  const { signOut } = useAuth();
  const red = colors.systemRed as string;

  const onPress = () => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // signOut clears the stored session + query cache; the Stack.Protected
    // guard in the root layout then swaps back to the sign-in screen.
    signOut().catch(() => {
      // Clearing the Keychain is best-effort; on failure the user stays signed
      // in and can retry.
    });
  };

  return (
    <Button
      onPress={onPress}
      modifiers={[buttonStyle("plain"), frame({ maxWidth: Infinity })]}
    >
      <HStack
        alignment="center"
        spacing={Spacing.two}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "center" }),
          contentShape(shapes.rectangle()),
          padding({ horizontal: Spacing.three, vertical: Spacing.three }),
        ]}
      >
        <Image
          systemName="rectangle.portrait.and.arrow.right"
          size={20}
          color={red}
        />
        <Text
          modifiers={[font({ textStyle: "body", weight: "semibold" }), foregroundStyle(red)]}
        >
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

  const open = (href: string) => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.selectionAsync();
    }
    router.push(href as never);
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
                  <DevRow
                    key={item.href}
                    item={item}
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

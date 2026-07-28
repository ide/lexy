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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useObserve } from "expo-observe";
import { useEffect } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";

type MenuItem = {
  icon: SFSymbol;
  tint: string;
  title: string;
  subtitle: string;
  href: string;
};

const ITEMS: MenuItem[] = [
  {
    icon: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    tint: colors.systemBlue as string,
    title: "Updates",
    subtitle: "expo-updates status, controls, and activity log.",
    href: "/development/updates",
  },
  {
    icon: "person.badge.key.fill",
    tint: colors.systemGreen as string,
    title: "Login Flow",
    subtitle: "Walk the sign-in screens without signing out.",
    href: "/development/login",
  },
];

function MenuRow({
  item,
  last,
  onPress,
}: {
  item: MenuItem;
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

export default function DevelopmentMenuScreen() {
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
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
              padding({ horizontal: Spacing.two }),
            ]}
          >
            Developer tools for inspecting and testing Lexy on-device.
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
            {ITEMS.map((item, index) => (
              <MenuRow
                key={item.href}
                item={item}
                last={index === ITEMS.length - 1}
                onPress={() => open(item.href)}
              />
            ))}
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}

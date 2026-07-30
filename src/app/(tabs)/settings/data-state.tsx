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
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  opacity,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useObserve } from "expo-observe";
import { useEffect } from "react";

import { Spacing, colors } from "@/constants/theme";
import type { DataStateOverride } from "@/debug/data-state";
import {
  DATA_STATE_OPTIONS,
  useDebugOverrides,
  type DataStateOption,
} from "@/debug/debug-overrides";
import { useMapsProvider } from "@/hooks/use-maps-provider";

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

function OptionRow({
  option,
  selected,
  last,
  onPress,
}: {
  option: DataStateOption;
  selected: boolean;
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
          <Image systemName={option.icon} size={22} color={option.tint} />
          <VStack
            alignment="leading"
            spacing={Spacing.half}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>
              {option.title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {option.subtitle}
            </Text>
          </VStack>
          <Spacer />
          {/* Always in the layout (hidden via opacity when unselected) so
              choosing an option doesn't reflow the row text. */}
          <Image
            systemName="checkmark"
            size={16}
            color={colors.systemBlue as string}
            modifiers={[opacity(selected ? 1 : 0)]}
          />
        </HStack>
      </Button>
      {last ? null : <Divider modifiers={[padding({ leading: Spacing.six })]} />}
    </VStack>
  );
}

function ClearMapsProviderRow({
  savedName,
  onClear,
}: {
  savedName: string | null;
  onClear: () => void;
}) {
  return (
    <Button
      onPress={onClear}
      modifiers={[
        buttonStyle("plain"),
        disabled(savedName === null),
        frame({ maxWidth: Infinity }),
      ]}
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
          systemName="trash.fill"
          size={22}
          color={colors.systemRed as string}
        />
        <VStack
          alignment="leading"
          spacing={Spacing.half}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <Text
            modifiers={[
              font({ textStyle: "body", weight: "semibold" }),
              foregroundStyle(colors.systemRed),
            ]}
          >
            Clear Maps provider
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {savedName ? `Currently ${savedName}` : "No saved provider"}
          </Text>
        </VStack>
      </HStack>
    </Button>
  );
}

export default function DataStateScreen() {
  const { markInteractive } = useObserve();
  const { dataState, setDataState } = useDebugOverrides();
  const { saved: savedMapsProvider, clear: clearMapsProvider } =
    useMapsProvider();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  const select = (key: DataStateOverride) => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.selectionAsync();
    }
    setDataState(key);
  };

  const clearProvider = () => {
    if (!savedMapsProvider) {
      return;
    }
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    clearMapsProvider();
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
          <VStack
            alignment="leading"
            spacing={Spacing.two}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <SectionHeader>DATA STATE</SectionHeader>
              <GroupCard>
                {DATA_STATE_OPTIONS.map((option, index) => (
                  <OptionRow
                    key={option.key}
                    option={option}
                    selected={option.key === dataState}
                    last={index === DATA_STATE_OPTIONS.length - 1}
                    onPress={() => select(option.key)}
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
              Overrides the Status and Details tabs so you can preview each data
              state. Resets to Live when the app reloads.
            </Text>
          </VStack>

          <VStack
            alignment="leading"
            spacing={Spacing.two}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <SectionHeader>PERSISTED STATE</SectionHeader>
              <GroupCard>
                <ClearMapsProviderRow
                  savedName={savedMapsProvider?.name ?? null}
                  onClear={clearProvider}
                />
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
              Forgets the navigation app selected in Settings. The next map
              handoff will resolve or ask again.
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}

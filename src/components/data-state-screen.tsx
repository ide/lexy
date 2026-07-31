import { Host, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { useObserve } from "expo-observe";
import { useEffect } from "react";

import { GroupCard, SectionHeader } from "@/components/swift-ui/section";
import { RowCheckmark, SettingsRow } from "@/components/swift-ui/settings-row";
import { Spacing, colors } from "@/constants/theme";
import type { DataStateOverride } from "@/debug/data-state";
import {
  DATA_STATE_OPTIONS,
  useDebugOverrides,
} from "@/debug/debug-overrides";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { haptic } from "@/utils/haptics";

export default function DataStateScreen() {
  const { markInteractive } = useObserve();
  const { dataState, setDataState } = useDebugOverrides();
  const { saved: savedMapsProvider, clear: clearMapsProvider } =
    useMapsProvider();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  const select = (key: DataStateOverride) => {
    haptic("selection");
    setDataState(key);
  };

  const clearProvider = () => {
    haptic("impact-medium");
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
                  <SettingsRow
                    key={option.key}
                    icon={option.icon}
                    tint={option.tint}
                    title={option.title}
                    subtitle={option.subtitle}
                    accessory=<RowCheckmark selected={option.key === dataState} />
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
                <SettingsRow
                  icon="trash.fill"
                  tint={colors.systemRed}
                  title="Clear Maps provider"
                  titleColor={colors.systemRed}
                  subtitle={
                    savedMapsProvider
                      ? `Currently ${savedMapsProvider.name}`
                      : "No saved provider"
                  }
                  disabled={savedMapsProvider === null}
                  onPress={clearProvider}
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

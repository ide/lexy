import { DisclosureGroup, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  shapes,
  textSelection,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";
import type * as Updates from "expo-updates";

import {
  fillWidth,
  fillWidthLeading,
  layoutPriorityOne,
  monoCaption,
  monoCaption2,
  monoCaption2Semibold,
} from "@/components/swift-ui/modifier-presets";
import { formatEventTime } from "@/screens/update-diagnostics/event-time";
import { Spacing, colors } from "@/constants/theme";
import { describeNativeLog } from "@/updates/update-utils";

/** One native Expo Updates log line, summarized, with its raw text one tap away. */
export function NativeLogDisclosure({ entry }: { entry: Updates.UpdatesLogEntry }) {
  const description = describeNativeLog(entry);
  const isProblem = entry.level === "error" || entry.level === "fatal" || entry.level === "warn";
  const accent = isProblem ? colors.systemOrange : colors.systemBlue;
  const detailRows = [
    entry.updateId ? `Update ${entry.updateId}` : null,
    entry.assetId ? `Asset ${entry.assetId}` : null,
    entry.stacktrace?.length ? entry.stacktrace.join("\n") : null,
  ].filter((row): row is string => row !== null);

  return (
    <DisclosureGroup isExpanded={false} modifiers={[fillWidthLeading]}>
      <DisclosureGroup.Label>
        <VStack
          alignment="leading"
          spacing={Spacing.one}
          modifiers={[
            fillWidthLeading,
            contentShape(shapes.rectangle()),
            padding({ vertical: Spacing.two }),
          ]}
        >
          <HStack alignment="firstTextBaseline" spacing={Spacing.two} modifiers={[fillWidth]}>
            <Image systemName="circle.fill" size={8} color={accent} />
            {/* The title truncates so the level and time — which cannot wrap —
                always fit. */}
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                foregroundStyle(colors.label),
                lineLimit(1),
                truncationMode("tail"),
              ]}
            >
              {description.title}
            </Text>
            {isProblem ? (
              <Text
                modifiers={[
                  monoCaption2Semibold,
                  foregroundStyle(colors.systemOrange),
                  lineLimit(1),
                  layoutPriorityOne,
                ]}
              >
                {entry.level.toUpperCase()}
              </Text>
            ) : null}
            <Spacer />
            <Text
              modifiers={[
                font({ textStyle: "caption" }),
                foregroundStyle(colors.secondaryLabel),
                monospacedDigit(),
                lineLimit(1),
                layoutPriorityOne,
              ]}
            >
              {formatEventTime(entry.timestamp)}
            </Text>
          </HStack>
          <Text
            modifiers={[
              font({ textStyle: "footnote" }),
              foregroundStyle(colors.secondaryLabel),
              multilineTextAlignment("leading"),
              lineLimit(3),
              fixedSize({ horizontal: false, vertical: true }),
              fillWidthLeading,
              padding({ leading: Spacing.three }),
            ]}
          >
            {description.summary}
          </Text>
        </VStack>
      </DisclosureGroup.Label>
      <VStack
        alignment="leading"
        spacing={Spacing.two}
        modifiers={[fillWidthLeading, padding({ leading: Spacing.three, bottom: Spacing.two })]}
      >
        <Text
          modifiers={[
            monoCaption2Semibold,
            foregroundStyle(colors.secondaryLabel),
            fillWidthLeading,
          ]}
        >
          {entry.level.toUpperCase()}
          {entry.code === "None" ? "" : ` · ${entry.code}`}
        </Text>
        <Text
          modifiers={[
            monoCaption,
            foregroundStyle(colors.label),
            multilineTextAlignment("leading"),
            textSelection(true),
            fixedSize({ horizontal: false, vertical: true }),
            fillWidthLeading,
          ]}
        >
          {entry.message}
        </Text>
        {detailRows.map((row) => (
          <Text
            key={row}
            modifiers={[
              monoCaption2,
              foregroundStyle(colors.secondaryLabel),
              multilineTextAlignment("leading"),
              textSelection(true),
              fixedSize({ horizontal: false, vertical: true }),
              fillWidthLeading,
            ]}
          >
            {row}
          </Text>
        ))}
      </VStack>
    </DisclosureGroup>
  );
}

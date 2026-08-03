import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  fixedSize,
  font,
  foregroundStyle,
  monospacedDigit,
  lineLimit,
  padding,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";

import {
  fillWidth,
  fillWidthLeading,
  footnoteBold,
  footnoteMedium,
  layoutPriorityOne,
  monoCaption2,
  primaryStyle,
  secondaryStyle,
} from "@/components/swift-ui/modifier-presets";
import { formatEventTime } from "@/screens/update-diagnostics/event-time";
import { Spacing, colors } from "@/constants/theme";
import { shortUpdateId, type UpdateActivityEvent } from "@/updates/update-utils";

/** One update check, download, or reload that Lexy itself recorded. */
export function ActivityRow({ entry }: { entry: UpdateActivityEvent }) {
  return (
    <VStack
      alignment="leading"
      spacing={Spacing.one}
      modifiers={[fillWidthLeading, padding({ vertical: Spacing.two })]}
    >
      <HStack alignment="firstTextBaseline" spacing={Spacing.two} modifiers={[fillWidth]}>
        <Text
          modifiers={[
            footnoteBold,
            entry.level === "error" ? foregroundStyle(colors.systemOrange) : primaryStyle,
          ]}
        >
          {entry.title}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ textStyle: "caption" }),
            secondaryStyle,
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
          footnoteMedium,
          textSelection(true),
          fixedSize({ horizontal: false, vertical: true }),
        ]}
      >
        {entry.detail}
      </Text>
      {entry.updateId ? (
        <Text modifiers={[monoCaption2, secondaryStyle, textSelection(true)]}>
          Update {shortUpdateId(entry.updateId)}
        </Text>
      ) : null}
    </VStack>
  );
}

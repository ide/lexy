import { Divider, HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  fixedSize,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";

import {
  fillWidthLeading,
  footnoteBold,
  footnoteMedium,
  layoutPriorityOne,
  monoCaption2,
  secondaryStyle,
} from "@/components/swift-ui/modifier-presets";
import { GroupCard } from "@/components/swift-ui/section";
import { Spacing, colors } from "@/constants/theme";
import { describeKnownUpdate, formatUpdateDate, type UpdateEntry } from "@/updates/update-utils";

/** One of the three updates Expo can name: running, downloaded, or offered. */
export function KnownUpdateCard({ entry }: { entry: UpdateEntry }) {
  const copy = describeKnownUpdate(entry.state);
  const isCurrent = entry.state === "Running now";
  const isReady = entry.state === "Downloaded · launches next";
  const accent = isCurrent ? colors.systemGreen : isReady ? colors.systemBlue : colors.systemOrange;

  return (
    <GroupCard padded spacing={Spacing.three}>
      <HStack alignment="center" spacing={Spacing.three} modifiers={[fillWidthLeading]}>
        <ZStack
          modifiers={[
            frame({ width: 42, height: 42 }),
            background(
              colors.fill,
              shapes.roundedRectangle({ cornerRadius: 13, roundedCornerStyle: "continuous" }),
            ),
          ]}
        >
          <Image
            systemName={isCurrent ? "play.fill" : isReady ? "arrow.down" : "icloud.and.arrow.down"}
            size={18}
            color={accent}
          />
        </ZStack>
        <VStack alignment="leading" spacing={Spacing.half} modifiers={[fillWidthLeading]}>
          <HStack spacing={Spacing.two} modifiers={[frame({ maxWidth: Infinity })]}>
            {/* The title yields width first: it can wrap, so it is the child
                that should give way when the two together don't fit. */}
            <Text modifiers={[footnoteBold, lineLimit(2)]}>{copy.title}</Text>
            <Spacer />
            <Text
              modifiers={[
                monoCaption2,
                foregroundStyle(accent),
                // One line and first claim on width, but still truncatable —
                // `fixedSize` here could not compress at any text size.
                lineLimit(1),
                layoutPriorityOne,
                padding({ horizontal: Spacing.two, vertical: Spacing.one }),
                background(
                  colors.fill,
                  shapes.roundedRectangle({ cornerRadius: 7, roundedCornerStyle: "continuous" }),
                ),
              ]}
            >
              {copy.badge}
            </Text>
          </HStack>
          <Text
            modifiers={[
              footnoteMedium,
              secondaryStyle,
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {copy.detail}
          </Text>
        </VStack>
      </HStack>
      <Divider />
      <VStack alignment="leading" spacing={Spacing.two} modifiers={[fillWidthLeading]}>
        <HStack spacing={Spacing.three}>
          <Text modifiers={[footnoteMedium, secondaryStyle]}>Published</Text>
          <Spacer />
          <Text modifiers={[footnoteMedium, textSelection(true)]}>
            {formatUpdateDate(entry.createdAt)}
          </Text>
        </HStack>
        <HStack spacing={Spacing.three}>
          <Text modifiers={[footnoteMedium, secondaryStyle]}>Source</Text>
          <Spacer />
          <Text modifiers={[footnoteMedium]}>{entry.source}</Text>
        </HStack>
        <VStack alignment="leading" spacing={Spacing.one} modifiers={[fillWidthLeading]}>
          <Text modifiers={[footnoteMedium, secondaryStyle]}>Update ID</Text>
          <Text
            modifiers={[
              monoCaption2,
              textSelection(true),
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {entry.id}
          </Text>
        </VStack>
      </VStack>
    </GroupCard>
  );
}

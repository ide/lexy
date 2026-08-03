import { Divider, HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { multilineTextAlignment, padding, textSelection } from "@expo/ui/swift-ui/modifiers";

import { fillWidth, footnoteMedium, secondaryStyle } from "@/components/swift-ui/modifier-presets";
import { Spacing } from "@/constants/theme";

/**
 * A label/value line inside a padded `GroupCard`.
 *
 * Denser than the settings screens' `InfoRow`, and the emphasis is the other way
 * round: here the value is the reading someone came to look up, so the label is
 * the muted one. Values are selectable — the whole point of showing a runtime
 * version to someone writing a bug report.
 */
export function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <VStack spacing={0} modifiers={[fillWidth]}>
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[fillWidth, padding({ vertical: Spacing.two })]}
      >
        <Text modifiers={[footnoteMedium, secondaryStyle]}>{label}</Text>
        <Spacer />
        <Text modifiers={[footnoteMedium, textSelection(true), multilineTextAlignment("trailing")]}>
          {value}
        </Text>
      </HStack>
      {last ? null : <Divider />}
    </VStack>
  );
}

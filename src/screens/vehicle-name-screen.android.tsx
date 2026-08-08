import { Button, Host, TextInput, useNativeState } from "@expo/ui";
import type { TextInputRef } from "@expo/ui";
import {
  CircularProgressIndicator,
  Column,
  Icon,
  IconButton,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet } from "react-native";

import { iconDrawables } from "@/components/jetpack-compose/icon-drawables";
import { Section, SectionFooter } from "@/components/jetpack-compose/settings";
import { Spacing, colors } from "@/constants/theme";
import type { VehicleContext } from "@/data/lexus-api";
import { useRenameVehicle } from "@/hooks/use-rename-vehicle";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

/**
 * The form itself, mounted only once the current name is known — the contract
 * is "the field opens pre-filled with the current name" (see the spec's
 * Platform notes), and mounting late is how both platforms honor it, since a
 * native field captures its initial value on first render.
 */
function RenameForm({ context, currentName }: { context: VehicleContext; currentName: string }) {
  const router = useRouter();
  const { rename, saving, error } = useRenameVehicle(context);
  // The observable state drives the native field (and lets Clear empty it);
  // the React mirror drives the Save button's enablement.
  const text = useNativeState(currentName);
  const [name, setName] = useState(currentName);
  const fieldRef = useRef<TextInputRef>(null);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName;

  const save = () => {
    if (!canSave || saving) {
      return;
    }
    haptic("impact-light");
    rename(trimmed, {
      onSuccess: () => {
        haptic("success");
        router.back();
      },
      onError: () => haptic("error"),
    });
  };

  const clear = () => {
    text.value = "";
    setName("");
    // The point of the gesture is to retype.
    fieldRef.current?.focus();
  };

  return (
    <>
      <Section>
        <Row
          verticalAlignment="center"
          modifiers={[
            fillMaxWidth(),
            clip(Shapes.RoundedCorner(18)),
            background(colors.card),
            defaultMinSize({ minHeight: 52 }),
            padding(Spacing.two, 0, Spacing.two, 0),
          ]}
        >
          <TextInput
            ref={fieldRef}
            value={text}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={save}
            onChangeText={setName}
            placeholder="Vehicle name"
            placeholderTextColor={colors.tertiaryLabel}
            cursorColor={colors.systemBlue}
            modifiers={[weight(1), padding(Spacing.two, 0, Spacing.two, 0)]}
          />
          {name.length > 0 ? (
            <IconButton onClick={clear}>
              <Icon source={iconDrawables["close-circle"]} size={17} tint={colors.tertiaryLabel} />
            </IconButton>
          ) : null}
        </Row>
        <SectionFooter>Your car's name, saved to the Lexus app.</SectionFooter>
      </Section>

      {error ? (
        <Row
          horizontalArrangement={{ spacedBy: Spacing.two }}
          modifiers={[fillMaxWidth(), padding(Spacing.three, 0, Spacing.three, 0)]}
        >
          <Icon source={iconDrawables.warning} size={18} tint={colors.systemOrange} />
          <Text style={{ fontSize: 14 }} color={colors.secondaryLabel} modifiers={[weight(1)]}>
            {error.message}
          </Text>
        </Row>
      ) : null}

      <Button
        variant="filled"
        label={saving ? "Saving…" : "Save"}
        disabled={!canSave && !saving}
        onPress={save}
        modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}
      />
    </>
  );
}

export default function VehicleNameScreen() {
  const profile = useVehicleProfile();
  const loaded = profile.data;

  useMarkInteractive();

  return (
    <Host style={styles.host}>
      <Column
        verticalArrangement={{ spacedBy: Spacing.four }}
        modifiers={[
          fillMaxSize(),
          background(colors.groupedBackground),
          verticalScroll(),
          padding(Spacing.three, Spacing.three, Spacing.three, Spacing.six),
        ]}
      >
        {loaded ? (
          <RenameForm context={loaded.context} currentName={loaded.profile.nickname} />
        ) : profile.error ? (
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: Spacing.two }}
            modifiers={[fillMaxWidth(), padding(0, Spacing.six, 0, 0)]}
          >
            <Text style={{ fontSize: 28, fontWeight: "600" }} color={colors.label}>
              Vehicle Unavailable
            </Text>
            <Text style={{ fontSize: 14 }} color={colors.secondaryLabel}>
              Your vehicle couldn't be loaded, so there is no name to change.
            </Text>
          </Column>
        ) : (
          // A spinner alone: one field, whose one value is the thing being
          // waited on — there is nothing to draw a skeleton of.
          <Column
            horizontalAlignment="center"
            modifiers={[fillMaxWidth(), padding(0, Spacing.six, 0, 0)]}
          >
            <CircularProgressIndicator />
          </Column>
        )}
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});

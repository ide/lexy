import {
  Button,
  ContentUnavailableView,
  HStack,
  Image,
  ProgressView,
  TextField,
  VStack,
  useNativeState,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  contentShape,
  frame,
  onSubmit,
  padding,
  scrollDismissesKeyboard,
  shapes,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";

import { ErrorNotice, PrimaryButton } from "@/screens/sign-in/sign-in-elements";
import { SectionFooter } from "@/components/swift-ui/section";
import { Section, SettingsScreenScaffold } from "@/components/swift-ui/settings-screen-scaffold";
import { cardShape, fillWidth } from "@/components/swift-ui/modifier-presets";
import { Spacing, colors } from "@/constants/theme";
import type { VehicleContext } from "@/data/lexus-api";
import { useRenameVehicle } from "@/hooks/use-rename-vehicle";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

/**
 * The trailing clear glyph of an editable name field. Its tap target is the
 * 32pt square around the 17pt symbol — the size UIKit gives its own
 * `clearButtonMode` button, which is what the gesture here is imitating.
 */
function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <Button onPress={onPress} modifiers={[buttonStyle("plain"), accessibilityLabel("Clear name")]}>
      <Image
        systemName="xmark.circle.fill"
        size={17}
        color={colors.tertiaryLabel}
        modifiers={[frame({ width: 32, height: 32 }), contentShape(shapes.rectangle())]}
      />
    </Button>
  );
}

/**
 * The form itself, mounted only once the current name is known: the native
 * field takes its initial value on first render (`useNativeState` captures it
 * once), so a field mounted against an unloaded profile would stay empty even
 * after the name arrived.
 */
function RenameForm({ context, currentName }: { context: VehicleContext; currentName: string }) {
  const router = useRouter();
  const field = useRef<TextFieldRef>(null);
  const text = useNativeState(currentName);
  const [name, setName] = useState(currentName);
  const { rename, saving, error } = useRenameVehicle(context);

  const trimmed = name.trim();
  const savable = trimmed.length > 0 && trimmed !== currentName;

  const save = () => {
    if (!savable || saving) {
      return;
    }
    rename(trimmed)
      .then(() => {
        haptic("success");
        router.back();
      })
      .catch(() => {
        // The failure is rendered from `error` below; the name stays in the
        // field so it can be retried without retyping.
        haptic("error");
      });
  };

  const clear = () => {
    // `clear()` empties the native field; React's copy of the text is what the
    // Save button reads, so it has to be told separately. Focus follows the
    // clear, as it does in UIKit — the point of the gesture is to retype.
    field.current?.clear();
    setName("");
    field.current?.focus();
  };

  return (
    <VStack spacing={Spacing.three} modifiers={[fillWidth]}>
      <Section>
        {/* One field row, sized to the 44pt minimum whether or not the clear
            button is in it, so the card doesn't resize as the field empties. */}
        <HStack
          spacing={0}
          modifiers={[
            frame({ maxWidth: Infinity, minHeight: 44 }),
            padding({ leading: Spacing.three, trailing: Spacing.two }),
            background(colors.card, cardShape),
          ]}
        >
          <TextField
            ref={field}
            text={text}
            autoFocus
            placeholder="My Vehicle"
            onTextChange={setName}
            modifiers={[
              textFieldStyle("plain"),
              textInputAutocapitalization("words"),
              autocorrectionDisabled(),
              submitLabel("done"),
              onSubmit(save),
              frame({ maxWidth: Infinity }),
            ]}
          />
          {name.length > 0 ? <ClearButton onPress={clear} /> : null}
        </HStack>
        <SectionFooter>Your car’s name, saved to the Lexus app.</SectionFooter>
      </Section>

      {error ? <ErrorNotice message={error.message} /> : null}

      <PrimaryButton
        busy={saving}
        busyLabel="Saving…"
        disabled={!savable}
        label="Save"
        onPress={save}
      />
    </VStack>
  );
}

export default function VehicleNameScreen() {
  const profile = useVehicleProfile();

  useMarkInteractive();

  const loaded = profile.data;

  return (
    <SettingsScreenScaffold scrollModifiers={[scrollDismissesKeyboard("interactively")]}>
      {loaded ? (
        <RenameForm context={loaded.context} currentName={loaded.profile.nickname} />
      ) : profile.error ? (
        <ContentUnavailableView
          title="Vehicle Unavailable"
          systemImage="exclamationmark.triangle"
          description="Your vehicle couldn't be loaded, so there is no name to change."
          modifiers={[fillWidth, padding({ top: Spacing.six })]}
        />
      ) : (
        // There is nothing to show a skeleton of — one field, whose one value
        // is the thing being waited on — so the wait is just a spinner.
        <ProgressView modifiers={[fillWidth, padding({ top: Spacing.six })]} />
      )}
    </SettingsScreenScaffold>
  );
}

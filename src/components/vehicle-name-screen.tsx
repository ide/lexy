import {
  Host,
  ScrollView,
  Text,
  TextField,
  useNativeState,
  VStack,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  background,
  fixedSize,
  font,
  foregroundStyle,
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

import { ErrorNotice, PrimaryButton } from "@/components/sign-in/sign-in-elements";
import { SectionHeader } from "@/components/swift-ui/section";
import { Spacing, colors } from "@/constants/theme";
import type { VehicleContext } from "@/data/lexus-api";
import { useRenameVehicle } from "@/hooks/use-rename-vehicle";
import { useVehicleProfile } from "@/hooks/use-vehicle";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

function Footnote({ children }: { children: string }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "regular" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        padding({ top: Spacing.two, horizontal: Spacing.three }),
        fixedSize({ horizontal: false, vertical: true }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
      ]}
    >
      {children}
    </Text>
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

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === currentName || saving) {
      return;
    }
    haptic("impact-medium");
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

  return (
    <VStack spacing={Spacing.three} modifiers={[frame({ maxWidth: Infinity })]}>
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        <SectionHeader>VEHICLE NAME</SectionHeader>
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
            padding({ horizontal: Spacing.three, vertical: Spacing.three }),
            background(
              colors.card,
              shapes.roundedRectangle({
                cornerRadius: 18,
                roundedCornerStyle: "continuous",
              }),
            ),
          ]}
        />
        <Footnote>The name your Lexus account uses for this car.</Footnote>
      </VStack>

      {error ? <ErrorNotice message={error.message} /> : null}

      <PrimaryButton
        busy={saving}
        busyLabel="Saving…"
        disabled={name.trim().length === 0 || name.trim() === currentName}
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
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView modifiers={[scrollDismissesKeyboard("interactively")]}>
        <VStack
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
          {loaded ? (
            <RenameForm context={loaded.context} currentName={loaded.profile.nickname} />
          ) : (
            <Footnote>
              {profile.error ? "Your vehicle couldn't be loaded." : "Loading your vehicle…"}
            </Footnote>
          )}
        </VStack>
      </ScrollView>
    </Host>
  );
}

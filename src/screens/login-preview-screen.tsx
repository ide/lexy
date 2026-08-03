import { Button, Host, HStack, Image, Menu, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  controlSize,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SFSymbol } from "sf-symbols-typescript";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import {
  createPreviewFetch,
  createPreviewTokenStore,
  PREVIEW_SCENARIOS,
  type PreviewScenario,
} from "@/auth/preview-lexus-backend";
import SignInScreen from "@/screens/sign-in-screen";
import { Spacing, colors } from "@/constants/theme";

/**
 * Runs the *real* sign-in flow — the same `SignInScreen`, the same `AuthProvider`
 * state machine — against a mock Lexus backend (see `preview-lexus-backend`), in
 * an isolated provider with an in-memory token store. That lets the Development
 * tab walk every success and error state a user actually sees without a network
 * call, without touching the signed-in session, and without ever completing a
 * real Lexus login. Switch scenarios from the bar up top; each switch (and the
 * "run again" button) remounts the provider for a clean run.
 */
export default function LoginPreviewScreen() {
  const [scenario, setScenario] = useState<PreviewScenario>("success-multi");
  // Bumped to remount the isolated provider — a fresh in-memory store and a
  // fresh mock backend, i.e. a clean sign-in run.
  const [runId, setRunId] = useState(0);

  const fetchImpl = useMemo(() => createPreviewFetch(scenario), [scenario, runId]);
  const tokenStore = useMemo(() => createPreviewTokenStore(), [scenario, runId]);

  const selectScenario = (id: PreviewScenario) => {
    setScenario(id);
    setRunId((n) => n + 1);
  };

  return (
    <AuthProvider key={`${scenario}:${runId}`} fetch={fetchImpl} tokenStore={tokenStore}>
      <PreviewBody
        scenario={scenario}
        onSelect={selectScenario}
        onRestart={() => setRunId((n) => n + 1)}
      />
    </AuthProvider>
  );
}

// The scenario picker row — pure SwiftUI content, hosted differently per mode
// (see PreviewBody).
function ScenarioRow({
  scenario,
  onSelect,
}: {
  scenario: PreviewScenario;
  onSelect: (id: PreviewScenario) => void;
}) {
  const current =
    PREVIEW_SCENARIOS.find((option) => option.id === scenario) ?? PREVIEW_SCENARIOS[0];
  return (
    <HStack
      alignment="center"
      spacing={Spacing.two}
      modifiers={[
        padding({ horizontal: Spacing.three, vertical: Spacing.two }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
      ]}
    >
      <Image systemName="wrench.and.screwdriver.fill" size={14} color={colors.secondaryLabel} />
      <Text
        modifiers={[
          font({ textStyle: "footnote", weight: "semibold" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        Preview Scenario
      </Text>
      <Spacer />
      {/* A custom label (instead of the string form) so the menu trigger
          matches the "Preview scenario" label's footnote size/weight — a
          plain string label renders at the larger default menu font. */}
      <Menu
        label={
          <HStack alignment="center" spacing={Spacing.one}>
            <Image systemName={current.systemImage} size={14} color={colors.systemBlue} />
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "semibold" }),
                foregroundStyle(colors.systemBlue),
              ]}
            >
              {current.label}
            </Text>
          </HStack>
        }
      >
        {PREVIEW_SCENARIOS.map((option) => (
          <Button
            key={option.id}
            label={option.label}
            systemImage={option.systemImage}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </Menu>
    </HStack>
  );
}

function PreviewBody({
  scenario,
  onSelect,
  onRestart,
}: {
  scenario: PreviewScenario;
  onSelect: (id: PreviewScenario) => void;
  onRestart: () => void;
}) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  if (session) {
    // Success state: the entire screen — scenario bar and result card — is one
    // SwiftUI tree in a single Host.
    return (
      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <VStack
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity }), background(colors.card, shapes.rectangle())]}
          >
            <ScenarioRow scenario={scenario} onSelect={onSelect} />
          </VStack>
          <Spacer />
          <VStack
            spacing={Spacing.three}
            modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: Spacing.four })]}
          >
            <Image
              systemName={"checkmark.seal.fill" as SFSymbol}
              size={56}
              color={colors.systemGreen}
            />
            <Text
              modifiers={[
                font({ textStyle: "title2", weight: "bold" }),
                multilineTextAlignment("center"),
              ]}
            >
              You're Signed In
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "subheadline" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                multilineTextAlignment("center"),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity }),
              ]}
            >
              This preview ran the real sign-in flow against a mock Lexus backend. Your actual
              session was never touched, and no real sign-in happened.
            </Text>
            <Button
              label="Run Again"
              onPress={onRestart}
              modifiers={[
                buttonStyle("borderedProminent"),
                controlSize("large"),
                tint(colors.systemBlue),
                padding({ top: Spacing.two }),
              ]}
            />
          </VStack>
          <Spacer />
        </VStack>
      </Host>
    );
  }

  // Sign-in flow: the exact production SignInScreen (which brings its own
  // Host) renders below the bar, so the bar needs its own matchContents Host.
  // The login route hides the navigation header, so this dev bar owns the top
  // of the screen. A plain RN View owns the status-bar inset and the card
  // background — both reliable in RN — so the fill covers the whole safe-area
  // strip and the SwiftUI row sits cleanly below the notch. (An RN
  // `paddingTop` on the Host itself is dropped for a `matchContents` host, and
  // baking the inset into the HStack's SwiftUI padding made `matchContents`
  // mis-measure and clip the row — hence letting RN handle the inset.)
  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.card }}>
        <Host matchContents>
          <ScenarioRow scenario={scenario} onSelect={onSelect} />
        </Host>
      </View>
      <View style={{ flex: 1 }}>
        <SignInScreen />
      </View>
    </View>
  );
}

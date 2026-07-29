import {
  Button,
  Host,
  HStack,
  Image,
  Menu,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
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
import SignInScreen from "@/components/sign-in-screen";
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

  const fetchImpl = useMemo(
    () => createPreviewFetch(scenario),
    [scenario, runId],
  );
  const tokenStore = useMemo(() => createPreviewTokenStore(), [scenario, runId]);

  const selectScenario = (id: PreviewScenario) => {
    setScenario(id);
    setRunId((n) => n + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground as string }}>
      <ScenarioBar scenario={scenario} onSelect={selectScenario} />
      <View style={{ flex: 1 }}>
        <AuthProvider
          key={`${scenario}:${runId}`}
          fetch={fetchImpl}
          tokenStore={tokenStore}
        >
          <PreviewBody onRestart={() => setRunId((n) => n + 1)} />
        </AuthProvider>
      </View>
    </View>
  );
}

function ScenarioBar({
  scenario,
  onSelect,
}: {
  scenario: PreviewScenario;
  onSelect: (id: PreviewScenario) => void;
}) {
  const insets = useSafeAreaInsets();
  const current =
    PREVIEW_SCENARIOS.find((option) => option.id === scenario) ??
    PREVIEW_SCENARIOS[0];

  return (
    // The login route hides the navigation header, so this dev bar owns the top
    // of the screen. A plain RN View owns the status-bar inset and the card
    // background — both reliable in RN — so the fill covers the whole safe-area
    // strip and the SwiftUI row sits cleanly below the notch. (An RN
    // `paddingTop` on the Host itself is dropped for a `matchContents` host, and
    // baking the inset into the HStack's SwiftUI padding made `matchContents`
    // mis-measure and clip the row — hence letting RN handle the inset.)
    <View style={{ paddingTop: insets.top, backgroundColor: colors.card as string }}>
      <Host matchContents>
        <HStack
          alignment="center"
          spacing={Spacing.two}
          modifiers={[
            padding({ horizontal: Spacing.three, vertical: Spacing.two }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
        <Image
          systemName="wrench.and.screwdriver.fill"
          size={14}
          color={colors.secondaryLabel as string}
        />
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          Preview scenario
        </Text>
        <Spacer />
        {/* A custom label (instead of the string form) so the menu trigger
            matches the "Preview scenario" label's footnote size/weight — a
            plain string label renders at the larger default menu font. */}
        <Menu
          label={
            <HStack alignment="center" spacing={Spacing.one}>
              <Image
                systemName={current.systemImage}
                size={14}
                color={colors.systemBlue as string}
              />
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
      </Host>
    </View>
  );
}

function PreviewBody({ onRestart }: { onRestart: () => void }) {
  const { session } = useAuth();
  if (session) {
    return <PreviewSuccessCard onRestart={onRestart} />;
  }
  // The exact production sign-in screen, wired to the isolated preview provider.
  return <SignInScreen />;
}

function PreviewSuccessCard({ onRestart }: { onRestart: () => void }) {
  return (
    <Host
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      matchContents={false}
    >
      <VStack
        spacing={Spacing.three}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "center" }),
          padding({ horizontal: Spacing.four }),
        ]}
      >
        <Image
          systemName={"checkmark.seal.fill" as SFSymbol}
          size={56}
          color={colors.systemGreen as string}
        />
        <Text
          modifiers={[
            font({ textStyle: "title2", weight: "bold" }),
            multilineTextAlignment("center"),
          ]}
        >
          Signed in — preview only
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "subheadline", weight: "medium" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            multilineTextAlignment("center"),
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity }),
          ]}
        >
          This ran the real sign-in flow against a mock Lexus backend. Your actual
          session was never touched and no real login happened.
        </Text>
        <Button
          label="Run the flow again"
          onPress={onRestart}
          modifiers={[
            buttonStyle("borderedProminent"),
            controlSize("large"),
            tint(colors.systemBlue),
            padding({ top: Spacing.two }),
          ]}
        />
      </VStack>
    </Host>
  );
}

import { Host } from "@expo/ui";
import { AlertDialog, Column, Icon as ComposeIcon, Row, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import {
  createPreviewFetch,
  createPreviewTokenStore,
  PREVIEW_SCENARIOS,
  type PreviewScenario,
} from "@/auth/preview-lexus-backend";
import { iconDrawables } from "@/components/jetpack-compose/icon-drawables";
import { Icon } from "@/components/ui/icon";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { haptic } from "@/utils/haptics";
import SignInScreen from "@/screens/sign-in-screen";

/**
 * Runs the *real* sign-in flow — the same `SignInScreen`, the same
 * `AuthProvider` state machine — against a mock Lexus backend (see
 * `preview-lexus-backend`), in an isolated provider with an in-memory token
 * store. That lets the Developer Tools walk every success and error state a
 * user actually sees without a network call, without touching the signed-in
 * session, and without ever completing a real Lexus login. Switch scenarios
 * from the bar up top; each switch (and "Run Again") remounts the provider for
 * a clean run.
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

/**
 * The scenario bar: it owns the top of a headerless route, inset and all.
 *
 * React Native chrome rather than a Compose tree, deliberately. A `Host` sized
 * to a 52pt bar reports no height to the layout above the sign-in screen's own
 * full-screen host, so the bar never painted; the picker it opens is still
 * Compose, hosted zero-height beside it the way `alert-host.android.tsx` does
 * it. The bar is dev-tool chrome, and the thing being previewed — the sign-in
 * flow below — is the real Compose screen either way.
 */
function ScenarioBar({
  scenario,
  onSelect,
}: {
  scenario: PreviewScenario;
  onSelect: (id: PreviewScenario) => void;
}) {
  const [picking, setPicking] = useState(false);
  const insets = useSafeAreaInsets();
  const current =
    PREVIEW_SCENARIOS.find((option) => option.id === scenario) ?? PREVIEW_SCENARIOS[0];

  return (
    <>
      <Pressable
        android_ripple={{ color: colors.fill }}
        onPress={() => {
          haptic("selection");
          setPicking(true);
        }}
      >
        <View style={[styles.bar, { paddingTop: insets.top + Spacing.two }]}>
          <Icon name="wrench" size={14} tint={colors.secondaryLabel} />
          <ThemedText type="small" themeColor="secondaryLabel">
            Preview Scenario
          </ThemedText>
          <Icon name={current.icon} size={14} tint={colors.systemBlue} />
          <ThemedText type="smallBold" themeColor="systemBlue" style={styles.barValue}>
            {current.label}
          </ThemedText>
        </View>
      </Pressable>
      <Host style={styles.dialogHost}>
        {picking ? (
          <AlertDialog onDismissRequest={() => setPicking(false)}>
            <AlertDialog.Title>
              <Text style={{ fontSize: 22 }} color={colors.label}>
                Preview scenario
              </Text>
            </AlertDialog.Title>
            <AlertDialog.Text>
              <Column verticalArrangement={{ spacedBy: Spacing.one }} modifiers={[fillMaxWidth()]}>
                {PREVIEW_SCENARIOS.map((option) => (
                  <Row
                    key={option.id}
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: Spacing.two }}
                    modifiers={[
                      fillMaxWidth(),
                      clickable(() => {
                        setPicking(false);
                        onSelect(option.id);
                      }),
                      padding(0, Spacing.two, 0, Spacing.two),
                    ]}
                  >
                    <ComposeIcon
                      source={iconDrawables[option.icon]}
                      size={16}
                      tint={option.id === scenario ? colors.systemBlue : colors.secondaryLabel}
                    />
                    <Text
                      style={{ fontSize: 14 }}
                      color={option.id === scenario ? colors.systemBlue : colors.label}
                    >
                      {option.label}
                    </Text>
                  </Row>
                ))}
              </Column>
            </AlertDialog.Text>
          </AlertDialog>
        ) : null}
      </Host>
    </>
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

  return (
    <View style={styles.screen}>
      <ScenarioBar scenario={scenario} onSelect={onSelect} />
      {session ? (
        <Host style={styles.resultHost}>
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: Spacing.three }}
            modifiers={[
              fillMaxSize(),
              background(colors.groupedBackground),
              padding(Spacing.four, Spacing.six, Spacing.four, Spacing.four),
            ]}
          >
            <ComposeIcon source={iconDrawables["seal-check"]} size={44} tint={colors.systemGreen} />
            <Text style={{ fontSize: 22, fontWeight: "600" }} color={colors.label}>
              You&apos;re Signed In
            </Text>
            <Text style={{ fontSize: 14, textAlign: "center" }} color={colors.secondaryLabel}>
              This ran the real sign-in flow against a mock backend. No real sign-in happened and
              your session is untouched.
            </Text>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: Spacing.two }}
              modifiers={[
                clip(Shapes.RoundedCorner(22)),
                background(colors.card),
                clickable(onRestart),
                padding(Spacing.four, Spacing.three, Spacing.four, Spacing.three),
              ]}
            >
              <ComposeIcon source={iconDrawables.refresh} size={16} tint={colors.systemBlue} />
              <Text style={{ fontSize: 15, fontWeight: "600" }} color={colors.systemBlue}>
                Run Again
              </Text>
            </Row>
          </Column>
        </Host>
      ) : (
        // The production sign-in screen, unchanged — that is the whole point.
        <View style={styles.flow}>
          <SignInScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  barValue: {
    flex: 1,
  },
  dialogHost: {
    // Present only to carry the dialog window, and out of flow rather than
    // merely empty — a zero-height child still earns its parent's gap. Same
    // treatment as alert-host.android.tsx, which this screen cannot reuse
    // outright because its dialog lists options rather than an AlertSpec.
    position: "absolute",
    width: 0,
    height: 0,
  },
  resultHost: {
    flex: 1,
  },
  flow: {
    flex: 1,
  },
});

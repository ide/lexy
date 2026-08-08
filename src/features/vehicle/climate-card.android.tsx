import { Host, Switch } from "@expo/ui";
import { Slider } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { AlertHost, type AlertSpec } from "@/components/ui/alert-host";
import { Card } from "@/components/ui/card";
import { ColorWash } from "@/components/ui/color-wash";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon-registry";
import { useRedacted } from "@/components/ui/redactable";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { AcParameter } from "@/data/climate-settings";
import type { Vehicle } from "@/data/vehicle";
import { useClimateSettings } from "@/hooks/use-climate-settings";
import { haptic } from "@/utils/haptics";

const blue = colors.systemBlue;

/**
 * Compose's `Slider` counts the *intermediate* stops between its endpoints,
 * where the wire describes the setpoint as a range plus an interval. A 65–85
 * range in 1° steps is 21 selectable values, so 19 stops sit between the ends.
 * Zero means a continuous slider, which is also the honest answer for a car
 * that reports no interval.
 */
function sliderSteps(
  min: number | undefined,
  max: number | undefined,
  interval: number | undefined,
): number {
  if (min === undefined || max === undefined || !interval || interval <= 0) {
    return 0;
  }
  return Math.max(0, Math.round((max - min) / interval) - 1);
}

function DefrostToggle({
  label,
  symbol,
  parameter,
  disabled,
  onToggle,
}: {
  label: string;
  symbol: IconName;
  parameter?: AcParameter;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  if (!parameter) {
    return null;
  }
  const active = parameter.enabled;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={() => {
        haptic("selection");
        onToggle(!active);
      }}
      style={styles.defrostToggle}
    >
      {({ pressed }) => (
        <View style={[styles.defrostChip, (pressed || disabled) && { opacity: 0.6 }]}>
          {active ? <ColorWash color={blue} /> : null}
          <Icon name={symbol} size={17} tint={active ? blue : colors.secondaryLabel} />
          {/* Medium weight, like a Material chip's label — bold made the chips
              shout compared to every real button on the screen. */}
          <ThemedText
            type="small"
            themeColor={active ? undefined : "secondaryLabel"}
            style={active && { color: blue }}
          >
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

// The remote-start climate configuration: whether climate runs at all, what
// temperature the cabin heads for, and whether the defrosters run. These are
// settings the car applies on the next remote start — not live actuation —
// which is why the card sits with the controls. Writes are optimistic (see
// useClimateSettings), so the controls respond instantly and never lock up
// while a save is in flight.
export function ClimateCard({ vehicle }: { vehicle: Vehicle }) {
  // The switch and the slider are Compose, inside hosts of their own that the
  // React Native redaction context cannot reach. While redacted they give way
  // to plain placeholders in the same slots — which also keeps a live Material
  // switch from sitting bright and blue in a screen of skeleton bars.
  const isRedacted = useRedacted();
  const { settings, defrost, setDefrost, setTemperature, setSettingsOn, error } =
    useClimateSettings(vehicle, { placeholder: isRedacted });
  // The setpoint mid-drag, shown in the readout before the PUT commits on
  // release. A ref backs the commit so the finish callback never sees a stale
  // value.
  const [draftTemperature, setDraftTemperature] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);

  // Nothing to confirm — the write already failed — so the alert carries no
  // action and the dialog supplies a single OK.
  const [alert, setAlert] = useState<AlertSpec | null>(null);

  useEffect(() => {
    if (error) {
      setAlert({
        title: "Couldn't save climate settings",
        message: error instanceof Error ? error.message : "The vehicle API rejected the change.",
      });
    }
  }, [error]);

  const on = settings?.settingsOn ?? true;
  // Master switch off dims (and disables) the setpoint and defrost rows. The
  // fade belongs to changes the user makes — an optimistic flip shouldn't pop —
  // but a reading arriving is not a change: the first real settings, including
  // the ones that replace the skeleton's stand-in, land without animating, so a
  // car whose climate is off never shows its controls enabled and then dims
  // them. Everything after that fades.
  const hasRealSettings = !isRedacted && settings !== undefined;
  const dim = useSharedValue(on ? 1 : 0.4);
  const wasReal = useRef(false);
  useEffect(() => {
    dim.value = wasReal.current ? withTiming(on ? 1 : 0.4, { duration: 250 }) : on ? 1 : 0.4;
    wasReal.current = hasRealSettings;
  }, [dim, hasRealSettings, on]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  // The wire reports the setpoint range in the car's configured unit (°F cars:
  // 65–85 in 1° steps; metric cars report their own °C range), so the slider
  // adapts without any conversion.
  const showSlider =
    settings !== undefined &&
    typeof settings.minTemp === "number" &&
    typeof settings.maxTemp === "number";
  // Only ever read inside `showSlider`, which already requires settings.
  const temperature = draftTemperature ?? settings?.temperature ?? 0;
  const unit = `°${settings?.temperatureUnit ?? "F"}`;

  return (
    <Card style={styles.climateCard}>
      <View style={styles.climateHeader}>
        <View style={styles.inlineRow}>
          <View style={styles.climateTitle}>
            <Icon name="climate" size={17} tint={blue} />
            <ThemedText type="smallBold" themeColor="secondaryLabel">
              Remote Start Climate
            </ThemedText>
          </View>
          {settings ? (
            isRedacted ? (
              <View style={[styles.climateSwitch, styles.switchPlaceholder]} />
            ) : (
              // The slot is pinned rather than measured: the placeholder and
              // the live switch then occupy the same box by construction, and
              // the host never has to report a size back across the boundary.
              // 52x32 is Material 3's switch.
              <Host style={styles.climateSwitch}>
                <Switch value={on} onValueChange={(value) => setSettingsOn(value)} />
              </Host>
            )
          ) : // No settings yet, and nothing honest to put here: this endpoint
          // is the only reading of the setpoint, so an absent one is absent
          // rather than a stale stand-in.
          null}
        </View>
        <ThemedText type="small" themeColor="secondaryLabel">
          Settings for when you start your vehicle remotely.
        </ThemedText>
      </View>
      {showSlider ? (
        <Animated.View style={[styles.sliderRow, dimStyle]}>
          {isRedacted ? (
            <View style={[styles.slider, styles.sliderPlaceholder]}>
              <View style={styles.sliderPlaceholderTrack} />
            </View>
          ) : (
            // A Compose Slider has no intrinsic width, so the host gets an
            // explicit flex + height and the slider fills it.
            <Host style={styles.slider}>
              <Slider
                min={settings.minTemp}
                max={settings.maxTemp}
                steps={sliderSteps(settings.minTemp, settings.maxTemp, settings.tempInterval)}
                value={settings.temperature}
                enabled={on}
                onValueChange={(value) => {
                  draftRef.current = value;
                  setDraftTemperature(value);
                }}
                // Material's own "the user let go" callback, which is where the
                // write belongs — a PUT per drag frame would be a write storm.
                onValueChangeFinished={() => {
                  if (draftRef.current !== null) {
                    setTemperature(draftRef.current);
                    draftRef.current = null;
                    setDraftTemperature(null);
                  }
                }}
                modifiers={[fillMaxWidth()]}
              />
            </Host>
          )}
          <ThemedText type="smallBold" style={[styles.tabularNums, styles.temperatureReadout]}>
            {temperature.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {unit}
          </ThemedText>
        </Animated.View>
      ) : null}
      {defrost.front || defrost.rear ? (
        <Animated.View style={[styles.defrostRow, dimStyle]}>
          <DefrostToggle
            label="Front Defrost"
            symbol="defrost-front"
            parameter={defrost.front}
            disabled={!on}
            onToggle={(enabled) => setDefrost("frontDefrost", enabled)}
          />
          <DefrostToggle
            label="Rear Defrost"
            symbol="defrost-rear"
            parameter={defrost.rear}
            disabled={!on}
            onToggle={(enabled) => setDefrost("rearDefrost", enabled)}
          />
        </Animated.View>
      ) : null}
      <AlertHost alert={alert} onDismiss={() => setAlert(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  // Same row shape as inlineCard, for rows inside a multi-row card.
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Generous gaps between the header, slider, and defrost rows so each tap
  // target is comfortably distinct.
  climateCard: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  climateHeader: {
    gap: Spacing.one,
  },
  climateTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  // Material 3's switch is 52x32dp. The slot is shared by the live control's
  // host and its placeholder so the two cannot differ in size.
  climateSwitch: {
    width: 52,
    height: 32,
    backgroundColor: "transparent",
  },
  switchPlaceholder: {
    borderRadius: 16,
    backgroundColor: colors.fill,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  // Material's slider reserves a 48dp touch target around a 4dp track.
  slider: {
    flex: 1,
    height: 48,
    backgroundColor: "transparent",
  },
  // The redacted stand-in for the Compose slider, sized from the same style
  // as the real one.
  sliderPlaceholder: {
    justifyContent: "center",
  },
  sliderPlaceholderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.fill,
  },
  // Widest plausible readout ("29.5°C") reserves its slot so the slider
  // doesn't resize as the number changes width.
  temperatureReadout: {
    minWidth: 52,
    textAlign: "right",
  },
  defrostRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  defrostToggle: {
    flex: 1,
  },
  defrostChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    // Material's assist chip: a fully rounded container at this height.
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.subtleFill,
    // Clips the active wash to the chip's corner radius.
    overflow: "hidden",
  },
  tabularNums: {
    fontVariant: ["tabular-nums"],
  },
});

import { Host, Slider, Toggle } from "@expo/ui/swift-ui";
import { disabled } from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { Card } from "@/components/ui/card";
import { ColorWash } from "@/components/ui/color-wash";
import { Icon } from "@/components/ui/icon";
import { useRedacted } from "@/components/ui/redactable";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { AcParameter } from "@/data/climate-settings";
import type { Vehicle } from "@/data/vehicle";
import { useClimateSettings } from "@/hooks/use-climate-settings";
import { haptic } from "@/utils/haptics";

const blue = colors.systemBlue;

function DefrostToggle({
  label,
  symbol,
  parameter,
  disabled,
  onToggle,
}: {
  label: string;
  symbol: SFSymbol;
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
          {/* Medium weight, like a system button label — bold made the chips
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
  // The switch and slider are SwiftUI, so neither the RN redaction context nor
  // SwiftUI's own `redacted` modifier neutralizes them (the modifier leaves
  // both controls fully drawn — verified on device). While redacted they give
  // way to plain placeholders in the same slots.
  const isRedacted = useRedacted();
  const { settings, defrost, setDefrost, setTemperature, setSettingsOn, error } =
    useClimateSettings(vehicle, { placeholder: isRedacted });
  // The setpoint mid-drag, shown in the readout before the PUT commits on
  // release. A ref backs the commit so onEditingChanged never sees a stale
  // value.
  const [draftTemperature, setDraftTemperature] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);

  useEffect(() => {
    if (error) {
      Alert.alert(
        "Couldn't save climate settings",
        error instanceof Error ? error.message : "The vehicle API rejected the change.",
      );
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
            <Icon name="thermometer.medium" size={17} tint={blue} />
            <ThemedText type="smallBold" themeColor="secondaryLabel">
              Remote Start Climate
            </ThemedText>
          </View>
          {settings ? (
            // SwiftUI's `redacted` leaves a Toggle fully drawn (verified on
            // device: a live blue switch in the skeleton), so the placeholder
            // stands in for it instead. Both take the same fixed 51x31 box a
            // UIKit switch always occupies, so they can't differ in size —
            // and the host doesn't have to measure its content, which is what
            // made the real switch land right of its slot for a frame before
            // snapping back.
            isRedacted ? (
              <View style={[styles.climateSwitch, styles.switchPlaceholder]} />
            ) : (
              <Host style={styles.climateSwitch}>
                <Toggle isOn={on} onIsOnChange={(value) => setSettingsOn(value)} />
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
          {/* Redaction leaves a Slider drawn too (a live blue track), so the
              skeleton shows the bare track in the same 28pt slot. */}
          {isRedacted ? (
            <View style={[styles.slider, styles.sliderPlaceholder]}>
              <View style={styles.sliderPlaceholderTrack} />
            </View>
          ) : (
            // A SwiftUI Slider has no intrinsic width, so the host gets an
            // explicit flex + height instead of matchContents.
            <Host style={styles.slider}>
              <Slider
                min={settings.minTemp}
                max={settings.maxTemp}
                step={settings.tempInterval ?? 1}
                value={settings.temperature}
                onValueChange={(value) => {
                  draftRef.current = value;
                  setDraftTemperature(value);
                }}
                onEditingChanged={(editing) => {
                  if (!editing && draftRef.current !== null) {
                    setTemperature(draftRef.current);
                    draftRef.current = null;
                    setDraftTemperature(null);
                  }
                }}
                modifiers={[disabled(!on)]}
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
            symbol="windshield.front.and.heat.waves"
            parameter={defrost.front}
            disabled={!on}
            onToggle={(enabled) => setDefrost("frontDefrost", enabled)}
          />
          <DefrostToggle
            label="Rear Defrost"
            symbol="windshield.rear.and.heat.waves"
            parameter={defrost.rear}
            disabled={!on}
            onToggle={(enabled) => setDefrost("rearDefrost", enabled)}
          />
        </Animated.View>
      ) : null}
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
  // The switch's slot, shared by the live Toggle's host and its placeholder, so
  // pinning the box keeps the two identical and spares the host a measure pass.
  // 69x28 is what the Toggle actually draws, measured on device — not the 51x31
  // a UIKit switch uses, which this had assumed: at 51 wide the control was
  // overflowing its own host, so the placeholder sat 9pt inside where the
  // switch really was. It holds that size at every Dynamic Type setting
  // (checked up to XXXL). The trailing inset keeps the switch off the card's
  // edge, which a control needs more than a line of text does.
  climateSwitch: {
    width: 69,
    height: 28,
    marginRight: Spacing.two,
    backgroundColor: "transparent",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  slider: {
    flex: 1,
    height: 28,
    backgroundColor: "transparent",
  },
  // The redacted stand-in for the SwiftUI slider, sized from the same style
  // as the real one.
  sliderPlaceholder: {
    justifyContent: "center",
  },
  sliderPlaceholderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.fill,
  },
  // The switch as it is actually *drawn*, which is not the box it is laid out
  // in: the Toggle reports a 69pt frame but paints a 63pt track inside it, and
  // not centred — the track's trailing edge lands 22pt inside the card, where
  // the frame's is 24pt. Both numbers come from measuring the pixels of a
  // device screenshot, so the pill covers the switch rather than its slot.
  // The height needs no correction; the track fills the frame's 28pt.
  switchPlaceholder: {
    width: 63,
    marginRight: Spacing.two - 2,
    borderRadius: 14,
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
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.subtleFill,
    // Clips the active wash to the chip's corner radius.
    overflow: "hidden",
  },
  tabularNums: {
    fontVariant: ["tabular-nums"],
  },
});

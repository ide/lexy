import { useMapsProvider } from "@/hooks/use-maps-provider";

import {
  GroupCard,
  Section,
  SectionFooter,
  SectionHeader,
  SettingsRow,
  SettingsScreenScaffold,
} from "@/components/jetpack-compose/settings";
import type { DrawableIconName } from "@/components/jetpack-compose/icon-drawables";
import type { DataStateOverride } from "@/debug/data-state";
import { DATA_STATE_OPTIONS, useDebugOverrides } from "@/debug/debug-overrides";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import { haptic } from "@/utils/haptics";

/**
 * The Android data-state screen carries only the override list — the
 * PERSISTED STATE section (clearing the saved maps provider) is iOS-only,
 * because Android has no saved provider to clear: its maps hand-off is a
 * geo: intent the system resolves (see the map screen's Platform notes).
 */
// Every option's glyph must exist as a Compose drawable; a miss is a type
// error here rather than an empty slot at runtime.
const OPTIONS = DATA_STATE_OPTIONS satisfies readonly { icon: DrawableIconName }[];

export default function DataStateScreen() {
  const { dataState, setDataState } = useDebugOverrides();
  // Imported for parity of behavior with iOS reloads: the hook re-probes on
  // focus, keeping the provider cache warm for the map screen. No UI here.
  useMapsProvider();

  useMarkInteractive();

  const select = (key: DataStateOverride) => {
    haptic("selection");
    setDataState(key);
  };

  return (
    <SettingsScreenScaffold>
      <Section>
        <SectionHeader>DATA STATE</SectionHeader>
        <GroupCard>
          {OPTIONS.map((option, index) => (
            <SettingsRow
              key={option.key}
              icon={option.icon}
              tint={option.tint}
              title={option.title}
              subtitle={option.subtitle}
              selected={option.key === dataState}
              last={index === OPTIONS.length - 1}
              onPress={() => select(option.key)}
            />
          ))}
        </GroupCard>
        <SectionFooter>
          Overrides the Status and Details tabs so you can preview each data state. Resets to Live
          when the app reloads.
        </SectionFooter>
      </Section>
    </SettingsScreenScaffold>
  );
}

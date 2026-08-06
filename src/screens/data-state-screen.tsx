import { GroupCard, SectionFooter, SectionHeader } from "@/components/swift-ui/section";
import { Section, SettingsScreenScaffold } from "@/components/swift-ui/settings-screen-scaffold";
import { RowCheckmark, SettingsRow } from "@/components/swift-ui/settings-row";
import { colors } from "@/constants/theme";
import type { DataStateOverride } from "@/debug/data-state";
import {
  COMMAND_CONFIRM_OPTIONS,
  DATA_STATE_OPTIONS,
  useDebugOverrides,
  type CommandConfirmStyle,
} from "@/debug/debug-overrides";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import { haptic } from "@/utils/haptics";

export default function DataStateScreen() {
  const { dataState, setDataState, commandConfirm, setCommandConfirm } = useDebugOverrides();
  const { saved: savedMapsProvider, clear: clearMapsProvider } = useMapsProvider();

  useMarkInteractive();

  const select = (key: DataStateOverride) => {
    haptic("selection");
    setDataState(key);
  };

  const selectConfirmStyle = (key: CommandConfirmStyle) => {
    haptic("selection");
    setCommandConfirm(key);
  };

  const clearProvider = () => {
    haptic("impact-medium");
    clearMapsProvider();
  };

  return (
    <SettingsScreenScaffold>
      <Section>
        <SectionHeader>DATA STATE</SectionHeader>
        <GroupCard>
          {DATA_STATE_OPTIONS.map((option, index) => (
            <SettingsRow
              key={option.key}
              icon={option.icon}
              tint={option.tint}
              title={option.title}
              subtitle={option.subtitle}
              accessory=<RowCheckmark selected={option.key === dataState} />
              last={index === DATA_STATE_OPTIONS.length - 1}
              onPress={() => select(option.key)}
            />
          ))}
        </GroupCard>
        <SectionFooter>
          Overrides the Status and Details tabs so you can preview each data state. Resets to Live
          when the app reloads.
        </SectionFooter>
      </Section>

      <Section>
        <SectionHeader>COMMAND CONFIRMATION</SectionHeader>
        <GroupCard>
          {COMMAND_CONFIRM_OPTIONS.map((option, index) => (
            <SettingsRow
              key={option.key}
              icon={option.icon}
              tint={option.tint}
              title={option.title}
              subtitle={option.subtitle}
              accessory=<RowCheckmark selected={option.key === commandConfirm} />
              last={index === COMMAND_CONFIRM_OPTIONS.length - 1}
              onPress={() => selectConfirmStyle(option.key)}
            />
          ))}
        </GroupCard>
        <SectionFooter>
          How Remote Controls ask before actuating the car. Affects every control on the Status tab,
          including the ones behind More controls. Resets to Alert when the app reloads.
        </SectionFooter>
      </Section>

      <Section>
        <SectionHeader>PERSISTED STATE</SectionHeader>
        <GroupCard>
          <SettingsRow
            icon="trash.fill"
            tint={colors.systemRed}
            title="Clear Maps provider"
            titleColor={colors.systemRed}
            subtitle={
              savedMapsProvider ? `Currently ${savedMapsProvider.name}` : "No saved provider"
            }
            disabled={savedMapsProvider === null}
            onPress={clearProvider}
          />
        </GroupCard>
        <SectionFooter>
          Forgets the navigation app selected in Settings. The next map handoff will resolve or ask
          again.
        </SectionFooter>
      </Section>
    </SettingsScreenScaffold>
  );
}

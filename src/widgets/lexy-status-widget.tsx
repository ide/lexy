import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
// In the widget bundle `react-native` resolves to expo-widgets' stub, whose
// PlatformColor produces the { semantic: [...] } shape the SwiftUI renderer
// expects — the widget cannot import the app's theme module (it pulls in the
// full React Native runtime), so semantic colors are named directly here.
import { PlatformColor } from 'react-native';

export type LexyStatusProps = {
  locked: boolean;
  // Preformatted label — widgets render out-of-process, so props must be serializable.
  updatedAt: string;
};

const LexyStatusWidget = (props: LexyStatusProps, environment: WidgetEnvironment) => {
  'widget';
  const icon = props.locked ? 'lock.fill' : 'lock.open.fill';
  const label = props.locked ? 'Locked' : 'Unlocked';
  // The same locked/unlocked tints the app's lock summary uses, adaptive to
  // light/dark instead of the pinned hex twins this once carried.
  const tint = PlatformColor(props.locked ? 'systemGreen' : 'systemOrange');
  const secondary = PlatformColor('secondaryLabel');

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack spacing={6}>
        <Image systemName={icon} />
        <Text modifiers={[font({ weight: 'semibold', size: 14 })]}>{label}</Text>
      </HStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        // System background + label colors so the widget follows light/dark
        // mode like every stock widget, rather than rendering always-dark.
        containerBackground(PlatformColor('systemBackground'), 'widget'),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
        padding({ all: 16 }),
      ]}>
      <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(secondary)]}>
        Lexy
      </Text>
      <Spacer />
      <Image systemName={icon} color={tint} />
      <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(PlatformColor('label'))]}>
        {label}
      </Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>
        Updated {props.updatedAt}
      </Text>
    </VStack>
  );
};

export default createWidget('LexyStatusWidget', LexyStatusWidget);

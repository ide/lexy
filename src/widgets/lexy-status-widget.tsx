import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type LexyStatusProps = {
  locked: boolean;
  // Preformatted label — widgets render out-of-process, so props must be serializable.
  updatedAt: string;
};

const LexyStatusWidget = (props: LexyStatusProps, environment: WidgetEnvironment) => {
  'widget';
  const icon = props.locked ? 'lock.fill' : 'lock.open.fill';
  const label = props.locked ? 'Locked' : 'Unlocked';
  const tint = props.locked ? '#34C759' : '#FF9500';

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
        containerBackground('#1C1C1E', 'widget'),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
        padding({ all: 16 }),
      ]}>
      <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle('#8E8E93')]}>
        Lexy
      </Text>
      <Spacer />
      <Image systemName={icon} color={tint} />
      <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle('#FFFFFF')]}>
        {label}
      </Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93')]}>
        Updated {props.updatedAt}
      </Text>
    </VStack>
  );
};

export default createWidget('LexyStatusWidget', LexyStatusWidget);

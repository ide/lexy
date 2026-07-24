import { useState } from 'react';
import { Button, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// expo-widgets is iOS-only; require it lazily so this screen still runs on
// Android and web.
function updateStatusWidget(locked: boolean) {
  if (process.env.EXPO_OS !== 'ios') {
    return;
  }
  const LexyStatusWidget = require('@/widgets/lexy-status-widget').default;
  LexyStatusWidget.updateSnapshot({
    locked,
    updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
}

export default function HomeScreen() {
  const [locked, setLocked] = useState(true);

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    updateStatusWidget(next);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Lexy
          </ThemedText>
          <ThemedText type="small">Vehicle is {locked ? 'locked' : 'unlocked'}</ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Status widget"
            hint={
              <ThemedText type="small">
                {Platform.OS === 'ios'
                  ? 'add "Lexy Status" to your home screen'
                  : 'available on iOS'}
              </ThemedText>
            }
          />
          <Button title={locked ? 'Unlock' : 'Lock'} onPress={toggleLock} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});

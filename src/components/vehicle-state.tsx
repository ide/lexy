import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, colors } from '@/constants/theme';

export function VehicleLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.systemBlue as string} />
      <ThemedText themeColor="secondaryLabel">Loading vehicle…</ThemedText>
    </View>
  );
}

export function VehicleError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Vehicle unavailable</ThemedText>
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        {message}
      </ThemedText>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          Try again
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
  button: {
    borderRadius: 100,
    backgroundColor: colors.systemBlue,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  buttonLabel: {
    color: '#FFFFFF',
  },
});

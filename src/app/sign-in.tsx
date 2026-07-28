import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useAuth } from '@/auth/auth-context';
import { ThemedText } from '@/components/themed-text';
import { Spacing, colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function copyForStep(step: ReturnType<typeof useAuth>['step']) {
  switch (step) {
    case 'password':
      return {
        button: 'Sign in',
        placeholder: 'Password',
        title: 'Enter your password',
      };
    case 'otp':
      return {
        button: 'Verify',
        placeholder: 'Verification code',
        title: 'Enter the SMS code',
      };
    case 'choice':
      return {
        button: 'Continue',
        placeholder: '',
        title: 'Choose a verification method',
      };
    default:
      return {
        button: 'Continue',
        placeholder: 'Email address',
        title: 'Sign in to Lexus',
      };
  }
}

export default function SignIn() {
  const theme = useTheme();
  const { busy, choices, error, prompt, step, submit } = useAuth();
  const [value, setValue] = useState('');
  const input = useRef<TextInput>(null);
  const copy = copyForStep(step);

  useEffect(() => {
    setValue('');
    requestAnimationFrame(() => input.current?.focus());
  }, [step]);

  const send = async (answer: string | number) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await submit(answer);
  };

  const canSubmit = value.trim().length > 0 && !busy;
  const isChoice = step === 'choice' && choices.length > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.groupedBackground }}
      contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: theme.card }]}>
          <Image source="sf:key.fill" tintColor={colors.systemBlue as string} style={styles.iconImage} />
        </View>
        <ThemedText type="title">{copy.title}</ThemedText>
        <ThemedText themeColor="secondaryLabel" style={styles.subtitle}>
          {prompt ?? 'Connect directly to your Lexus account.'}
        </ThemedText>
      </View>

      {isChoice ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.form}>
          {choices.map((choice, index) => (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              key={choice}
              onPress={() => send(index)}
              style={({ pressed }) => [
                styles.choice,
                { backgroundColor: theme.card },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{choice}</ThemedText>
            </Pressable>
          ))}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn} exiting={FadeOut} key={step ?? 'username'} style={styles.form}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={
              step === 'password' ? 'password' : step === 'otp' ? 'oneTimeCode' : 'username'
            }
            editable={!busy}
            keyboardType={step === 'otp' ? 'number-pad' : 'email-address'}
            onChangeText={setValue}
            onSubmitEditing={() => {
              if (canSubmit) {
                send(value.trim());
              }
            }}
            placeholder={copy.placeholder}
            placeholderTextColor={colors.secondaryLabel}
            ref={input}
            returnKeyType={step === 'otp' ? 'done' : 'next'}
            secureTextEntry={step === 'password'}
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                color: colors.label,
              },
            ]}
            value={value}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => send(value.trim())}
            style={({ pressed }) => [
              styles.button,
              (!canSubmit || pressed) && styles.buttonMuted,
            ]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                {copy.button}
              </ThemedText>
            )}
          </Pressable>
        </Animated.View>
      )}

      {error ? (
        <Animated.View entering={FadeIn} style={[styles.error, { backgroundColor: theme.card }]}>
          <Image
            source="sf:exclamationmark.triangle.fill"
            tintColor={colors.systemOrange as string}
            style={styles.errorIcon}
          />
          <ThemedText selectable type="small" style={styles.errorText}>
            {error}
          </ThemedText>
        </Animated.View>
      ) : null}

      <ThemedText type="small" themeColor="secondaryLabel" style={styles.privacy}>
        Your password and verification code are sent directly to Lexus and are never stored by
        Lexy. Session tokens are encrypted in this device&apos;s Keychain.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  iconImage: {
    width: 30,
    height: 30,
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 17,
  },
  button: {
    minHeight: 50,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.systemBlue,
  },
  buttonMuted: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#FFFFFF',
  },
  choice: {
    minHeight: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  errorIcon: {
    width: 20,
    height: 20,
  },
  errorText: {
    flex: 1,
  },
  privacy: {
    textAlign: 'center',
  },
});

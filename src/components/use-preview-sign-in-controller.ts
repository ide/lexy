import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { AuthenticationStep } from "@/auth/lexus-auth";
import type { SignInController } from "@/components/sign-in-screen";

const PREVIEW_CHOICES = ["Email", "Text message"];
const PREVIEW_DELAY_MS = 500;

/**
 * A self-contained mock of the Lexus sign-in state machine for the Development
 * tab's login preview. It advances credentials → choice → OTP → done entirely
 * in local state, so the login screens can be exercised without hitting the
 * network or touching the real auth session — you stay signed in throughout.
 */
export function usePreviewSignInController(): SignInController {
  const [step, setStep] = useState<AuthenticationStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // Simulate the brief network round-trip between steps so the busy states in
  // the UI (spinners, disabled buttons) are exercised too.
  const afterDelay = useCallback((run: () => void) => {
    setBusy(true);
    setTimeout(() => {
      if (!mounted.current) {
        return;
      }
      run();
      setBusy(false);
    }, PREVIEW_DELAY_MS);
  }, []);

  const submitCredentials = useCallback(() => {
    afterDelay(() => setStep("choice"));
  }, [afterDelay]);

  const submit = useCallback(
    (value: string | number) => {
      if (step === "choice" && typeof value === "number") {
        setMethod(PREVIEW_CHOICES[value] ?? null);
        afterDelay(() => setStep("otp"));
        return;
      }
      // OTP entered — end of the preview. Reset to the start and make clear the
      // real session was never involved.
      afterDelay(() => {
        setStep(null);
        setMethod(null);
        Alert.alert(
          "Login flow preview",
          "You reached the end of the flow. Your real session was not affected.",
        );
      });
    },
    [afterDelay, step],
  );

  return {
    busy,
    choices: step === "choice" ? PREVIEW_CHOICES : [],
    error: null,
    method,
    prompt:
      step === "choice"
        ? "Choose how you'd like to receive your verification code."
        : null,
    step,
    submit,
    submitCredentials,
  };
}

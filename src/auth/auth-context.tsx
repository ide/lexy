import { fetch } from 'expo/fetch';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  classifyAuthenticationNode,
  continueAuthentication,
  exchangeSsoToken,
  LexusAuthError,
  refreshSession,
  startAuthentication,
  type AuthenticationNode,
  type AuthenticationStep,
  type LexusSession,
} from '@/auth/lexus-auth';
import { secureTokenStore } from '@/auth/token-store';

type AuthContextValue = {
  busy: boolean;
  choices: string[];
  error: string | null;
  isLoading: boolean;
  /** The verification method the user selected at the `choice` step (e.g. "Email"), if any. */
  method: string | null;
  prompt: string | null;
  session: LexusSession | null;
  signOut: () => Promise<void>;
  step: AuthenticationStep | null;
  submit: (value: string | number) => Promise<void>;
  /**
   * Answer the username and password steps back to back so the sign-in screen
   * can collect both credentials at once. Lexus models them as two sequential
   * nodes; this drives them without surfacing the intermediate password node.
   */
  submitCredentials: (username: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function callbackOutput(node: AuthenticationNode | null, name: string): unknown {
  for (const callback of node?.callbacks ?? []) {
    const output = callback.output?.find((item) => item.name === name);
    if (output) {
      return output.value;
    }
  }
  return null;
}

function nodePrompt(node: AuthenticationNode | null): string | null {
  const prompt = callbackOutput(node, 'prompt');
  if (typeof prompt === 'string') {
    return prompt;
  }
  const message = callbackOutput(node, 'message');
  return typeof message === 'string' ? message : null;
}

function nodeChoices(node: AuthenticationNode | null): string[] {
  const choices = callbackOutput(node, 'choices');
  return Array.isArray(choices) && choices.every((choice) => typeof choice === 'string')
    ? choices
    : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof LexusAuthError || error instanceof Error) {
    return error.message;
  }
  return 'Lexus sign-in failed. Please try again.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<LexusSession | null>(null);
  const [node, setNode] = useState<AuthenticationNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    secureTokenStore
      .load()
      .then(async (stored) => {
        if (!stored) {
          return null;
        }
        if (stored.expiresAt > Date.now() + 60_000) {
          return stored;
        }
        const refreshed = await refreshSession(stored.refreshToken, fetch);
        await secureTokenStore.save(refreshed);
        return refreshed;
      })
      .then((restored) => {
        if (active && restored) {
          setSession(restored);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Apply the next node: exchange for a session when authentication is
  // complete, otherwise advance the UI to the returned step.
  const advance = useCallback(async (next: AuthenticationNode) => {
    if (next.tokenId) {
      const authenticated = await exchangeSsoToken(next.tokenId, fetch);
      await secureTokenStore.save(authenticated);
      setSession(authenticated);
      setNode(null);
    } else {
      setNode(next);
    }
  }, []);

  const submit = useCallback(
    async (value: string | number) => {
      setBusy(true);
      setError(null);
      try {
        const current = node ?? (await startAuthentication(fetch));
        // Remember which verification method was picked so the OTP screen can
        // name it correctly (e.g. an email code vs. an SMS code).
        if (typeof value === 'number' && classifyAuthenticationNode(current) === 'choice') {
          setMethod(nodeChoices(current)[value] ?? null);
        }
        await advance(await continueAuthentication(current, value, fetch));
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [advance, node],
  );

  const submitCredentials = useCallback(
    async (username: string, password: string) => {
      setBusy(true);
      setError(null);
      try {
        let current = node ?? (await startAuthentication(fetch));
        // Answer the username step unless we are already resuming at the
        // password step (e.g. after a wrong-password retry that re-prompts only
        // the password) — otherwise the username would be sent as the password.
        if (classifyAuthenticationNode(current) !== 'password') {
          current = await continueAuthentication(current, username, fetch);
        }
        // The happy path lands on the password node; answer it in the same pass.
        // Anything else (a rejected username, a jump straight to 2FA) is
        // surfaced as-is.
        if (!current.tokenId && classifyAuthenticationNode(current) === 'password') {
          current = await continueAuthentication(current, password, fetch);
        }
        await advance(current);
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [advance, node],
  );

  const signOut = useCallback(async () => {
    await secureTokenStore.clear();
    setSession(null);
    setNode(null);
    setError(null);
    setMethod(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      busy,
      choices: nodeChoices(node),
      error,
      isLoading,
      method,
      prompt: nodePrompt(node),
      session,
      signOut,
      step: node ? classifyAuthenticationNode(node) : null,
      submit,
      submitCredentials,
    }),
    [busy, error, isLoading, method, node, session, signOut, submit, submitCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

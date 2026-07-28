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
  prompt: string | null;
  session: LexusSession | null;
  signOut: () => Promise<void>;
  step: AuthenticationStep | null;
  submit: (value: string | number) => Promise<void>;
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

  const submit = useCallback(
    async (value: string | number) => {
      setBusy(true);
      setError(null);
      try {
        const current = node ?? (await startAuthentication(fetch));
        const next = await continueAuthentication(current, value, fetch);
        if (next.tokenId) {
          const authenticated = await exchangeSsoToken(next.tokenId, fetch);
          await secureTokenStore.save(authenticated);
          setSession(authenticated);
          setNode(null);
        } else {
          setNode(next);
        }
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [node],
  );

  const signOut = useCallback(async () => {
    await secureTokenStore.clear();
    setSession(null);
    setNode(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      busy,
      choices: nodeChoices(node),
      error,
      isLoading,
      prompt: nodePrompt(node),
      session,
      signOut,
      step: node ? classifyAuthenticationNode(node) : null,
      submit,
    }),
    [busy, error, isLoading, node, session, signOut, submit],
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

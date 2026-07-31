import { fetch as expoFetch } from "expo/fetch";
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  type RequestLike,
} from "@/auth/lexus-auth";
import { secureTokenStore, type TokenStore } from "@/auth/token-store";
import { clearVehicleCache } from "@/data/query-client";

type AuthContextValue = {
  busy: boolean;
  /**
   * Whether the OTP step can offer switching to another delivery method — true
   * only when the account presented more than one verification channel.
   */
  canChangeMethod: boolean;
  /**
   * Restart verification and return to the `choice` step so the user can pick a
   * different delivery method (e.g. switch from SMS to email). Available on the
   * OTP step once credentials have been accepted.
   */
  changeMethod: () => Promise<void>;
  choices: string[];
  error: string | null;
  isLoading: boolean;
  /** The verification method the user selected at the `choice` step (e.g. "Email"), if any. */
  method: string | null;
  prompt: string | null;
  /**
   * Restart verification and re-select the current delivery method so Lexus
   * dispatches a fresh code, returning the user to the OTP step. Available on
   * the OTP step once credentials have been accepted.
   */
  resendCode: () => Promise<void>;
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
  const prompt = callbackOutput(node, "prompt");
  if (typeof prompt === "string") {
    return prompt;
  }
  const message = callbackOutput(node, "message");
  return typeof message === "string" ? message : null;
}

function nodeChoices(node: AuthenticationNode | null): string[] {
  const choices = callbackOutput(node, "choices");
  return Array.isArray(choices) && choices.every((choice) => typeof choice === "string")
    ? choices
    : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof LexusAuthError || error instanceof Error) {
    return error.message;
  }
  return "Lexus sign-in failed. Please try again.";
}

/**
 * The Lexus network and storage dependencies. Production uses the real Expo
 * `fetch` and Keychain-backed token store (the defaults); the Development tab's
 * login preview injects a mock backend and an in-memory store so the exact same
 * flow can be exercised without a network call or touching the real session.
 */
export type AuthProviderProps = PropsWithChildren<{
  fetch?: RequestLike;
  tokenStore?: TokenStore;
}>;

export function AuthProvider({
  children,
  fetch = expoFetch,
  tokenStore = secureTokenStore,
}: AuthProviderProps) {
  const [session, setSession] = useState<LexusSession | null>(null);
  const [node, setNode] = useState<AuthenticationNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  // The delivery methods the account offered at the `choice` step, kept so the
  // OTP step knows whether switching to another method is even possible.
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  // The accepted credentials, held in memory (never persisted) so verification
  // can be restarted to resend a code or switch methods without re-prompting.
  // Cleared once authentication completes or the user signs out.
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    tokenStore
      .load()
      .then(async (stored) => {
        if (!stored) {
          return null;
        }
        if (stored.expiresAt > Date.now() + 60_000) {
          return stored;
        }
        const refreshed = await refreshSession(stored.refreshToken, fetch);
        await tokenStore.save(refreshed);
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
  }, [fetch, tokenStore]);

  // Apply the next node: exchange for a session when authentication is
  // complete, otherwise advance the UI to the returned step.
  const advance = useCallback(
    async (next: AuthenticationNode) => {
      if (next.tokenId) {
        const authenticated = await exchangeSsoToken(next.tokenId, fetch);
        await tokenStore.save(authenticated);
        setSession(authenticated);
        setNode(null);
        // Authentication is done — drop the in-memory credentials.
        setCredentials(null);
      } else {
        setNode(next);
      }
    },
    [fetch, tokenStore],
  );

  const submit = useCallback(
    async (value: string | number) => {
      setBusy(true);
      setError(null);
      try {
        const current = node ?? (await startAuthentication(fetch));
        // Remember which verification method was picked so the OTP screen can
        // name it correctly (e.g. an email code vs. an SMS code), along with the
        // full set of offered methods so it knows whether switching is possible.
        if (typeof value === "number" && classifyAuthenticationNode(current) === "choice") {
          const offered = nodeChoices(current);
          setAvailableMethods(offered);
          setMethod(offered[value] ?? null);
        }
        await advance(await continueAuthentication(current, value, fetch));
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [advance, fetch, node],
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
        if (classifyAuthenticationNode(current) !== "password") {
          current = await continueAuthentication(current, username, fetch);
        }
        // The happy path lands on the password node; answer it in the same pass.
        // Anything else (a rejected username, a jump straight to 2FA) is
        // surfaced as-is.
        if (!current.tokenId && classifyAuthenticationNode(current) === "password") {
          current = await continueAuthentication(current, password, fetch);
        }
        // Remember the accepted credentials so verification can be restarted to
        // resend a code or switch delivery methods without asking again.
        setCredentials({ username, password });
        await advance(current);
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [advance, fetch, node],
  );

  // Restart the authentication tree from scratch and replay the stored
  // credentials back to the `choice` step. Lexus models verification as a linear
  // tree with no native "resend" or "back", so re-traversing the choice node is
  // how a fresh code is dispatched. When `reselectMethod` is set we re-pick the
  // current method (resend via the same channel and land back on OTP); otherwise
  // we stop at the choice step so the user can pick a different method.
  const restartVerification = useCallback(
    async (reselectMethod: boolean) => {
      if (!credentials) {
        setError("Your sign-in session expired. Please enter your email and password again.");
        setNode(null);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        let current = await startAuthentication(fetch);
        if (classifyAuthenticationNode(current) === "username") {
          current = await continueAuthentication(current, credentials.username, fetch);
        }
        if (!current.tokenId && classifyAuthenticationNode(current) === "password") {
          current = await continueAuthentication(current, credentials.password, fetch);
        }
        // Resend: re-select the same channel so a new code is sent and we return
        // to the OTP step. Match by label since the tree may reorder choices.
        if (
          reselectMethod &&
          method &&
          !current.tokenId &&
          classifyAuthenticationNode(current) === "choice"
        ) {
          const index = nodeChoices(current).indexOf(method);
          if (index >= 0) {
            current = await continueAuthentication(current, index, fetch);
          }
        }
        // Landing on the choice step means the user re-picks; drop the remembered
        // method so the OTP copy isn't stale, and refresh the offered methods.
        if (!current.tokenId && classifyAuthenticationNode(current) === "choice") {
          setAvailableMethods(nodeChoices(current));
          setMethod(null);
        }
        await advance(current);
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [advance, credentials, fetch, method],
  );

  const resendCode = useCallback(() => restartVerification(true), [restartVerification]);
  const changeMethod = useCallback(() => restartVerification(false), [restartVerification]);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    // Clear the persisted query cache too — clearing the token store alone
    // leaves the vehicle/account data on disk, which would leak to the next
    // signed-in user.
    await clearVehicleCache();
    setSession(null);
    setNode(null);
    setError(null);
    setMethod(null);
    setAvailableMethods([]);
    setCredentials(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      busy,
      canChangeMethod: availableMethods.length > 1,
      changeMethod,
      choices: nodeChoices(node),
      error,
      isLoading,
      method,
      prompt: nodePrompt(node),
      resendCode,
      session,
      signOut,
      step: node ? classifyAuthenticationNode(node) : null,
      submit,
      submitCredentials,
    }),
    [
      availableMethods,
      busy,
      changeMethod,
      error,
      isLoading,
      method,
      node,
      resendCode,
      session,
      signOut,
      submit,
      submitCredentials,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

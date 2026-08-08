const IDENTITY_ROOT = "https://login.lexusdriverslogin.com";
const REALM_PATH = "realms/root/realms/tmna-native";
const AUTHENTICATE_URL =
  `${IDENTITY_ROOT}/json/${REALM_PATH}/authenticate` +
  "?authIndexType=service&authIndexValue=signin_2.0&locale=en-US";
const AUTHORIZE_URL = `${IDENTITY_ROOT}/oauth2/${REALM_PATH}/authorize`;
const TOKEN_URL = `${IDENTITY_ROOT}/oauth2/${REALM_PATH}/access_token`;

const CLIENT_ID = "oneappsdkclient";
const REDIRECT_URI = "com.toyota.oneapp:/oauth2Callback";
const SCOPE = "openid profile write";

export type RequestLike = (input: string, init?: RequestInit) => Promise<Response>;

export type AuthenticationCallback = {
  type: string;
  output?: { name: string; value: unknown }[];
  input?: { name: string; value: unknown }[];
};

export type AuthenticationNode = {
  authId?: string;
  callbacks?: AuthenticationCallback[];
  tokenId?: string;
  successUrl?: string;
  code?: number;
  message?: string;
};

export type AuthenticationStep = "username" | "password" | "otp" | "choice" | "complete";

export type LexusSession = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  tokenType: string;
};

type Pkce = {
  verifier: string;
  challenge: string;
};

type Clock = () => number;

export class LexusAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LexusAuthError";
  }
}

function formBody(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

async function readJson(response: Response): Promise<unknown> {
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
    const message =
      (typeof record?.message === "string" && record.message) ||
      (typeof record?.error_description === "string" && record.error_description) ||
      (typeof record?.error === "string" && record.error) ||
      `Lexus authentication failed (${response.status})`;
    throw new LexusAuthError(message, "http_error", response.status);
  }
  return value;
}

function parseAuthenticationNode(value: unknown): AuthenticationNode {
  if (!value || typeof value !== "object") {
    throw new LexusAuthError("Lexus returned an invalid authentication step", "invalid_response");
  }
  const node = value as AuthenticationNode;
  if (!node.tokenId && (!node.authId || !Array.isArray(node.callbacks))) {
    throw new LexusAuthError(
      node.message ?? "Lexus returned an incomplete authentication step",
      "invalid_response",
    );
  }
  return node;
}

function authenticationHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-API-Version": "resource=2.0, protocol=1.0",
    "Accept-Language": "en-US",
    "Content-Type": "application/json",
  };
}

export async function startAuthentication(
  request: RequestLike = globalThis.fetch,
): Promise<AuthenticationNode> {
  const response = await request(AUTHENTICATE_URL, {
    method: "POST",
    headers: authenticationHeaders(),
    body: "{}",
  });
  return parseAuthenticationNode(await readJson(response));
}

/**
 * A node that classifies as `choice` but offers no choices is a dead end: the
 * tree stopped (an unknown account's "User Not Found" message node is the
 * known case) without a token, a field to answer, or methods to pick from.
 * Rendering it would be a screen with a title and nothing to do, so the flow
 * reads it as a rejection instead and stays where the user can act.
 */
export function isDeadEndChoiceNode(node: AuthenticationNode): boolean {
  if (node.tokenId || classifyAuthenticationNode(node) !== "choice") {
    return false;
  }
  const choices = (node.callbacks ?? [])
    .flatMap((callback) => callback.output ?? [])
    .find((output) => output.name === "choices")?.value;
  return !Array.isArray(choices) || choices.length === 0;
}

export function classifyAuthenticationNode(node: AuthenticationNode): AuthenticationStep {
  if (node.tokenId) {
    return "complete";
  }
  const types = new Set(node.callbacks?.map((callback) => callback.type));
  if (types.has("NameCallback")) {
    return "username";
  }
  const promptText = (node.callbacks ?? [])
    .flatMap((callback) => callback.output ?? [])
    .filter((output) => output.name === "prompt" || output.name === "message")
    .map((output) => (typeof output.value === "string" ? output.value : ""))
    .join(" ")
    .toLowerCase();
  if (/(?:\botp\b|one[ -]?time password|verification code)/i.test(promptText)) {
    return "otp";
  }
  if (types.has("PasswordCallback")) {
    return "password";
  }
  if (types.has("TextInputCallback")) {
    return "otp";
  }
  return "choice";
}

function answerableType(node: AuthenticationNode, step: AuthenticationStep): string {
  switch (step) {
    case "username":
      return "NameCallback";
    case "password":
      return "PasswordCallback";
    case "otp":
      return node.callbacks?.some((callback) => callback.type === "TextInputCallback")
        ? "TextInputCallback"
        : "PasswordCallback";
    case "choice":
      return "ChoiceCallback";
    case "complete":
      throw new LexusAuthError("Authentication is already complete", "invalid_step");
  }
}

function unanswerableStepMessage(step: AuthenticationStep): string {
  switch (step) {
    case "otp":
      return "Lexus could not verify this code. Request a new code and try again.";
    case "password":
      return "We couldn't submit your password. Please try signing in again.";
    case "username":
      return "We couldn't submit your email. Please try signing in again.";
    case "choice":
      return "We couldn't select that verification option. Please try again.";
    case "complete":
      return "You are already signed in.";
  }
}

export function answerAuthenticationNode(
  node: AuthenticationNode,
  value: string | number,
): AuthenticationNode {
  const step = classifyAuthenticationNode(node);
  const callbackType = answerableType(node, step);
  let answered = false;
  const callbacks = node.callbacks?.map((callback) => {
    if (answered || callback.type !== callbackType || !callback.input?.length) {
      return callback;
    }
    answered = true;
    return {
      ...callback,
      input: callback.input.map((input, index) => (index === 0 ? { ...input, value } : input)),
    };
  });
  if (!answered) {
    throw new LexusAuthError(unanswerableStepMessage(step), "invalid_step");
  }
  return { ...node, callbacks };
}

export async function continueAuthentication(
  node: AuthenticationNode,
  value: string | number,
  request: RequestLike = globalThis.fetch,
): Promise<AuthenticationNode> {
  const response = await request(AUTHENTICATE_URL, {
    method: "POST",
    headers: authenticationHeaders(),
    body: JSON.stringify(answerAuthenticationNode(node, value)),
  });
  return parseAuthenticationNode(await readJson(response));
}

export async function createPkce(): Promise<Pkce> {
  const { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, randomUUID } =
    await import("expo-crypto");
  const verifier = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: CryptoEncoding.BASE64,
  });
  return {
    verifier,
    challenge: digest.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""),
  };
}

function parseTokenResponse(
  value: unknown,
  previousRefreshToken: string | undefined,
  now: Clock,
): LexusSession {
  if (!value || typeof value !== "object") {
    throw new LexusAuthError("Lexus returned an invalid token response", "invalid_response");
  }
  const token = value as Record<string, unknown>;
  const refreshToken =
    typeof token.refresh_token === "string" ? token.refresh_token : previousRefreshToken;
  if (
    typeof token.access_token !== "string" ||
    typeof token.id_token !== "string" ||
    typeof token.expires_in !== "number" ||
    !refreshToken
  ) {
    throw new LexusAuthError("Lexus returned an incomplete token response", "invalid_response");
  }
  return {
    accessToken: token.access_token,
    refreshToken,
    idToken: token.id_token,
    expiresAt: now() + token.expires_in * 1_000,
    tokenType: typeof token.token_type === "string" ? token.token_type : "Bearer",
  };
}

function authorizationCode(location: string | null): string {
  if (!location) {
    throw new LexusAuthError("Lexus did not return an authorization redirect", "missing_redirect");
  }
  const url = new URL(location);
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    throw new LexusAuthError(error, "authorization_denied");
  }
  const code = url.searchParams.get("code");
  if (!code) {
    throw new LexusAuthError("Lexus did not return an authorization code", "missing_code");
  }
  return code;
}

export async function exchangeSsoToken(
  ssoToken: string,
  request: RequestLike = globalThis.fetch,
  makePkce: () => Promise<Pkce> = createPkce,
  now: Clock = Date.now,
): Promise<LexusSession> {
  const pkce = await makePkce();
  const authorizeResponse = await request(AUTHORIZE_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "application/x-www-form-urlencoded",
      "Content-Type": "application/x-www-form-urlencoded",
      iPlanetDirectoryPro: ssoToken,
    },
    body: formBody({
      client_id: CLIENT_ID,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      csrf: ssoToken,
      decision: "allow",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
    }),
  });
  if (authorizeResponse.status < 300 || authorizeResponse.status >= 400) {
    await readJson(authorizeResponse);
    throw new LexusAuthError(
      `Lexus authorization failed (${authorizeResponse.status})`,
      "authorization_failed",
      authorizeResponse.status,
    );
  }

  const tokenResponse = await request(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: CLIENT_ID,
      code: authorizationCode(authorizeResponse.headers.get("Location")),
      code_verifier: pkce.verifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  return parseTokenResponse(await readJson(tokenResponse), undefined, now);
}

export async function refreshSession(
  refreshToken: string,
  request: RequestLike = globalThis.fetch,
  now: Clock = Date.now,
): Promise<LexusSession> {
  const response = await request(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      response_type: "token",
      scope: SCOPE,
    }),
  });
  return parseTokenResponse(await readJson(response), refreshToken, now);
}

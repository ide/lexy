import { describe, expect, it, vi } from "vitest";

import {
  answerAuthenticationNode,
  classifyAuthenticationNode,
  exchangeSsoToken,
  refreshSession,
  startAuthentication,
  type AuthenticationNode,
} from "./lexus-auth";

const usernameNode: AuthenticationNode = {
  authId: "auth-id",
  callbacks: [
    {
      type: "NameCallback",
      output: [{ name: "prompt", value: "User Name" }],
      input: [{ name: "IDToken1", value: "" }],
    },
    {
      type: "HiddenValueCallback",
      output: [{ name: "id", value: "devicePrint" }],
      input: [{ name: "IDToken2", value: "devicePrint" }],
    },
    {
      type: "ChoiceCallback",
      output: [{ name: "choices", value: ["Local", "Google", "Facebook", "Apple"] }],
      input: [{ name: "IDToken3", value: 0 }],
    },
  ],
};

describe("ForgeRock authentication tree", () => {
  it("starts the Lexus sign-in tree with the required locale", async () => {
    const request = vi.fn(async (_input: string, _init?: RequestInit) =>
      Response.json(usernameNode),
    );

    await expect(startAuthentication(request)).resolves.toEqual(usernameNode);

    const [url, init] = request.mock.calls[0];
    expect(url).toContain("authIndexValue=signin_2.0");
    expect(url).toContain("locale=en-US");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Accept-API-Version": "resource=2.0, protocol=1.0",
        "Accept-Language": "en-US",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  });

  it("classifies username, password, SMS code, and completion nodes", () => {
    expect(classifyAuthenticationNode(usernameNode)).toBe("username");
    expect(
      classifyAuthenticationNode({
        authId: "password",
        callbacks: [
          {
            type: "PasswordCallback",
            output: [{ name: "prompt", value: "Password" }],
            input: [{ name: "IDToken1", value: "" }],
          },
        ],
      }),
    ).toBe("password");
    expect(
      classifyAuthenticationNode({
        authId: "otp",
        callbacks: [
          {
            type: "TextInputCallback",
            output: [{ name: "prompt", value: "Enter verification code" }],
            input: [{ name: "IDToken1", value: "" }],
          },
        ],
      }),
    ).toBe("otp");
    expect(
      classifyAuthenticationNode({
        authId: "otp-as-password",
        callbacks: [
          {
            type: "PasswordCallback",
            output: [{ name: "prompt", value: "One Time Password" }],
            input: [{ name: "IDToken1", value: "" }],
          },
        ],
      }),
    ).toBe("otp");
    expect(classifyAuthenticationNode({ tokenId: "sso-token" })).toBe("complete");
  });

  it("answers the active callback without discarding hidden and default values", () => {
    expect(answerAuthenticationNode(usernameNode, "driver@example.com")).toEqual({
      ...usernameNode,
      callbacks: [
        {
          ...usernameNode.callbacks![0],
          input: [{ name: "IDToken1", value: "driver@example.com" }],
        },
        usernameNode.callbacks![1],
        usernameNode.callbacks![2],
      ],
    });
  });

  it("answers a Lexus OTP delivered through a password callback", () => {
    const node: AuthenticationNode = {
      authId: "otp",
      callbacks: [
        {
          type: "PasswordCallback",
          output: [{ name: "prompt", value: "One Time Password" }],
          input: [{ name: "IDToken1", value: "" }],
        },
      ],
    };

    expect(answerAuthenticationNode(node, "123456").callbacks?.[0]?.input?.[0]?.value).toBe(
      "123456",
    );
  });
});

describe("OAuth token lifecycle", () => {
  it("exchanges the SSO token through PKCE without opening the registered callback", async () => {
    const request = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "com.toyota.oneapp:/oauth2Callback?code=authorization-code" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          id_token: "id",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      );

    await expect(
      exchangeSsoToken(
        "sso-token",
        request,
        async () => ({ verifier: "verifier", challenge: "challenge" }),
        () => 1_000,
      ),
    ).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      idToken: "id",
      expiresAt: 3_601_000,
      tokenType: "Bearer",
    });

    const [authorizeUrl, authorizeInit] = request.mock.calls[0];
    expect(authorizeUrl).toContain("/authorize");
    expect(authorizeInit).toMatchObject({
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        iPlanetDirectoryPro: "sso-token",
      },
    });
    expect(authorizeInit!.body).toContain("code_challenge=challenge");

    const [, tokenInit] = request.mock.calls[1];
    expect(tokenInit!.body).toContain("grant_type=authorization_code");
    expect(tokenInit!.body).toContain("code_verifier=verifier");
  });

  it("preserves a refresh token when Lexus does not rotate it", async () => {
    const request = vi.fn(async (_input: string, _init?: RequestInit) =>
      Response.json({
        access_token: "new-access",
        id_token: "new-id",
        expires_in: 1800,
        token_type: "Bearer",
      }),
    );

    await expect(refreshSession("existing-refresh", request, () => 10_000)).resolves.toEqual({
      accessToken: "new-access",
      refreshToken: "existing-refresh",
      idToken: "new-id",
      expiresAt: 1_810_000,
      tokenType: "Bearer",
    });
    expect(request.mock.calls[0]![1]?.body).toContain("refresh_token=existing-refresh");
  });
});

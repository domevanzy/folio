import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  loginSchema,
  registrationSchema,
  passwordSchema,
  authDestination,
  authTokenType,
  authErrorMessage,
} from "@/lib/auth";
const { auth } = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/browser", () => ({
  browserSupabase: () => ({ auth }),
}));
import { submitAuth } from "@/lib/client/auth";
const input = {
  email: "reader@example.com",
  password: "Long-enough-test-password",
  confirmation: "Long-enough-test-password",
};
beforeEach(() => vi.resetAllMocks());
describe("password authentication validation", () => {
  it("allows existing shorter passwords at login without trimming passwords", () => {
    expect(
      loginSchema.parse({
        email: " reader@example.com ",
        password: " old pass ",
      }).password,
    ).toBe(" old pass ");
    expect(
      loginSchema.parse({ email: " reader@example.com ", password: "short" })
        .email,
    ).toBe("reader@example.com");
  });
  it("requires matching, longer passwords for registration and recovery", () => {
    expect(
      registrationSchema.safeParse({
        ...input,
        password: "short",
        confirmation: "short",
      }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ ...input, confirmation: "different" }).success,
    ).toBe(false);
    expect(registrationSchema.safeParse(input).success).toBe(true);
  });
  it("accepts only known token types and fixed local callback destinations", () => {
    expect(authTokenType("recovery")).toBe("recovery");
    expect(authTokenType("signup")).toBe("signup");
    expect(authTokenType("invite")).toBeNull();
    expect(
      authDestination(new URLSearchParams("next=https://evil.example")),
    ).toBe("/");
    expect(
      authDestination(new URLSearchParams("flow=recovery&next=//evil.example")),
    ).toBe("/auth/password");
  });
  it("distinguishes email quota from login throttling even when both return 429", () => {
    const email = authErrorMessage({
      code: "over_email_send_rate_limit",
      status: 429,
    });
    expect(email).toContain("Versandlimit");
    expect(email).toContain("vorhandenen Passwort");
    expect(email).not.toContain("einige Minuten");
    expect(
      authErrorMessage({ code: "over_request_rate_limit", status: 429 }),
    ).not.toContain("Versandlimit");
  });
  it("maps provider errors to safe user messages", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toContain(
      "oder Passwort",
    );
    expect(authErrorMessage({ status: 429 })).toContain("Zu viele");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toContain(
      "bestätige",
    );
  });
});
describe("shared authentication actions", () => {
  it("uses password sign-in without sending email or registering", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(
      (await submitAuth("login", input, "http://localhost:3000")).signedIn,
    ).toBe(true);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("does not bypass email confirmation on registration", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await submitAuth("register", input, "http://localhost:3000");
    expect(result.signedIn).toBe(false);
    expect(result.message).toContain("bestätige einmalig");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm?flow=signup",
      },
    });
  });
  it("routes recovery to the password flow and returns an account-neutral message", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await submitAuth(
      "recover",
      { ...input, password: "", confirmation: "" },
      "http://127.0.0.1:3000",
    );
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(input.email, {
      redirectTo: "http://127.0.0.1:3000/auth/confirm?flow=recovery",
    });
    expect(result.message).toContain("Falls");
    expect(result.signedIn).toBe(false);
  });
  it("rejects invalid input before calling the provider", async () => {
    await expect(
      submitAuth(
        "register",
        { ...input, confirmation: "wrong" },
        "http://localhost:3000",
      ),
    ).rejects.toThrow();
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("reports rejected sign-in without returning a session", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });
    await expect(
      submitAuth("login", input, "http://localhost:3000"),
    ).rejects.toThrow("E-Mail-Adresse oder Passwort ist nicht korrekt.");
  });
});

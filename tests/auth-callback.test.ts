import { beforeEach, describe, it, expect, vi } from "vitest";
const { auth } = vi.hoisted(() => ({
  auth: { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({ supabase: async () => ({ auth }) }));
vi.mock("@/lib/config", () => ({ configured: () => true }));
import { GET } from "@/app/auth/confirm/route";
beforeEach(() => vi.resetAllMocks());
describe("auth callback route", () => {
  it("verifies a signup token and redirects to the dashboard", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=test-token&type=signup",
      ),
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "test-token",
      type: "signup",
    });
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
  it("exchanges a PKCE code and preserves the recovery destination", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?code=test-code&flow=recovery",
      ),
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/password",
    );
  });
  it("rejects failed and unsupported tokens without reflecting them in redirects", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=test-token&type=recovery&next=https://evil.example",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?auth_error=1",
    );
    auth.verifyOtp.mockClear();
    await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=test-token&type=invite",
      ),
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

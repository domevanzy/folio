import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { configured } from "@/lib/config";
import { authDestination, authTokenType } from "@/lib/auth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = () =>
    NextResponse.redirect(new URL("/?auth_error=1", url.origin));
  if (!configured()) return failure();
  const token_hash = url.searchParams.get("token_hash");
  const type = authTokenType(url.searchParams.get("type"));
  const code = url.searchParams.get("code");
  try {
    const db = await supabase();
    if (token_hash && type) {
      const { error } = await db.auth.verifyOtp({ token_hash, type });
      if (!error)
        return NextResponse.redirect(
          new URL(authDestination(url.searchParams), url.origin),
        );
    } else if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(authDestination(url.searchParams), url.origin),
        );
    }
  } catch {
    /* Never expose auth tokens or provider messages in redirects. */
  }
  return failure();
}

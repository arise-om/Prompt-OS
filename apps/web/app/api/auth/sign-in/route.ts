import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const next = safeNext(String(form.get("next") ?? "/"));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.redirect(new URL("/login?error=invalid_email", request.url), 303);
  }

  const supabase = await createClient();
  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` }
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=sign_in_failed", request.url), 303);
  }

  return NextResponse.redirect(new URL("/login?sent=1", request.url), 303);
}

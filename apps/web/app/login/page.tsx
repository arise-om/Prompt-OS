import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const errorMessages: Record<string, string> = {
  not_configured: "Authentication is not configured in this environment yet. Set the Supabase environment variables first.",
  confirmation_failed: "The sign-in link could not be verified. Request a new link and try again.",
  invalid_email: "Enter a valid email address."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/");

  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] ?? "Sign-in failed. Try again." : null;

  return (
    <main className="shell shell--narrow auth-shell">
      <Link href="/" className="back-link">← Prompt OS</Link>
      <section className="auth-card">
        <div className="eyebrow">Account</div>
        <h1>Sign in</h1>
        <p>Use a magic link to enter Prompt OS. No password is required.</p>
        {params.sent ? <div className="notice"><strong>Check your inbox</strong><span>Your sign-in link has been sent.</span></div> : null}
        {error ? <div className="notice notice--error"><strong>Couldn’t sign you in</strong><span>{error}</span></div> : null}
        <form className="builder-form" action="/api/auth/sign-in" method="post">
          <label>
            <span>Email</span>
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          </label>
          <input type="hidden" name="next" value="/" />
          <button className="button button--primary" type="submit">Send magic link</button>
        </form>
      </section>
    </main>
  );
}

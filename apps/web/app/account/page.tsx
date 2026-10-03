import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <main className="shell shell--narrow">
      <Link href="/" className="back-link">← Prompt OS</Link>
      <div className="eyebrow">Account</div>
      <h1>Your workspace</h1>
      <p>Signed in as <strong>{String(data.claims.email ?? "authenticated user")}</strong>.</p>
      <div className="button-row">
        <Link href="/library" className="button button--primary">Prompt Library</Link>
        <Link href="/builder" className="button">Prompt Builder</Link>
        <form action="/api/auth/sign-out" method="post"><button className="button" type="submit">Sign out</button></form>
      </div>
    </main>
  );
}

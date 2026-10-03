import Link from "next/link";
import { PromptCard } from "../../components/prompt-card";
import { getSystemPrompts } from "../../lib/prompt-repository";
import { getCurrentUserPrompts } from "../../lib/user-prompt-repository";
import { hasSupabaseConfig } from "../../lib/supabase/config";

export const metadata = {
  title: "Prompt Library · Prompt OS",
  description: "Browse validated Prompt OS system templates."
};

export default async function LibraryPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; domain?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const domain = params.domain?.trim() ?? "";
  const allPrompts = await getSystemPrompts(query);
  const userPrompts = hasSupabaseConfig() ? await getCurrentUserPrompts() : [];
  const prompts = allPrompts.filter((prompt) => !domain || prompt.domain === domain);
  const domains = [...new Set(allPrompts.map((prompt) => prompt.domain))].sort();

  return (
    <main className="shell">
      {params.status === "saved" ? <div className="notice"><strong>Prompt saved.</strong><span>Your cloned draft is now in My prompts.</span></div> : null}
      <header className="page-header">
        <div>
          <Link href="/" className="back-link">← Prompt OS</Link>
          <div className="eyebrow">Library</div>
          <h1>Prompt Library</h1>
          <p>Start from validated system templates, inspect how they are structured, and clone one into the builder.</p>
        </div>
        <span className="status-pill">{allPrompts.length} system templates</span>
      </header>

      <form className="filters" action="/library">
        <label>
          <span className="sr-only">Search prompts</span>
          <input name="q" defaultValue={query} placeholder="Search prompts, domains, tags…" />
        </label>
        <label>
          <span className="sr-only">Filter by domain</span>
          <select name="domain" defaultValue={domain}>
            <option value="">All domains</option>
            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="submit" className="button button--primary">Search</button>
        {(query || domain) && <Link href="/library" className="button">Clear</Link>}
      </form>

      {userPrompts.length ? (
        <section className="library-section">
          <div className="section-heading"><div><div className="eyebrow">Your library</div><h2>My prompts</h2></div><span className="muted">{userPrompts.length} saved</span></div>
          <section className="prompt-grid" aria-label="My prompts">
            {userPrompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
          </section>
        </section>
      ) : null}

      {prompts.length ? (
        <section className="prompt-grid" aria-label="Prompt templates">
          {prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
        </section>
      ) : (
        <div className="empty-state">
          <strong>No templates match that search.</strong>
          <span>Try a broader keyword or clear the filters.</span>
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PromptComposer } from "../../components/prompt-composer";
import { savePromptDraft } from "./actions";
import { getSystemPromptById } from "../../lib/prompt-repository";
import { getCurrentUserPromptById } from "../../lib/user-prompt-repository";
import { nextMinorVersion, parsePromptDraft } from "@prompt-os/prompt-core";

export default async function BuilderPage({
  searchParams
}: {
  searchParams: Promise<{ template?: string; id?: string; error?: string }>
}) {
  const { template, id, error } = await searchParams;
  const editing = id ? await getCurrentUserPromptById(id) : null;
  if (id && !editing) notFound();
  const source = editing ?? (template ? await getSystemPromptById(template) : null);
  const isEditing = Boolean(editing);
  const parsed = editing ? parsePromptDraft(editing.body) : null;
  const initial = source ? {
    instructions: parsed ? parsed.instructions : source.body,
    goal: parsed?.goal || `Create a ${source.intent} result for the user's task.`,
    context: parsed?.context || source.requiredContext.join("\n"),
    inputs: parsed?.inputs || source.variables.map((item) => `{{${item}}}`).join("\n"),
    constraints: parsed?.constraints || source.constraints.join("\n"),
    audience: parsed?.audience || "",
    output: parsed?.output || source.expectedOutput,
    quality: parsed?.quality || source.evaluationCriteria.join("\n"),
    verification: parsed?.verification || "",
    variables: source.variables.join("\n")
  } : undefined;

  return (
    <main className="shell">
      <Link href={source ? `/library/${source.id}` : "/library"} className="back-link">← {source ? (isEditing ? "Back to prompt" : "Back to template") : "Back to library"}</Link>
      <header className="detail-header">
        <div className="eyebrow">Builder</div>
        <h1>{isEditing ? "Edit prompt" : source ? "Clone & refine" : "Prompt Builder"}</h1>
        <p>{isEditing ? `Create a new version of ${source?.name}; previous versions remain unchanged.` : source ? `Refine ${source.name} without modifying the system template.` : "Build a prompt from outcome, context, constraints and verification criteria."}</p>
      </header>

      {error ? <div className="notice notice--error"><strong>Couldn’t save this draft.</strong><span>Check the required fields and authentication, then try again.</span></div> : null}

      <form className="builder-form" action={savePromptDraft}>
        {isEditing && <input type="hidden" name="prompt_id" value={source?.id} />}
        {source && !isEditing && <input type="hidden" name="template_id" value={source.id} />}
        {source && <div className="clone-banner"><strong>{isEditing ? "New version" : "Draft clone"}</strong><span>{isEditing ? `Current: v${source.version} · Next: v${nextMinorVersion(source.version)}` : `Source: ${source.name} · v${source.version}`}</span></div>}

        <section className="panel">
          <div className="panel__heading">Prompt metadata</div>
          <div className="metadata-grid">
            <label>
              <span>Prompt name</span>
              <input name="name" required defaultValue={source ? (isEditing ? source.name : `${source.name} — My Draft`) : ""} placeholder="e.g. Robotics Project Reviewer" />
            </label>
            <label>
              <span>Description</span>
              <input name="description" defaultValue={source?.description ?? ""} placeholder="What is this prompt for?" />
            </label>
          </div>
        </section>

        {source ? (
          <PromptComposer initial={initial} />
        ) : (
          <section className="empty-state">
            <strong>Choose a system template first.</strong>
            <span>Standalone prompt creation comes after the personal composer loop is versioned.</span>
            <Link href="/library" className="button button--primary">Browse templates</Link>
          </section>
        )}

        <div className="button-row">
          <button className="button button--primary" type="submit" disabled={!source}>{isEditing ? "Save new version" : "Save as my prompt"}</button>
          <Link href="/library" className="button">Browse templates</Link>
        </div>
        {!source ? <p className="muted">Choose a system template to start a prompt draft.</p> : <p className="muted">The server reconstructs the final prompt from structured fields before saving. Existing versions are not overwritten.</p>}
      </form>
    </main>
  );
}

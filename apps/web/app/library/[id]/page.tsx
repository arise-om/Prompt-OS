import Link from "next/link";
import { notFound } from "next/navigation";
import { comparePromptVersions } from "@prompt-os/prompt-core";
import { getSystemPromptById } from "../../../lib/prompt-repository";
import {
  getCurrentUserPromptById,
  getCurrentUserPromptVersionComparison,
  getCurrentUserPromptVersions,
} from "../../../lib/user-prompt-repository";

export default async function PromptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string; compareFrom?: string; compareTo?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const systemPrompt = await getSystemPromptById(id);
  const prompt = systemPrompt ?? await getCurrentUserPromptById(id);
  if (!prompt) notFound();

  const isSystem = prompt.isSystem;
  const versions = isSystem ? [] : await getCurrentUserPromptVersions(prompt.id);
  const comparison = !isSystem && query.compareFrom && query.compareTo
    ? await getCurrentUserPromptVersionComparison(prompt.id, query.compareFrom, query.compareTo)
    : null;
  const diff = comparison ? comparePromptVersions(comparison.from.body, comparison.to.body) : null;

  return (
    <main className="shell shell--narrow">
      <Link href="/library" className="back-link">← Back to library</Link>
      {query.version === "saved" ? <div className="notice"><strong>New version saved.</strong><span>Your previous versions remain in the history below.</span></div> : null}
      <header className="detail-header">
        <div className="tag-row">
          <span className="chip">{prompt.domain}</span>
          <span className="chip">{prompt.intent}</span>
          <span className="chip">L{prompt.complexity}</span>
          <span className="chip">v{prompt.version}</span>
          <span className="chip">{isSystem ? "system" : `my prompt · ${prompt.status}`}</span>
        </div>
        <h1>{prompt.name}</h1>
        <p>{prompt.description}</p>
      </header>

      <section className="detail-grid">
        <div className="panel panel--wide">
          <div className="panel__heading"><span>Prompt body</span><span className="muted">{isSystem ? "system · read-only" : "owned by you"}</span></div>
          <pre className="prompt-code"><code>{prompt.body}</code></pre>
        </div>
        <aside className="panel">
          <div className="panel__heading">Specification</div>
          <dl className="spec-list">
            <div><dt>Variables</dt><dd>{prompt.variables.length ? prompt.variables.map((item) => `{{${item}}}`).join(", ") : "None"}</dd></div>
            <div><dt>Required context</dt><dd>{prompt.requiredContext.length ? prompt.requiredContext.join(", ") : "None"}</dd></div>
            <div><dt>Optional context</dt><dd>{prompt.optionalContext.length ? prompt.optionalContext.join(", ") : "None"}</dd></div>
            <div><dt>Expected output</dt><dd>{prompt.expectedOutput}</dd></div>
          </dl>
        </aside>
      </section>

      {!isSystem && prompt.promptAudit ? (
        <section className="panel prompt-audit-summary">
          <div className="panel__heading"><span>Saved Prompt Auditor</span><span className="chip">{prompt.promptAudit.score}/100</span></div>
          <div className="audit-summary__stats">
            <span>{prompt.promptAudit.findings.filter((finding) => finding.severity === "critical").length} critical</span>
            <span>{prompt.promptAudit.findings.filter((finding) => finding.severity === "warning").length} warnings</span>
            <span>{prompt.promptAudit.missingSections.length} missing sections</span>
          </div>
          {prompt.promptAudit.findings.length ? (
            <ul className="clean-list audit-summary__findings">
              {prompt.promptAudit.findings.map((finding) => (
                <li key={finding.code}><strong>{finding.code.replaceAll("_", " ")}</strong><span>{finding.message}</span></li>
              ))}
            </ul>
          ) : <p className="muted">No audit findings were recorded for the current saved version.</p>}
        </section>
      ) : null}

      {!isSystem ? (
        <>
          <section className="panel version-history">
            <div className="panel__heading"><span>Version history</span><span className="muted">{versions.length} saved version{versions.length === 1 ? "" : "s"}</span></div>
            {versions.length ? (
              <ol className="clean-list">
                {versions.map((version, index) => (
                  <li key={version.id} className="version-history__item">
                    <div className="version-history__meta">
                      <strong>v{version.version}</strong>
                      {index === 0 ? <span className="chip">Current</span> : null}
                      {version.auditScore !== null ? <span className="chip">Audit {version.auditScore}/100</span> : null}
                      <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
                    </div>
                    <p>{version.changeSummary}</p>
                    {version.auditFindingCount ? <span className="muted">{version.auditFindingCount} audit finding{version.auditFindingCount === 1 ? "" : "s"} saved with this version.</span> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="muted">No version history is available yet.</p>}
          </section>

          {versions.length > 1 ? (
            <section className="panel version-compare">
              <div className="panel__heading"><span>Compare versions</span><span className="muted">Review what changed between any two saved versions.</span></div>
              <form className="version-compare__form" method="get">
                <input type="hidden" name="id" value={prompt.id} />
                <label>
                  From version
                  <select name="compareFrom" defaultValue={query.compareFrom ?? versions[1].id}>
                    {versions.map((version) => <option key={version.id} value={version.id}>v{version.version}</option>)}
                  </select>
                </label>
                <label>
                  To version
                  <select name="compareTo" defaultValue={query.compareTo ?? versions[0].id}>
                    {versions.map((version) => <option key={version.id} value={version.id}>v{version.version}</option>)}
                  </select>
                </label>
                <button type="submit" className="button button--primary">Compare</button>
              </form>

              {comparison && diff ? (
                <div className="version-diff">
                  <div className="version-diff__summary" aria-live="polite">
                    <span>v{comparison.from.version} → v{comparison.to.version}</span>
                    <span className="muted">{diff.added} added · {diff.removed} removed · {diff.unchanged} unchanged</span>
                  </div>
                  <div className="version-diff__legend"><span><strong>−</strong> removed</span><span><strong>+</strong> added</span><span><strong> </strong> unchanged</span></div>
                  {diff.lines.length ? (
                    <div className="version-diff__code" role="region" aria-label={`Diff from version ${comparison.from.version} to version ${comparison.to.version}`}>
                      {diff.lines.map((line, index) => (
                        <div key={`${line.type}-${index}`} className={`version-diff__line version-diff__line--${line.type}`}>
                          <span className="version-diff__number">{line.type === "added" ? "" : line.oldLine}</span>
                          <span className="version-diff__number">{line.type === "removed" ? "" : line.newLine}</span>
                          <span className="version-diff__marker">{line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}</span>
                          <code>{line.text || " "}</code>
                        </div>
                      ))}
                    </div>
                  ) : <p className="muted">These versions contain no body differences.</p>}
                </div>
              ) : <p className="muted version-compare__empty">Choose two different versions to review their changes.</p>}
            </section>
          ) : null}
        </>
      ) : null}

      <section className="panel">
        <div className="panel__heading">Constraints & evaluation</div>
        <div className="detail-columns">
          <div>
            <h2>Constraints</h2>
            <ul className="clean-list">{prompt.constraints.length ? prompt.constraints.map((item) => <li key={item}>{item}</li>) : <li>None recorded.</li>}</ul>
          </div>
          <div>
            <h2>Evaluation criteria</h2>
            <ul className="clean-list">{prompt.evaluationCriteria.length ? prompt.evaluationCriteria.map((item) => <li key={item}>{item}</li>) : <li>None recorded.</li>}</ul>
          </div>
        </div>
      </section>

      <div className="action-bar">
        {isSystem ? (
          <Link href={`/builder?template=${prompt.id}`} className="button button--primary">Clone into Builder</Link>
        ) : (
          <Link href={`/builder?id=${prompt.id}`} className="button button--primary">Edit / create version</Link>
        )}
        <span className="muted">{isSystem ? "Cloning does not modify the system template." : "Each save creates a new immutable version."}</span>
      </div>
    </main>
  );
}

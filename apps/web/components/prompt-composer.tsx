"use client";

import { useMemo, useState } from "react";
import { auditPrompt, composePromptDraft, type PromptComposerDraft } from "@prompt-os/prompt-core";

type PromptComposerProps = {
  initial?: PromptComposerDraft & { variables?: string };
  disabled?: boolean;
};

const fields: Array<{ key: keyof PromptComposerDraft; label: string; placeholder: string; rows?: number }> = [
  { key: "instructions", label: "Base instructions", placeholder: "Preserve useful task-specific instructions or write the core behavior here…", rows: 7 },
  { key: "goal", label: "Goal", placeholder: "What concrete outcome should the model produce?", rows: 4 },
  { key: "context", label: "Context", placeholder: "What facts, documents, environment, or background should the model use?", rows: 5 },
  { key: "inputs", label: "Inputs", placeholder: "List the inputs, files, data, or user-provided values…", rows: 4 },
  { key: "constraints", label: "Constraints", placeholder: "Evidence rules, scope, limits, prohibited behavior, length…", rows: 5 },
  { key: "audience", label: "Audience", placeholder: "Who will consume or act on the output?", rows: 3 },
  { key: "output", label: "Output", placeholder: "What format and level of detail should the result use?", rows: 4 },
  { key: "quality", label: "Quality criteria", placeholder: "How should a good answer be judged?", rows: 4 },
  { key: "verification", label: "Verification", placeholder: "How should claims, calculations, constraints, or completeness be checked?", rows: 5 }
];

function normalizeInitial(initial?: PromptComposerProps["initial"]): PromptComposerDraft & { variables: string } {
  return {
    instructions: initial?.instructions ?? "",
    goal: initial?.goal ?? "",
    context: initial?.context ?? "",
    inputs: initial?.inputs ?? "",
    constraints: initial?.constraints ?? "",
    audience: initial?.audience ?? "",
    output: initial?.output ?? "",
    quality: initial?.quality ?? "",
    verification: initial?.verification ?? "",
    variables: initial?.variables ?? ""
  };
}

export function PromptComposer({ initial, disabled }: PromptComposerProps) {
  const [draft, setDraft] = useState(() => normalizeInitial(initial));
  const parsedVariables = useMemo(
    () => draft.variables.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
    [draft.variables],
  );
  const composedPrompt = useMemo(
    () => composePromptDraft(draft),
    [draft],
  );
  const audit = useMemo(
    () => auditPrompt({ ...draft, variables: parsedVariables, body: composedPrompt }),
    [draft, parsedVariables, composedPrompt],
  );

  const update = (key: keyof PromptComposerDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <div className="composer-fields">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <textarea
              name={field.key}
              required={field.key === "goal"}
              disabled={disabled}
              rows={field.rows ?? 4}
              value={draft[field.key] ?? ""}
              onChange={(event) => update(field.key, event.target.value)}
              placeholder={field.placeholder}
            />
          </label>
        ))}
        <label>
          <span>Variables</span>
          <input
            name="variables"
            disabled={disabled}
            value={draft.variables}
            onChange={(event) => setDraft((current) => ({ ...current, variables: event.target.value }))}
            placeholder="project, constraints, audience"
          />
          <small className="field-help">Use comma- or line-separated names. Reference them in the prompt as <code>{"{{variable}}"}</code>.</small>
        </label>
      </div>

      <section className="composer-preview-grid">
        <div className="panel composer-preview">
          <div className="panel__heading"><span>Optimized prompt preview</span><span className="muted">assembled locally</span></div>
          <pre className="prompt-code"><code>{composedPrompt || "Start filling the structure to build the executable prompt."}</code></pre>
        </div>

        <aside className="panel audit-panel">
          <div className="panel__heading"><span>Prompt audit</span><span className="muted">deterministic</span></div>
          <div className="audit-score">
            <strong>{audit.score}</strong>
            <span>/ 100</span>
          </div>
          <p className="audit-summary">{audit.findings.length ? `${audit.findings.length} finding${audit.findings.length === 1 ? "" : "s"} to review.` : "No structural findings."}</p>
          {audit.findings.length ? (
            <div className="audit-findings">
              {audit.findings.map((finding, index) => (
                <article className={`audit-finding audit-finding--${finding.severity}`} key={`${finding.code}-${index}`}>
                  <div className="audit-finding__topline"><strong>{finding.code.replaceAll("_", " ")}</strong><span>{finding.severity}</span></div>
                  <p>{finding.message}</p>
                  <small>{finding.remediation}</small>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}

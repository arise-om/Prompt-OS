import Link from "next/link";
import type { PromptDefinition } from "@prompt-os/shared-types";

function complexityLabel(value: PromptDefinition["complexity"]): string {
  return ["", "Simple", "Structured", "Multi-step", "Advanced", "System"] [value] ?? "Advanced";
}

export function PromptCard({ prompt }: { prompt: PromptDefinition }) {
  return (
    <article className="prompt-card">
      <div className="prompt-card__topline">
        <span className="chip">{prompt.domain}</span>
        <span className="muted">L{prompt.complexity} · {complexityLabel(prompt.complexity)}</span>
      </div>
      <h2>{prompt.name}</h2>
      <p>{prompt.description}</p>
      <div className="tag-row">
        {prompt.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
      </div>
      <div className="prompt-card__footer">
        <span className="muted">v{prompt.version}</span>
        <Link className="text-link" href={`/library/${prompt.id}`}>Open template →</Link>
      </div>
    </article>
  );
}

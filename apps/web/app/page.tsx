import Link from "next/link";

const pillars = [
  ["Prompt Library", "Validated prompts, components, examples and failure history."],
  ["Workflow Engine", "Multi-step execution patterns such as research, build, review and verify."],
  ["Evaluation Lab", "Benchmarks, rubrics and regression checks for AI output quality."],
  ["Context Engine", "Reusable project, domain and task context packs."],
  ["Domain Packs", "Specialized guidance for coding, research, robotics, writing, study and more."],
  ["Tool Router", "A capability-aware layer that selects the right ChatGPT/tool workflow."]
];

export default function HomePage() {
  return (
    <main className="shell home">
      <header className="hero">
        <div className="eyebrow">Prompt OS · Foundation Sprint 02</div>
        <h1>Turn AI prompts into repeatable systems.</h1>
        <p>Prompt OS is the control plane for prompts, context, workflows, evaluations, domain packs and AI execution. Start with the library, then compose and test your own workflows.</p>
        <div className="button-row">
          <Link href="/library" className="button button--primary">Open Prompt Library</Link>
          <Link href="/evaluations" className="button">Open Evaluation Lab</Link>
          <Link href="/workflows" className="button">Open Workflow Engine</Link>
          <Link href="/builder" className="button">Open Builder</Link>
        </div>
      </header>
      <section className="prompt-grid" aria-label="Prompt OS pillars">
        {pillars.map(([title, body]) => (
          <article className="prompt-card" key={title}>
            <div className="chip">CORE</div>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

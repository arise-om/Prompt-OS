import Link from "next/link";
import { compareEvaluationRuns } from "@prompt-os/evaluation-core";
import { getSystemPrompts } from "../../lib/prompt-repository";
import { getCurrentUserPrompts } from "../../lib/user-prompt-repository";
import { getSystemBenchmarkCases } from "../../lib/evaluation-catalog-repository";
import {
  getAccessiblePromptVersions,
  getEvaluationRunsForPrompt,
  getEvaluationRunsForPromptVersion,
} from "../../lib/evaluation-lab-repository";
import { runEvaluation, runEvaluationSuite } from "./actions";

export const metadata = {
  title: "Evaluation Lab · Prompt OS",
  description: "Run benchmark cases and compare output quality across prompt versions.",
};

export default async function EvaluationLabPage({
  searchParams,
}: {
  searchParams: Promise<{
    promptId?: string;
    promptVersionId?: string;
    benchmarkCaseId?: string;
    status?: string;
    failed?: string;
  }>;
}) {
  const params = await searchParams;
  const [systemPrompts, userPrompts, benchmarks] = await Promise.all([
    getSystemPrompts(),
    getCurrentUserPrompts(),
    getSystemBenchmarkCases(),
  ]);
  const prompts = [...systemPrompts, ...userPrompts];
  const selectedPrompt = prompts.find((prompt) => prompt.id === params.promptId) ?? prompts[0];
  const versions = selectedPrompt ? await getAccessiblePromptVersions(selectedPrompt.id) : [];
  const selectedVersion = versions.find((version) => version.id === params.promptVersionId) ?? versions[0];
  const selectedBenchmark = benchmarks.find((benchmark) => benchmark.id === params.benchmarkCaseId) ?? benchmarks[0];
  const runs = selectedPrompt && selectedBenchmark
    ? await getEvaluationRunsForPrompt(selectedPrompt.id, selectedBenchmark.id)
    : [];
  const versionRuns = selectedVersion
    ? await getEvaluationRunsForPromptVersion(selectedVersion.id)
    : [];

  const runByVersion = new Map<string, typeof runs[number]>();
  for (const run of runs) {
    if (run.promptVersionId && !runByVersion.has(run.promptVersionId)) runByVersion.set(run.promptVersionId, run);
  }
  const currentRun = selectedVersion ? runByVersion.get(selectedVersion.id) : undefined;
  const previousVersion = selectedVersion
    ? versions[versions.findIndex((version) => version.id === selectedVersion.id) + 1]
    : undefined;
  const previousRun = previousVersion ? runByVersion.get(previousVersion.id) : undefined;
  const comparison = currentRun && previousRun ? compareEvaluationRuns(previousRun, currentRun) : null;

  const latestRunByBenchmark = new Map<string, typeof versionRuns[number]>();
  for (const run of versionRuns) {
    if (run.benchmarkCaseId && !latestRunByBenchmark.has(run.benchmarkCaseId)) {
      latestRunByBenchmark.set(run.benchmarkCaseId, run);
    }
  }
  const suiteScores = [...latestRunByBenchmark.values()]
    .map((run) => run.scores.overall)
    .filter((score): score is number => typeof score === "number");
  const suiteAverage = suiteScores.length
    ? Number((suiteScores.reduce((sum, score) => sum + score, 0) / suiteScores.length).toFixed(2))
    : null;

  return (
    <main className="shell shell--narrow">
      <Link href="/" className="back-link">← Prompt OS</Link>
      <header className="page-header">
        <div>
          <div className="eyebrow">Evaluation Lab</div>
          <h1>Benchmark the prompt, not the vibe.</h1>
          <p>Select an immutable prompt version, execute a benchmark case with a real model, score it against the live rubric, and compare against the previous version.</p>
        </div>
        <span className="status-pill">{benchmarks.length} benchmarks</span>
      </header>

      {params.status === "completed" ? <div className="notice"><strong>Evaluation saved.</strong><span>The benchmark result and prompt-audit provenance were persisted.</span></div> : null}
      {params.status === "suite_completed" ? <div className="notice"><strong>Suite completed.</strong><span>Every benchmark produced a persisted result for this prompt version.</span></div> : null}
      {params.status === "suite_partial" ? <div className="notice"><strong>Suite partially completed.</strong><span>Completed benchmark results were saved; {formatFailedCount(params.failed)} benchmark case{formatFailedCount(params.failed) === 1 ? "" : "s"} reported failure.</span></div> : null}
      {params.status === "model_failed" ? <div className="notice"><strong>Model execution failed.</strong><span>Check OPENAI_API_KEY, model access, quota, or provider response.</span></div> : null}
      {params.status === "not_configured" ? <div className="notice"><strong>Supabase is not configured.</strong><span>The Evaluation Lab requires authenticated server access.</span></div> : null}

      {!prompts.length || !benchmarks.length ? (
        <div className="empty-state"><strong>The Evaluation Lab needs a prompt and a benchmark.</strong><span>Seed the Prompt OS catalog before running evaluations.</span></div>
      ) : (
        <>
          <section className="panel evaluation-lab__selector">
            <div className="panel__heading"><span>Run a benchmark</span><span className="muted">Execution and scoring happen server-side.</span></div>
            <form action={runEvaluation} className="evaluation-lab__form">
              <label>
                Prompt
                <select name="promptId" defaultValue={selectedPrompt?.id}>
                  {prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name} · {prompt.isSystem ? "system" : "mine"}</option>)}
                </select>
              </label>
              <label>
                Version
                <select name="promptVersionId" defaultValue={selectedVersion?.id}>
                  {versions.map((version) => <option key={version.id} value={version.id}>v{version.version}</option>)}
                </select>
              </label>
              <label>
                Benchmark
                <select name="benchmarkCaseId" defaultValue={selectedBenchmark?.id}>
                  {benchmarks.map((benchmark) => <option key={benchmark.id} value={benchmark.id}>{benchmark.name}</option>)}
                </select>
              </label>
              <button className="button button--primary" type="submit">Run evaluation</button>
            </form>
            <form action={runEvaluationSuite} className="evaluation-suite__form">
              <input type="hidden" name="promptId" value={selectedPrompt?.id ?? ""} />
              <input type="hidden" name="promptVersionId" value={selectedVersion?.id ?? ""} />
              <div>
                <strong>Full benchmark suite</strong>
                <span className="muted">Run all {benchmarks.length} live benchmarks against this immutable version.</span>
              </div>
              <button className="button" type="submit">Run full suite</button>
            </form>
          </section>

          {selectedVersion ? (
            <section className="panel">
              <div className="panel__heading"><span>Suite result</span><span className="muted">Latest saved run per benchmark for v{selectedVersion.version}</span></div>
              <div className="audit-summary__stats evaluation-suite__stats">
                <span>{latestRunByBenchmark.size}/{benchmarks.length} benchmarks evaluated</span>
                <span>{suiteAverage === null ? "—" : `${suiteAverage}/100 average`}</span>
                <span>{versionRuns.length} saved runs</span>
              </div>
              {latestRunByBenchmark.size ? (
                <div className="evaluation-regression__details">
                  {[...latestRunByBenchmark.values()].map((run) => {
                    const benchmark = benchmarks.find((item) => item.id === run.benchmarkCaseId);
                    return <div key={run.id}><strong>{benchmark?.name ?? run.benchmarkCaseId ?? "Benchmark"}</strong><span>{formatOverall(run.scores.overall)}</span></div>;
                  })}
                </div>
              ) : <p className="muted">No suite results are saved for this version yet.</p>}
            </section>
          ) : null}

          {selectedVersion && selectedBenchmark ? (
            <section className="evaluation-lab__grid">
              <article className="panel">
                <div className="panel__heading"><span>Selected run</span><span className="chip">v{selectedVersion.version}</span></div>
                <dl className="spec-list">
                  <div><dt>Prompt</dt><dd>{selectedVersion.promptName}</dd></div>
                  <div><dt>Benchmark</dt><dd>{selectedBenchmark.name}</dd></div>
                  <div><dt>Category</dt><dd>{selectedBenchmark.category}</dd></div>
                  <div><dt>Audit</dt><dd>{selectedVersion.auditScore === null ? "No saved audit" : `${selectedVersion.auditScore}/100`}</dd></div>
                </dl>
              </article>

              <article className="panel">
                <div className="panel__heading"><span>Regression</span><span className="muted">Previous evaluated version</span></div>
                {comparison ? (
                  <>
                    <div className="evaluation-regression__headline">
                      <strong>{formatDelta(comparison.deltas.overall ?? 0)}</strong>
                      <span>overall score change</span>
                    </div>
                    <div className="audit-summary__stats">
                      <span>{comparison.improvements.length} improvements</span>
                      <span>{comparison.regressions.length} regressions</span>
                    </div>
                    <div className="evaluation-regression__details">
                      {Object.entries(comparison.deltas).map(([criterion, delta]) => (
                        <div key={criterion}><strong>{criterion === "overall" ? "Overall" : criterion}</strong><span>{formatDelta(delta)}</span></div>
                      ))}
                    </div>
                  </>
                ) : <p className="muted">Run both the selected version and its previous version on this benchmark to see a regression comparison.</p>}
              </article>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel__heading"><span>Evaluation history</span><span className="muted">{runs.length} run{runs.length === 1 ? "" : "s"} for this prompt + benchmark</span></div>
            {runs.length ? (
              <div className="evaluation-run-list">
                {runs.map((run) => (
                  <article className="evaluation-run" key={run.id}>
                    <div><strong>v{versions.find((version) => version.id === run.promptVersionId)?.version ?? "?"}</strong><span>{formatOverall(run.scores.overall)}</span></div>
                    <time dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString()}</time>
                    <div className="evaluation-run__scores">
                      {Object.entries(run.scores).filter(([key]) => key !== "overall").map(([criterion, score]) => <span key={criterion}>{criterion}: {score}</span>)}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="muted">No runs have been saved for this benchmark yet.</p>}
          </section>
        </>
      )}
    </main>
  );
}

function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(2))}`;
}

function formatOverall(value: number | undefined): string {
  return typeof value === "number" ? `${Number(value.toFixed(2))}/100` : "—";
}

function formatFailedCount(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

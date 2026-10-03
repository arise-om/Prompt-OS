import Link from "next/link";
import { getAccessibleWorkflowById, getAccessibleWorkflows, getWorkflowPromotionEvidence, getWorkflowPromotions, getWorkflowRuns } from "../../lib/workflow-repository";
import { evaluateWorkflowPromotion } from "@prompt-os/workflow-core";
import { cloneWorkflow, startWorkflowRun, resolveWorkflowApproval, runWorkflowEvaluation, promoteWorkflow } from "./actions";

export const metadata = {
  title: "Workflows · Prompt OS",
  description: "Execute typed AI workflows with bounded retries, approvals, and failure evidence.",
};

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ workflowId?: string; runId?: string; status?: string; failed?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const workflows = await getAccessibleWorkflows();
  const selected = await getAccessibleWorkflowById(params.workflowId ?? workflows[0]?.id ?? "");
  const runs = selected ? await getWorkflowRuns(selected.id) : [];
  const selectedRun = params.runId ? runs.find((run) => run.id === params.runId) : runs[0];
  const promotionEvidence = selected ? await getWorkflowPromotionEvidence(selected.id, selected.version) : { evaluationRunCount: 0, distinctBenchmarkCount: 0, averageScore: 0, failedRunCount: 0 };
  const promotionGate = selected ? evaluateWorkflowPromotion(selected, promotionEvidence) : null;
  const promotions = selected ? await getWorkflowPromotions(selected.id) : [];

  return (
    <main className="shell shell--narrow">
      <Link href="/" className="back-link">← Prompt OS</Link>
      <header className="page-header">
        <div>
          <div className="eyebrow">Workflow Engine</div>
          <h1>Run the process, not just the prompt.</h1>
          <p>Execute typed workflow graphs with explicit branches, bounded retries, durable approval checkpoints, and failure evidence.</p>
        </div>
        <span className="status-pill">{workflows.length} workflows</span>
      </header>

      {params.status === "running" ? <div className="notice"><strong>Workflow started.</strong><span>The execution state is being persisted and will be shown below when the run reaches a checkpoint.</span></div> : null}
      {params.status === "paused" ? <div className="notice"><strong>Approval required.</strong><span>The workflow is paused at a human approval checkpoint.</span></div> : null}
      {params.status === "completed" ? <div className="notice"><strong>Workflow completed.</strong><span>The final execution state was persisted.</span></div> : null}
      {params.status === "failed" ? <div className="notice"><strong>Workflow failed.</strong><span>Failure evidence has been persisted for inspection.</span></div> : null}
      {params.status === "persist_failed" ? <div className="notice"><strong>Run persistence failed.</strong><span>The execution could not be fully recorded.</span></div> : null}
      {params.status === "not_configured" ? <div className="notice"><strong>Supabase is not configured.</strong><span>The Workflow Engine requires authenticated server access.</span></div> : null}
      {params.status === "invalid_input" ? <div className="notice"><strong>Invalid input.</strong><span>Provide a JSON object for the workflow input.</span></div> : null}
      {params.status === "workflow_changed" ? <div className="notice"><strong>Workflow changed.</strong><span>This approval checkpoint belongs to an older workflow version. Resume it only after reviewing the current workflow definition.</span></div> : null}
      {params.status === "promoted" ? <div className="notice"><strong>Workflow promoted.</strong><span>The current validated workflow version passed the production promotion gates.</span></div> : null}
      {params.status === "workflow_evaluated" ? <div className="notice"><strong>Workflow evaluation saved.</strong><span>Benchmark evidence was persisted for this workflow{params.failed && params.failed !== "0" ? `; ${params.failed} benchmark case(s) failed.` : "."}</span></div> : null}
      {params.status === "evaluation_failed" ? <div className="notice"><strong>Workflow evaluation could not run.</strong><span>Seeded benchmarks or evaluation criteria were not available.</span></div> : null}
      {params.status === "model_failed" ? <div className="notice"><strong>Model execution failed.</strong><span>Check OPENAI_API_KEY, model access, quota, or provider response.</span></div> : null}
      {params.status === "promotion_blocked" ? <div className="notice"><strong>Promotion blocked.</strong><span>{params.reason ?? "The workflow did not pass all production gates."}</span></div> : null}
      {params.status === "workflow_cloned" ? <div className="notice"><strong>Workflow cloned.</strong><span>An editable draft copy was created from the selected workflow.</span></div> : null}
      {params.status === "clone_failed" ? <div className="notice"><strong>Clone failed.</strong><span>The workflow could not be copied into your account.</span></div> : null}

      {!workflows.length ? (
        <div className="notice"><strong>No accessible workflows.</strong><span>Seed the Prompt OS catalog or create a workflow first.</span></div>
      ) : (
        <>
          <section className="panel workflow__selector">
            <div className="panel__heading"><span>Run a workflow</span><span className="muted">Execution is server-side.</span></div>
            <form action={startWorkflowRun} className="workflow__form">
              <label>
                Workflow
                <select name="workflowId" defaultValue={selected?.id}>
                  {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} · v{workflow.version}</option>)}
                </select>
              </label>
              <label>
                Input JSON
                <textarea name="inputJson" defaultValue='{"request":"Describe the task here."}' rows={6} spellCheck={false} />
              </label>
              <button className="button button--primary" type="submit">Run workflow</button>
            </form>
          </section>

          {selected ? (
            <section className="panel">
              <div className="panel__heading"><span>{selected.name}</span><span className="chip">{selected.status} · v{selected.version}</span></div>
              <p className="muted">{selected.purpose}</p>
                  <form action={cloneWorkflow} className="workflow__promote-form"><input type="hidden" name="workflowId" value={selected.id} /><button className="button" type="submit">Duplicate as editable</button></form>
              <div className="workflow__steps">
                {selected.steps.map((step, index) => (
                  <div key={step.id} className="workflow__step">
                    <span className="workflow__step-number">{index + 1}</span>
                    <div><strong>{step.name}</strong><span>{step.type} · {step.purpose}</span></div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {promotionGate ? (
            <section className="panel workflow__promotion">
              <div className="panel__heading"><span>Production promotion</span><span className={`status-pill status-pill--${promotionGate.allowed ? "completed" : "failed"}`}>{promotionGate.allowed ? "ready" : "blocked"}</span></div>
              <div className="audit-summary__stats">
                <span>{promotionEvidence.evaluationRunCount} successful runs</span>
                <span>{promotionEvidence.distinctBenchmarkCount} benchmarks</span>
                <span>{promotionEvidence.averageScore.toFixed(1)} average</span>
              </div>
              <div className="workflow__gate-grid">
                {Object.entries(promotionGate.checks).map(([key, passed]) => <div key={key} className={`workflow__gate ${passed ? "workflow__gate--pass" : "workflow__gate--fail"}`}><strong>{passed ? "PASS" : "BLOCKED"}</strong><span>{key}</span></div>)}
              </div>
              {promotionGate.blockers.length ? <div className="workflow__failure"><strong>Gate blockers</strong>{promotionGate.blockers.map((blocker) => <span key={blocker}>{blocker}</span>)}</div> : null}
              <form action={runWorkflowEvaluation} className="workflow__promote-form"><input type="hidden" name="workflowId" value={selected.id} /><button className="button" type="submit">Run benchmark suite</button></form>
              {selected.status !== "production" && promotionGate.allowed ? <form action={promoteWorkflow} className="workflow__promote-form"><input type="hidden" name="workflowId" value={selected.id} /><button className="button button--primary" type="submit">Promote to production</button></form> : null}
              {promotions.length ? <div className="workflow__promotion-history"><strong>Promotion history</strong>{promotions.slice(0, 3).map((promotion) => <div key={promotion.id}><span>v{promotion.workflowVersion} · {promotion.fromStatus} → {promotion.toStatus}</span><time dateTime={promotion.createdAt}>{new Date(promotion.createdAt).toLocaleString()}</time></div>)}</div> : null}
            </section>
          ) : null}

          {selectedRun ? (
            <section className="panel">
              <div className="panel__heading"><span>Latest run</span><span className={`status-pill status-pill--${selectedRun.result.status}`}>{selectedRun.result.status}</span></div>
              <div className="audit-summary__stats">
                <span>{selectedRun.result.transitions} transitions</span>
                <span>{Object.keys(selectedRun.result.attempts).length} active steps</span>
                <span>{new Date(selectedRun.createdAt).toLocaleString()}</span>
              </div>

              {selectedRun.result.status === "paused" && selectedRun.result.pendingApproval ? (
                <div className="workflow__approval">
                  <div><strong>Pending approval</strong><span>{selectedRun.result.pendingApproval.reason}</span></div>
                  <div className="workflow__approval-actions">
                    <form action={resolveWorkflowApproval}><input type="hidden" name="runId" value={selectedRun.id} /><input type="hidden" name="decision" value="approved" /><button className="button button--primary" type="submit">Approve</button></form>
                    <form action={resolveWorkflowApproval}><input type="hidden" name="runId" value={selectedRun.id} /><input type="hidden" name="decision" value="rejected" /><button className="button" type="submit">Reject</button></form>
                  </div>
                </div>
              ) : null}

              {selectedRun.result.failure ? (
                <div className="workflow__failure">
                  <strong>Failure evidence</strong>
                  <span>{selectedRun.result.failure.code} · {selectedRun.result.failure.message}</span>
                  {selectedRun.result.failure.attempts ? <span>Attempts: {selectedRun.result.failure.attempts}</span> : null}
                  {selectedRun.result.failure.missingKeys?.length ? <span>Missing input: {selectedRun.result.failure.missingKeys.join(", ")}</span> : null}
                </div>
              ) : null}

              <div className="workflow__events">
                {selectedRun.result.events.map((event, index) => <div key={`${event.type}-${event.stepId ?? "workflow"}-${index}`}><strong>{event.type}</strong><span>{event.stepId ?? "workflow"}{event.message ? ` · ${event.message}` : ""}</span></div>)}
              </div>
            </section>
          ) : <section className="panel"><p className="muted">No workflow runs have been saved yet.</p></section>}

          <section className="panel">
            <div className="panel__heading"><span>Run history</span><span className="muted">{runs.length} saved run{runs.length === 1 ? "" : "s"}</span></div>
            {runs.length ? runs.map((run) => <div className="evaluation-run" key={run.id}><div><strong>{run.result.status}</strong><span>{run.result.currentStepId ?? "—"}</span></div><time dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString()}</time></div>) : <p className="muted">No history for this workflow.</p>}
          </section>
        </>
      )}
    </main>
  );
}

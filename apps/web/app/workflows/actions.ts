"use server";

import { redirect } from "next/navigation";
import { executeWorkflow, getWorkflowToolCapability, resumeWorkflow, type WorkflowExecutionResult } from "@prompt-os/workflow-core";
import { hasSupabaseConfig } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import {
  cloneAccessibleWorkflow,
  createWorkflowRun,
  getAccessibleWorkflowById,
  getWorkflowRunById,
  updateWorkflowRun,
  promoteAccessibleWorkflow,
} from "../../lib/workflow-repository";
import { createConfiguredOpenAIResponsesAdapter } from "../../lib/openai-responses-adapter";
import { runWorkflowBenchmarkSuite } from "../../lib/evaluation-repository";

function value(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function requireUser() {
  if (!hasSupabaseConfig()) redirect("/workflows?status=not_configured");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=/workflows");
}

function parseInput(raw: string): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Workflow input must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Workflow input must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function failedResult(workflowId: string, workflowVersion: string, message: string): WorkflowExecutionResult {
  return {
    status: "failed",
    workflowId,
    workflowVersion,
    data: {},
    events: [{ type: "workflow_failed", message }],
    attempts: {},
    transitions: 0,
    failure: { code: "WORKFLOW_STEP_FAILED", message },
  };
}

export async function cloneWorkflow(form: FormData) {
  await requireUser();
  const sourceWorkflowId = value(form, "workflowId");
  if (!sourceWorkflowId) redirect("/workflows?status=missing_selection");

  const sourceWorkflow = await getAccessibleWorkflowById(sourceWorkflowId);
  if (!sourceWorkflow) redirect(`/workflows?workflowId=${encodeURIComponent(sourceWorkflowId)}&status=workflow_missing`);

  const cloneId = await cloneAccessibleWorkflow(sourceWorkflow.id);
  if (!cloneId) redirect(`/workflows?workflowId=${encodeURIComponent(sourceWorkflow.id)}&status=clone_failed`);

  redirect(`/workflows?workflowId=${encodeURIComponent(cloneId)}&status=workflow_cloned`);
}

export async function startWorkflowRun(form: FormData) {
  await requireUser();
  const workflowId = value(form, "workflowId");
  if (!workflowId) redirect("/workflows?status=missing_selection");

  const workflow = await getAccessibleWorkflowById(workflowId);
  if (!workflow) redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=workflow_missing`);

  let input: Record<string, unknown>;
  try {
    input = parseInput(value(form, "inputJson"));
  } catch {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=invalid_input`);
  }

  const initial: WorkflowExecutionResult = {
    status: "completed",
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    data: input,
    events: [],
    attempts: {},
    transitions: 0,
  };
  const runId = await createWorkflowRun({
    workflowId: workflow.id,
    status: "running",
    currentStepId: workflow.steps[0]?.id,
    result: initial,
  });
  if (!runId) redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=persist_failed`);

  let result: WorkflowExecutionResult;
  try {
    const adapter = createConfiguredOpenAIResponsesAdapter({ toolCapabilityResolver: getWorkflowToolCapability });
    result = await executeWorkflow({
      workflow,
      input,
      executeStep: adapter.createWorkflowStepExecutor(),
    });
  } catch (error) {
    result = failedResult(workflow.id, workflow.version, error instanceof Error ? error.message : String(error));
  }

  if (!(await updateWorkflowRun(runId, result))) {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&runId=${encodeURIComponent(runId)}&status=persist_failed`);
  }
  redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&runId=${encodeURIComponent(runId)}&status=${result.status}`);
}

export async function resolveWorkflowApproval(form: FormData) {
  await requireUser();
  const runId = value(form, "runId");
  const decision = value(form, "decision");
  if (!runId || (decision !== "approved" && decision !== "rejected")) {
    redirect("/workflows?status=invalid_approval");
  }

  const run = await getWorkflowRunById(runId);
  if (!run) redirect("/workflows?status=run_missing");
  const workflow = await getAccessibleWorkflowById(run.workflowId);
  if (!workflow) redirect("/workflows?status=workflow_missing");
  if (workflow.version !== run.workflowVersion) {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflow.id)}&runId=${encodeURIComponent(run.id)}&status=workflow_changed`);
  }

  let result: WorkflowExecutionResult;
  try {
    const adapter = createConfiguredOpenAIResponsesAdapter({ toolCapabilityResolver: getWorkflowToolCapability });
    result = await resumeWorkflow({
      workflow,
      checkpoint: run.result,
      decision: decision as "approved" | "rejected",
      executeStep: adapter.createWorkflowStepExecutor(),
    });
  } catch (error) {
    result = failedResult(workflow.id, workflow.version, error instanceof Error ? error.message : String(error));
  }

  if (!(await updateWorkflowRun(runId, result))) {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflow.id)}&runId=${encodeURIComponent(runId)}&status=persist_failed`);
  }
  redirect(`/workflows?workflowId=${encodeURIComponent(workflow.id)}&runId=${encodeURIComponent(runId)}&status=${result.status}`);
}


export async function runWorkflowEvaluation(form: FormData) {
  await requireUser();
  const workflowId = value(form, "workflowId");
  if (!workflowId) redirect("/workflows?status=missing_selection");

  const workflow = await getAccessibleWorkflowById(workflowId);
  if (!workflow) redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=workflow_missing`);

  let result: Awaited<ReturnType<typeof runWorkflowBenchmarkSuite>>;
  try {
    const adapter = createConfiguredOpenAIResponsesAdapter({ toolCapabilityResolver: getWorkflowToolCapability });
    result = await runWorkflowBenchmarkSuite({
      workflow,
      executeStep: adapter.createWorkflowStepExecutor(),
      score: adapter.createBenchmarkScorer(),
    });
  } catch {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=model_failed`);
  }

  if (!result) {
    redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=evaluation_failed`);
  }
  redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=workflow_evaluated&failed=${result.failedCases.length}`);
}

export async function promoteWorkflow(form: FormData) {
  await requireUser();
  const workflowId = value(form, "workflowId");
  if (!workflowId) redirect("/workflows?status=missing_selection");

  const result = await promoteAccessibleWorkflow(workflowId);
  if (!result.promoted) {
    const reason = result.blockers[0] ?? "Promotion gate blocked this workflow";
    redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=promotion_blocked&reason=${encodeURIComponent(reason)}`);
  }

  redirect(`/workflows?workflowId=${encodeURIComponent(workflowId)}&status=promoted`);
}

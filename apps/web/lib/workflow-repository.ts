import type { Json } from "@prompt-os/db-types";
import type { WorkflowDefinition, WorkflowEdge, WorkflowStep } from "@prompt-os/shared-types";
import { evaluateWorkflowPromotion, type WorkflowExecutionResult, type WorkflowFailureEvidence, type WorkflowPromotionEvidence } from "@prompt-os/workflow-core";
import { createClient } from "./supabase/server";

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  workflowVersion: string;
  ownerUserId: string;
  result: WorkflowExecutionResult;
  createdAt: string;
  updatedAt: string;
}

function objectRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function restoreWorkflowResult(row: {
  id: string;
  workflow_id: string;
  workflow_version: string;
  owner_user_id: string;
  status: string;
  current_step_id: string | null;
  state: Json;
  pending_approval: Json | null;
  failure: Json | null;
}): WorkflowRunRecord {
  const state = objectRecord(row.state);
  const pending = row.pending_approval && objectRecord(row.pending_approval);
  const failure = row.failure && objectRecord(row.failure);
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowVersion: row.workflow_version,
    ownerUserId: row.owner_user_id,
    result: {
      status: row.status as WorkflowExecutionResult["status"],
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      currentStepId: row.current_step_id ?? undefined,
      data: objectRecord((state.data as Json | undefined) ?? {}),
      events: Array.isArray(state.events) ? state.events as WorkflowExecutionResult["events"] : [],
      attempts: objectRecord((state.attempts as Json | undefined) ?? {}) as Record<string, number>,
      transitions: typeof state.transitions === "number" ? state.transitions : 0,
      pendingApproval: pending && typeof pending.stepId === "string" && typeof pending.reason === "string"
        ? { stepId: pending.stepId, reason: pending.reason }
        : undefined,
      failure: failure && typeof failure.message === "string"
        ? {
            code: typeof failure.code === "string" ? (failure.code as WorkflowFailureEvidence["code"]) : "WORKFLOW_INVALID_CHECKPOINT",
            stepId: typeof failure.stepId === "string" ? failure.stepId : undefined,
            message: failure.message,
            attempts: typeof failure.attempts === "number" ? failure.attempts : undefined,
            missingKeys: Array.isArray(failure.missingKeys) ? failure.missingKeys.filter((item): item is string => typeof item === "string") : undefined,
          }
        : undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAccessibleWorkflows(): Promise<WorkflowDefinition[]> {
  const supabase = await createClient();
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id,name,description,trigger,version,status,approval_required,is_system")
    .order("name", { ascending: true });
  if (error || !workflows?.length) return [];

  const results: WorkflowDefinition[] = [];
  for (const workflow of workflows) {
    const [stepsResult, edgesResult] = await Promise.all([
      supabase.from("workflow_steps").select("id,workflow_id,position,step_type,name,purpose,input_keys,output_keys,config").eq("workflow_id", workflow.id).order("position", { ascending: true }),
      supabase.from("workflow_edges").select("id,workflow_id,from_step_id,to_step_id,condition,priority").eq("workflow_id", workflow.id).order("priority", { ascending: false }),
    ]);

    const steps: WorkflowStep[] = (stepsResult.data ?? []).map((step) => ({
      id: step.id,
      type: step.step_type as WorkflowStep["type"],
      name: step.name,
      purpose: step.purpose,
      inputKeys: Array.isArray(step.input_keys) ? step.input_keys.filter((item): item is string => typeof item === "string") : [],
      outputKeys: Array.isArray(step.output_keys) ? step.output_keys.filter((item): item is string => typeof item === "string") : [],
      config: objectRecord(step.config),
    }));

    const edges: WorkflowEdge[] = (edgesResult.data ?? []).map((edge) => ({
      id: edge.id,
      fromStepId: edge.from_step_id,
      toStepId: edge.to_step_id,
      condition: objectRecord(edge.condition),
      priority: edge.priority,
    }));

    if (stepsResult.error || edgesResult.error) continue;
    results.push({
      id: workflow.id,
      name: workflow.name,
      purpose: workflow.description ?? workflow.name,
      trigger: workflow.trigger ?? "",
      steps,
      edges,
      dependencies: [],
      tools: [],
      approvalRequired: workflow.approval_required,
      evaluationIds: [],
      failureStates: [],
      version: workflow.version,
      status: workflow.status as WorkflowDefinition["status"],
      isSystem: workflow.is_system,
    });
  }
  return results;
}

export async function getAccessibleWorkflowById(id: string): Promise<WorkflowDefinition | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  const workflows = await getAccessibleWorkflows();
  return workflows.find((workflow) => workflow.id === normalizedId) ?? null;
}

export async function cloneAccessibleWorkflow(sourceWorkflowId: string, name?: string): Promise<string | null> {
  const normalizedId = sourceWorkflowId.trim();
  if (!normalizedId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workflow_clone", {
    p_source_workflow_id: normalizedId,
    p_name: name?.trim() || null,
  });
  if (error || !data) return null;
  return data;
}

export async function createWorkflowRun(input: {
  workflowId: string;
  status: WorkflowExecutionResult["status"] | "running";
  currentStepId?: string;
  result: WorkflowExecutionResult;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workflow_run", {
    p_workflow_id: input.workflowId,
    p_status: input.status,
    p_current_step_id: input.currentStepId ?? null,
    p_state: {
      data: input.result.data,
      events: input.result.events,
      attempts: input.result.attempts,
      transitions: input.result.transitions,
    } as Json,
    p_pending_approval: input.result.pendingApproval ? input.result.pendingApproval as Json : null,
    p_failure: input.result.failure ? input.result.failure as Json : null,
  });
  if (error || !data) return null;
  return data;
}

export async function updateWorkflowRun(runId: string, result: WorkflowExecutionResult): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_workflow_run", {
    p_run_id: runId,
    p_status: result.status,
    p_current_step_id: result.currentStepId ?? null,
    p_state: {
      data: result.data,
      events: result.events,
      attempts: result.attempts,
      transitions: result.transitions,
    } as Json,
    p_pending_approval: result.pendingApproval ? result.pendingApproval as Json : null,
    p_failure: result.failure ? result.failure as Json : null,
  });
  return !error;
}

export interface WorkflowPromotionRecord {
  id: string;
  workflowId: string;
  workflowVersion: string;
  fromStatus: string;
  toStatus: string;
  evaluationRunCount: number;
  distinctBenchmarkCount: number;
  averageScore: number;
  failedRunCount: number;
  createdAt: string;
}

export async function getWorkflowPromotions(workflowId: string): Promise<WorkflowPromotionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_promotions")
    .select("id,workflow_id,workflow_version,from_status,to_status,evaluation_run_count,distinct_benchmark_count,average_score,failed_run_count,created_at")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    workflowVersion: row.workflow_version,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    evaluationRunCount: row.evaluation_run_count,
    distinctBenchmarkCount: row.distinct_benchmark_count,
    averageScore: Number(row.average_score),
    failedRunCount: row.failed_run_count,
    createdAt: row.created_at,
  }));
}

export async function getWorkflowPromotionEvidence(workflowId: string, workflowVersion: string): Promise<WorkflowPromotionEvidence> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evaluation_runs")
    .select("benchmark_case_id,scores,failure_codes")
    .eq("workflow_id", workflowId)
    .eq("workflow_version", workflowVersion);
  if (error || !data) {
    return { evaluationRunCount: 0, distinctBenchmarkCount: 0, averageScore: 0, failedRunCount: 0 };
  }

  const successful = data.filter((run) => {
    if (!Array.isArray(run.failure_codes) || run.failure_codes.length) return false;
    if (!run.scores || typeof run.scores !== "object" || Array.isArray(run.scores)) return false;
    return typeof (run.scores as Record<string, unknown>).overall === "number";
  });
  const benchmarks = new Set(successful.map((run) => run.benchmark_case_id).filter((id): id is string => typeof id === "string"));
  const averageScore = successful.length
    ? Number((successful.reduce((sum, run) => sum + Number((run.scores as Record<string, unknown>).overall), 0) / successful.length).toFixed(6))
    : 0;
  return {
    evaluationRunCount: successful.length,
    distinctBenchmarkCount: benchmarks.size,
    averageScore,
    failedRunCount: data.length - successful.length,
  };
}

export async function promoteAccessibleWorkflow(workflowId: string): Promise<{ promoted: boolean; blockers: string[] }> {
  const workflow = await getAccessibleWorkflowById(workflowId);
  if (!workflow) return { promoted: false, blockers: ["Workflow not found or not accessible"] };

  const evidence = await getWorkflowPromotionEvidence(workflowId, workflow.version);
  const gate = evaluateWorkflowPromotion(workflow, evidence);
  if (!gate.allowed) return { promoted: false, blockers: gate.blockers };

  const supabase = await createClient();
  const { error } = await supabase.rpc("promote_workflow", {
    p_workflow_id: workflowId,
    p_expected_version: workflow.version,
    p_min_score: 80,
    p_min_runs: 3,
    p_min_benchmarks: 3,
  });
  if (error) return { promoted: false, blockers: [error.message] };
  return { promoted: true, blockers: [] };
}

export async function getWorkflowRuns(workflowId: string): Promise<WorkflowRunRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("id,workflow_id,workflow_version,owner_user_id,status,current_step_id,state,pending_approval,failure,created_at,updated_at")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(restoreWorkflowResult);
}

export async function getWorkflowRunById(runId: string): Promise<WorkflowRunRecord | null> {
  const normalizedId = runId.trim();
  if (!normalizedId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("id,workflow_id,workflow_version,owner_user_id,status,current_step_id,state,pending_approval,failure,created_at,updated_at")
    .eq("id", normalizedId)
    .maybeSingle();
  if (error || !data) return null;
  return restoreWorkflowResult(data);
}

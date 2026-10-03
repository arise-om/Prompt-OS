import type { WorkflowDefinition, WorkflowEdge, WorkflowStep } from "@prompt-os/shared-types";

export type WorkflowExecutionStatus = "completed" | "paused" | "failed";
export type WorkflowApprovalDecision = "approved" | "rejected";

export interface WorkflowExecutionEvent {
  type:
    | "step_started"
    | "step_completed"
    | "step_failed"
    | "approval_requested"
    | "approval_resolved"
    | "workflow_completed"
    | "workflow_failed";
  stepId?: string;
  attempt?: number;
  message?: string;
  dataKeys?: string[];
  decision?: WorkflowApprovalDecision;
}

export interface WorkflowFailureEvidence {
  code:
    | "WORKFLOW_MISSING_INPUT"
    | "WORKFLOW_STEP_FAILED"
    | "WORKFLOW_TRANSITION_LIMIT"
    | "WORKFLOW_APPROVAL_REJECTED"
    | "WORKFLOW_INVALID_CHECKPOINT";
  stepId?: string;
  message: string;
  attempts?: number;
  missingKeys?: string[];
}

export interface WorkflowPendingApproval {
  stepId: string;
  reason: string;
}

export interface WorkflowExecutionResult {
  status: WorkflowExecutionStatus;
  workflowId: string;
  workflowVersion: string;
  currentStepId?: string;
  data: Record<string, unknown>;
  events: WorkflowExecutionEvent[];
  attempts: Record<string, number>;
  transitions: number;
  pendingApproval?: WorkflowPendingApproval;
  failure?: WorkflowFailureEvidence;
}


export interface WorkflowPromotionEvidence {
  evaluationRunCount: number;
  distinctBenchmarkCount: number;
  averageScore: number;
  failedRunCount: number;
}

export interface WorkflowPromotionPolicy {
  minEvaluationRuns?: number;
  minDistinctBenchmarks?: number;
  minAverageScore?: number;
}

export interface WorkflowPromotionResult {
  allowed: boolean;
  blockers: string[];
  checks: {
    graphValid: boolean;
    supportedTools: boolean;
    approvalProtected: boolean;
    evaluationCoverage: boolean;
    evaluationQuality: boolean;
    evaluationFailures: boolean;
  };
}

export const DEFAULT_WORKFLOW_PROMOTION_POLICY: Required<WorkflowPromotionPolicy> = {
  minEvaluationRuns: 3,
  minDistinctBenchmarks: 3,
  minAverageScore: 80,
};

export interface WorkflowToolCapability {
  id: "web_search";
  stepTypes: Array<"research" | "tool">;
}

export const WORKFLOW_TOOL_CAPABILITIES: Record<WorkflowToolCapability["id"], WorkflowToolCapability> = {
  web_search: { id: "web_search", stepTypes: ["research", "tool"] },
};

const CONSEQUENT_RISK_LEVELS = new Set(["high", "consequential"]);

export function getWorkflowToolCapability(step: Pick<WorkflowStep, "type" | "config">): WorkflowToolCapability | undefined {
  if (step.type === "research") return WORKFLOW_TOOL_CAPABILITIES.web_search;
  if (step.type !== "tool") return undefined;
  const tool = typeof step.config.tool === "string" ? step.config.tool : undefined;
  if (!tool) return undefined;
  return WORKFLOW_TOOL_CAPABILITIES[tool as WorkflowToolCapability["id"]];
}

export function isWorkflowStepToolSupported(step: Pick<WorkflowStep, "type" | "config">): boolean {
  return step.type !== "tool" && step.type !== "research" || Boolean(getWorkflowToolCapability(step));
}

function requiresApproval(step: WorkflowStep): boolean {
  const risk = typeof step.config.riskLevel === "string" ? step.config.riskLevel : undefined;
  return step.config.requiresApproval === true || (risk ? CONSEQUENT_RISK_LEVELS.has(risk) : false);
}

function stepUsesSupportedTool(step: WorkflowStep): boolean {
  return isWorkflowStepToolSupported(step);
}

function approvalProtectsConsequentialStep(workflow: WorkflowDefinition, targetStepId: string): boolean {
  const firstStepId = workflow.steps[0]?.id;
  if (!firstStepId) return false;

  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of workflow.edges) {
    const current = outgoing.get(edge.fromStepId) ?? [];
    current.push(edge);
    outgoing.set(edge.fromStepId, current);
  }

  const queue: Array<{ stepId: string; seenApproval: boolean }> = [{
    stepId: firstStepId,
    seenApproval: false,
  }];
  const visited = new Set<string>();

  while (queue.length) {
    const state = queue.shift()!;
    const key = `${state.stepId}:${state.seenApproval ? "approved" : "open"}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const step = workflow.steps.find((item) => item.id === state.stepId);
    if (!step) continue;
    const nowApproved = state.seenApproval || step.type === "approval";
    if (step.id === targetStepId) return nowApproved;

    for (const edge of outgoing.get(step.id) ?? []) {
      queue.push({ stepId: edge.toStepId, seenApproval: nowApproved });
    }
  }

  return false;
}

export function evaluateWorkflowPromotion(
  workflow: WorkflowDefinition,
  evidence: WorkflowPromotionEvidence,
  policy: WorkflowPromotionPolicy = {},
): WorkflowPromotionResult {
  const required = { ...DEFAULT_WORKFLOW_PROMOTION_POLICY, ...policy };
  const blockers: string[] = [];
  const graphErrors = validateWorkflowGraph(workflow);
  if (graphErrors.length) blockers.push(`Workflow graph is invalid: ${graphErrors.join("; ")}`);
  if (workflow.isSystem) blockers.push("System workflows cannot be promoted by ordinary clients");
  if (!["validated", "tested"].includes(workflow.status)) {
    blockers.push("Workflow must be tested or validated before production promotion");
  }

  const unsupportedTools = workflow.steps.filter((step) => !stepUsesSupportedTool(step));
  if (unsupportedTools.length) {
    blockers.push(`Unsupported tools: ${unsupportedTools.map((step) => step.name).join(", ")}`);
  }

  const consequentialSteps = workflow.steps.filter((step) => requiresApproval(step));
  const approvalProtected = consequentialSteps.every((step) => approvalProtectsConsequentialStep(workflow, step.id));
  if (consequentialSteps.length && (!workflow.approvalRequired || !workflow.steps.some((step) => step.type === "approval") || !approvalProtected)) {
    blockers.push("Consequential tool steps must be protected by an approval checkpoint on every reachable path");
  }

  if (evidence.evaluationRunCount < required.minEvaluationRuns || evidence.distinctBenchmarkCount < required.minDistinctBenchmarks) {
    blockers.push(`Benchmark coverage is insufficient: need ${required.minDistinctBenchmarks} distinct benchmarks and ${required.minEvaluationRuns} successful runs`);
  }
  if (evidence.averageScore < required.minAverageScore) {
    blockers.push(`Average evaluation score must be at least ${required.minAverageScore}`);
  }
  if (evidence.failedRunCount > 0) {
    blockers.push(`Evaluation evidence contains ${evidence.failedRunCount} failed run(s)`);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    checks: {
      graphValid: graphErrors.length === 0,
      supportedTools: unsupportedTools.length === 0,
      approvalProtected: consequentialSteps.length === 0 || (workflow.approvalRequired && workflow.steps.some((step) => step.type === "approval") && approvalProtected),
      evaluationCoverage: evidence.evaluationRunCount >= required.minEvaluationRuns && evidence.distinctBenchmarkCount >= required.minDistinctBenchmarks,
      evaluationQuality: evidence.averageScore >= required.minAverageScore,
      evaluationFailures: evidence.failedRunCount === 0,
    },
  };
}

export type WorkflowStepExecutor = (context: {
  workflow: WorkflowDefinition;
  step: WorkflowStep;
  data: Record<string, unknown>;
}) => Promise<Record<string, unknown> | unknown>;

export function validateWorkflowGraph(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!workflow.steps.length) errors.push("Workflow must contain at least one step");

  for (const step of workflow.steps) {
    if (ids.has(step.id)) errors.push(`Duplicate step id: ${step.id}`);
    ids.add(step.id);
  }

  for (const edge of workflow.edges) {
    if (!ids.has(edge.fromStepId)) errors.push(`Unknown fromStepId: ${edge.fromStepId}`);
    if (!ids.has(edge.toStepId)) errors.push(`Unknown toStepId: ${edge.toStepId}`);
    if (edge.priority < 0) errors.push(`Negative edge priority: ${edge.id}`);
  }

  return errors;
}

function resolveValue(raw: string, data: Record<string, unknown>): unknown {
  const trimmed = raw.trim();
  if (trimmed in data) return data[trimmed];
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function evaluateWorkflowCondition(
  condition: Record<string, unknown>,
  data: Record<string, unknown>,
): boolean {
  if (!Object.keys(condition).length) return true;
  const expression = condition.when;
  if (typeof expression !== "string" || !expression.trim()) return false;

  const match = expression.trim().match(/^(.+?)(===|!==|==|!=|<=|>=|<|>)(.+)$/);
  if (!match) return false;

  const left = resolveValue(match[1], data);
  const right = resolveValue(match[3], data);

  switch (match[2]) {
    case "==":
    case "===":
      return left === right;
    case "!=":
    case "!==":
      return left !== right;
    case "<":
      return typeof left === "number" && typeof right === "number" && left < right;
    case ">":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "<=":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case ">=":
      return typeof left === "number" && typeof right === "number" && left >= right;
    default:
      return false;
  }
}

function selectNextEdge(edges: WorkflowEdge[], data: Record<string, unknown>): WorkflowEdge | undefined {
  return [...edges]
    .sort((a, b) => b.priority - a.priority)
    .find((edge) => evaluateWorkflowCondition(edge.condition, data));
}

function missingInputKeys(step: WorkflowStep, data: Record<string, unknown>): string[] {
  return step.inputKeys.filter((key) => data[key] === undefined);
}

function applyStepOutput(
  step: WorkflowStep,
  output: Record<string, unknown> | unknown,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    if (step.outputKeys.length !== 1) {
      throw new Error(`Step ${step.id} must return an object when it declares multiple outputs`);
    }
    return { ...data, [step.outputKeys[0]]: output };
  }

  const objectOutput = output as Record<string, unknown>;
  const next = { ...data, ...objectOutput };
  for (const key of step.outputKeys) {
    if (next[key] === undefined) {
      throw new Error(`Step ${step.id} did not produce required output: ${key}`);
    }
  }
  return next;
}

function checkpointFrom(result: WorkflowExecutionResult): WorkflowExecutionResult {
  return {
    ...result,
    data: { ...result.data },
    events: [...result.events],
    attempts: { ...result.attempts },
    pendingApproval: result.pendingApproval ? { ...result.pendingApproval } : undefined,
    failure: result.failure ? { ...result.failure } : undefined,
  };
}

async function runWorkflowState(input: {
  workflow: WorkflowDefinition;
  startStepId: string;
  data: Record<string, unknown>;
  executeStep: WorkflowStepExecutor;
  maxTransitions: number;
  events?: WorkflowExecutionEvent[];
  attempts?: Record<string, number>;
  transitions?: number;
}): Promise<WorkflowExecutionResult> {
  const { workflow } = input;
  const stepById = new Map(workflow.steps.map((item) => [item.id, item]));
  const edgesByFrom = new Map<string, WorkflowEdge[]>();
  for (const edge of workflow.edges) {
    const current = edgesByFrom.get(edge.fromStepId) ?? [];
    current.push(edge);
    edgesByFrom.set(edge.fromStepId, current);
  }

  let currentStep = stepById.get(input.startStepId);
  let data = { ...input.data };
  const events = [...(input.events ?? [])];
  const attempts = { ...(input.attempts ?? {}) };
  let transitions = input.transitions ?? 0;

  if (!currentStep) {
    const failure: WorkflowFailureEvidence = {
      code: "WORKFLOW_INVALID_CHECKPOINT",
      stepId: input.startStepId,
      message: `Workflow start step ${input.startStepId} does not exist`,
    };
    events.push({ type: "workflow_failed", stepId: input.startStepId, message: failure.message });
    return { status: "failed", workflowId: workflow.id, workflowVersion: workflow.version, data, events, attempts, transitions, failure };
  }

  while (currentStep) {
    if (transitions >= input.maxTransitions) {
      const failure: WorkflowFailureEvidence = {
        code: "WORKFLOW_TRANSITION_LIMIT",
        stepId: currentStep.id,
        message: `Workflow exceeded the transition limit of ${input.maxTransitions}`,
      };
      events.push({ type: "workflow_failed", stepId: currentStep.id, message: failure.message });
      return { status: "failed", workflowId: workflow.id, workflowVersion: workflow.version, currentStepId: currentStep.id, data, events, attempts, transitions, failure };
    }

    const missingKeys = missingInputKeys(currentStep, data);
    if (missingKeys.length) {
      const failure: WorkflowFailureEvidence = {
        code: "WORKFLOW_MISSING_INPUT",
        stepId: currentStep.id,
        message: `Missing required inputs for step ${currentStep.id}`,
        missingKeys,
      };
      events.push({ type: "workflow_failed", stepId: currentStep.id, message: failure.message });
      return { status: "failed", workflowId: workflow.id, workflowVersion: workflow.version, currentStepId: currentStep.id, data, events, attempts, transitions, failure };
    }

    if (currentStep.type === "approval") {
      const paused: WorkflowExecutionResult = {
        status: "paused",
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        currentStepId: currentStep.id,
        data,
        events: [...events, { type: "approval_requested", stepId: currentStep.id }],
        attempts,
        transitions,
        pendingApproval: {
          stepId: currentStep.id,
          reason: typeof currentStep.config.reason === "string" ? currentStep.config.reason : currentStep.purpose,
        },
      };
      return checkpointFrom(paused);
    }

    const isInput = currentStep.type === "input";
    const maxAttempts = Math.max(1, Math.min(10, Number(currentStep.config.maxAttempts ?? 1)));
    let completed = false;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attempts[currentStep.id] = attempt;
      events.push({ type: "step_started", stepId: currentStep.id, attempt });
      try {
        const rawOutput = isInput
          ? Object.fromEntries(currentStep.outputKeys.map((key) => [key, data[key]]))
          : await input.executeStep({ workflow, step: currentStep, data: { ...data } });
        data = applyStepOutput(currentStep, rawOutput, data);
        events.push({ type: "step_completed", stepId: currentStep.id, attempt, dataKeys: currentStep.outputKeys });
        completed = true;
        break;
      } catch (error) {
        lastError = error;
        events.push({
          type: "step_failed",
          stepId: currentStep.id,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!completed) {
      const failure: WorkflowFailureEvidence = {
        code: "WORKFLOW_STEP_FAILED",
        stepId: currentStep.id,
        message: lastError instanceof Error ? lastError.message : String(lastError),
        attempts: attempts[currentStep.id],
      };
      events.push({ type: "workflow_failed", stepId: currentStep.id, message: failure.message });
      return { status: "failed", workflowId: workflow.id, workflowVersion: workflow.version, currentStepId: currentStep.id, data, events, attempts, transitions, failure };
    }

    const nextEdge = selectNextEdge(edgesByFrom.get(currentStep.id) ?? [], data);
    if (!nextEdge) {
      events.push({ type: "workflow_completed" });
      return { status: "completed", workflowId: workflow.id, workflowVersion: workflow.version, currentStepId: currentStep.id, data, events, attempts, transitions };
    }

    transitions += 1;
    currentStep = stepById.get(nextEdge.toStepId);
    if (!currentStep) {
      const failure: WorkflowFailureEvidence = {
        code: "WORKFLOW_INVALID_CHECKPOINT",
        stepId: nextEdge.toStepId,
        message: `Workflow edge ${nextEdge.id} points to a missing step`,
      };
      events.push({ type: "workflow_failed", stepId: nextEdge.toStepId, message: failure.message });
      return { status: "failed", workflowId: workflow.id, workflowVersion: workflow.version, data, events, attempts, transitions, failure };
    }
  }

  events.push({ type: "workflow_completed" });
  return { status: "completed", workflowId: workflow.id, workflowVersion: workflow.version, data, events, attempts, transitions };
}

export async function executeWorkflow(input: {
  workflow: WorkflowDefinition;
  input: Record<string, unknown>;
  executeStep: WorkflowStepExecutor;
  maxTransitions?: number;
}): Promise<WorkflowExecutionResult> {
  const graphErrors = validateWorkflowGraph(input.workflow);
  if (graphErrors.length) {
    return {
      status: "failed",
      workflowId: input.workflow.id,
      workflowVersion: input.workflow.version,
      data: { ...input.input },
      events: [{ type: "workflow_failed", message: graphErrors.join("; ") }],
      attempts: {},
      transitions: 0,
      failure: { code: "WORKFLOW_INVALID_CHECKPOINT", message: graphErrors.join("; ") },
    };
  }

  const firstStep = [...input.workflow.steps].sort((a, b) => a.id.localeCompare(b.id))[0];
  const orderedSteps = input.workflow.steps;
  const startStepId = orderedSteps[0]?.id ?? firstStep?.id;
  if (!startStepId) {
    return {
      status: "failed",
      workflowId: input.workflow.id,
      workflowVersion: input.workflow.version,
      data: { ...input.input },
      events: [{ type: "workflow_failed", message: "Workflow has no executable steps" }],
      attempts: {},
      transitions: 0,
      failure: { code: "WORKFLOW_INVALID_CHECKPOINT", message: "Workflow has no executable steps" },
    };
  }

  return runWorkflowState({
    workflow: input.workflow,
    startStepId,
    data: input.input,
    executeStep: input.executeStep,
    maxTransitions: input.maxTransitions ?? Math.max(50, input.workflow.steps.length * 10),
  });
}

export async function resumeWorkflow(input: {
  workflow: WorkflowDefinition;
  checkpoint: WorkflowExecutionResult;
  decision: WorkflowApprovalDecision;
  executeStep: WorkflowStepExecutor;
  maxTransitions?: number;
}): Promise<WorkflowExecutionResult> {
  const { checkpoint, decision, workflow } = input;
  if (checkpoint.status !== "paused" || !checkpoint.pendingApproval) {
    return {
      ...checkpoint,
      status: "failed",
      failure: { code: "WORKFLOW_INVALID_CHECKPOINT", message: "Workflow checkpoint is not awaiting approval" },
      events: [...checkpoint.events, { type: "workflow_failed", message: "Workflow checkpoint is not awaiting approval" }],
    };
  }

  const approvalStep = workflow.steps.find((step) => step.id === checkpoint.pendingApproval?.stepId);
  if (!approvalStep || approvalStep.type !== "approval") {
    return {
      ...checkpoint,
      status: "failed",
      failure: { code: "WORKFLOW_INVALID_CHECKPOINT", stepId: checkpoint.pendingApproval.stepId, message: "Approval step is missing from workflow" },
      events: [...checkpoint.events, { type: "workflow_failed", stepId: checkpoint.pendingApproval.stepId, message: "Approval step is missing from workflow" }],
    };
  }

  const events = [...checkpoint.events, { type: "approval_resolved" as const, stepId: approvalStep.id, decision }];
  if (decision === "rejected") {
    const failure: WorkflowFailureEvidence = {
      code: "WORKFLOW_APPROVAL_REJECTED",
      stepId: approvalStep.id,
      message: "Required workflow approval was rejected",
    };
    return {
      ...checkpoint,
      status: "failed",
      events: [...events, { type: "workflow_failed", stepId: approvalStep.id, message: failure.message }],
      pendingApproval: undefined,
      failure,
    };
  }

  const nextEdge = selectNextEdge(workflow.edges.filter((edge) => edge.fromStepId === approvalStep.id), checkpoint.data);
  if (!nextEdge) {
    return {
      ...checkpoint,
      status: "completed",
      currentStepId: approvalStep.id,
      events: [...events, { type: "workflow_completed" }],
      pendingApproval: undefined,
    };
  }

  const nextStep = workflow.steps.find((step) => step.id === nextEdge.toStepId);
  if (!nextStep) {
    const failure: WorkflowFailureEvidence = {
      code: "WORKFLOW_INVALID_CHECKPOINT",
      stepId: nextEdge.toStepId,
      message: `Workflow edge ${nextEdge.id} points to a missing step`,
    };
    return {
      ...checkpoint,
      status: "failed",
      events: [...events, { type: "workflow_failed", stepId: nextEdge.toStepId, message: failure.message }],
      pendingApproval: undefined,
      failure,
    };
  }

  const maxTransitions = input.maxTransitions ?? Math.max(50, workflow.steps.length * 10);
  return runWorkflowState({
    workflow,
    startStepId: nextStep.id,
    data: checkpoint.data,
    executeStep: input.executeStep,
    maxTransitions,
    events,
    attempts: checkpoint.attempts,
    transitions: checkpoint.transitions + 1,
  });
}

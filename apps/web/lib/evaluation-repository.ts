import type { Json } from "@prompt-os/db-types";
import { runBenchmarkCase, runBenchmarkSuite, selectWorkflowCompatibleBenchmarks, type BenchmarkExecutor, type BenchmarkScorer, type EvaluationPromptVersion } from "@prompt-os/evaluation-core";
import { executeWorkflow, resumeWorkflow, type WorkflowStepExecutor } from "@prompt-os/workflow-core";
import type { WorkflowDefinition } from "@prompt-os/shared-types";
import { getSystemBenchmarkById, getSystemBenchmarkCases, getSystemEvaluationCriteria } from "./evaluation-catalog-repository";
import type { PromptAuditFinding, PromptAuditResult } from "@prompt-os/shared-types";
import { createClient } from "./supabase/server";

export interface CreateEvaluationRunInput {
  promptVersionId?: string;
  workflowId?: string;
  benchmarkCaseId?: string;
  actualOutput: Json;
  scores?: Record<string, number>;
  failures?: string[];
  reviewerNotes?: string;
}

function restorePromptAuditSnapshot(
  score: number | null,
  findingsValue: Json,
  missingSectionsValue: Json,
): PromptAuditResult | undefined {
  if (score === null || !Number.isFinite(score)) return undefined;

  const findings = Array.isArray(findingsValue)
    ? findingsValue.flatMap((item): PromptAuditFinding[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const code = item.code;
        const severity = item.severity;
        const message = item.message;
        const remediation = item.remediation;
        if (
          typeof code !== "string"
          || (severity !== "info" && severity !== "warning" && severity !== "critical")
          || typeof message !== "string"
          || typeof remediation !== "string"
        ) return [];
        return [{ code, severity, message, remediation }];
      })
    : [];

  const missingSections = Array.isArray(missingSectionsValue)
    ? missingSectionsValue.filter((item): item is string => typeof item === "string")
    : [];

  return {
    score: Math.min(Math.max(score, 0), 100),
    findings,
    missingSections,
  };
}

export async function createEvaluationRun(input: CreateEvaluationRunInput): Promise<string | null> {
  const supabase = await createClient();
  const scores = input.scores ?? {};

  const { data, error } = await supabase.rpc("create_evaluation_run", {
    p_prompt_version_id: input.promptVersionId?.trim() || null,
    p_workflow_id: input.workflowId?.trim() || null,
    p_benchmark_case_id: input.benchmarkCaseId?.trim() || null,
    p_actual_output: input.actualOutput,
    p_scores: scores as Json,
    p_failure_codes: input.failures ?? [],
    p_reviewer_notes: input.reviewerNotes?.trim() || null,
  });

  if (error || !data) return null;
  return data;
}

export { restorePromptAuditSnapshot };


export interface RunSystemBenchmarkCaseInput {
  prompt: EvaluationPromptVersion;
  benchmarkCaseId: string;
  execute: BenchmarkExecutor;
  score: BenchmarkScorer;
}

export async function runSystemBenchmarkCase(
  input: RunSystemBenchmarkCaseInput,
): Promise<{ runId: string; actualOutput: unknown; scores: Record<string, number>; overallScore: number } | null> {
  const [benchmark, criteria] = await Promise.all([
    getSystemBenchmarkById(input.benchmarkCaseId),
    getSystemEvaluationCriteria(),
  ]);
  if (!benchmark || !criteria.length) return null;

  const result = await runBenchmarkCase({
    prompt: input.prompt,
    benchmark,
    criteria,
    weightOverrides: benchmark.weightOverrides,
    execute: input.execute,
    score: input.score,
  });

  const runId = await createEvaluationRun({
    promptVersionId: input.prompt.id,
    benchmarkCaseId: benchmark.id,
    actualOutput: result.actualOutput as Json,
    scores: result.scores,
  });
  if (!runId) return null;

  return {
    runId,
    actualOutput: result.actualOutput,
    scores: result.scores,
    overallScore: result.overallScore,
  };
}


export interface RunSystemBenchmarkSuiteInput {
  prompt: EvaluationPromptVersion;
  execute: BenchmarkExecutor;
  score: BenchmarkScorer;
}

export interface PersistedBenchmarkSuiteCase {
  benchmarkId: string;
  runId: string;
  actualOutput: unknown;
  scores: Record<string, number>;
  overallScore: number;
}

export interface RunSystemBenchmarkSuiteResult {
  caseResults: PersistedBenchmarkSuiteCase[];
  failedCases: Array<{ benchmarkId: string; error: string }>;
  averageScore: number;
}

export async function runSystemBenchmarkSuite(
  input: RunSystemBenchmarkSuiteInput,
): Promise<RunSystemBenchmarkSuiteResult | null> {
  const [benchmarks, criteria] = await Promise.all([
    getSystemBenchmarkCases(),
    getSystemEvaluationCriteria(),
  ]);
  if (!benchmarks.length || !criteria.length) return null;

  const result = await runBenchmarkSuite({
    prompt: input.prompt,
    benchmarks,
    criteria,
    execute: input.execute,
    score: input.score,
  });

  const persisted: PersistedBenchmarkSuiteCase[] = [];
  const failedCases = [...result.failedCases];
  for (const caseResult of result.caseResults) {
    const runId = await createEvaluationRun({
      promptVersionId: input.prompt.id,
      benchmarkCaseId: caseResult.benchmarkId,
      actualOutput: caseResult.actualOutput as Json,
      scores: caseResult.scores,
    });
    if (!runId) {
      failedCases.push({ benchmarkId: caseResult.benchmarkId, error: "Evaluation result could not be persisted" });
      continue;
    }
    persisted.push({ runId, ...caseResult });
  }

  const averageScore = persisted.length
    ? Number((persisted.reduce((sum, item) => sum + item.overallScore, 0) / persisted.length).toFixed(6))
    : 0;

  return { caseResults: persisted, failedCases, averageScore };
}


export interface RunWorkflowBenchmarkSuiteInput {
  workflow: WorkflowDefinition;
  executeStep: WorkflowStepExecutor;
  score: BenchmarkScorer;
}

export interface RunWorkflowBenchmarkSuiteResult {
  caseResults: PersistedBenchmarkSuiteCase[];
  failedCases: Array<{ benchmarkId: string; error: string }>;
  averageScore: number;
}

function workflowEvaluationPrompt(workflow: WorkflowDefinition): EvaluationPromptVersion {
  return {
    id: `workflow:${workflow.id}`,
    version: workflow.version,
    body: [
      `Workflow: ${workflow.name}`,
      `Purpose: ${workflow.purpose}`,
      "Evaluate the final workflow output produced for the supplied benchmark input.",
      ...workflow.steps.map((step, index) =>
        `${index + 1}. ${step.name} [${step.type}] — ${step.purpose}\n   inputs: ${step.inputKeys.join(", ") || "none"}\n   outputs: ${step.outputKeys.join(", ") || "none"}`,
      ),
    ].join("\n"),
  };
}

function workflowBenchmarkInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Workflow benchmark input must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export async function runWorkflowBenchmarkSuite(
  input: RunWorkflowBenchmarkSuiteInput,
): Promise<RunWorkflowBenchmarkSuiteResult | null> {
  const [benchmarks, criteria] = await Promise.all([
    getSystemBenchmarkCases(),
    getSystemEvaluationCriteria(),
  ]);
  if (!benchmarks.length || !criteria.length) return null;

  const compatibleBenchmarks = selectWorkflowCompatibleBenchmarks(input.workflow, benchmarks);
  if (!compatibleBenchmarks.length) return null;

  const prompt = workflowEvaluationPrompt(input.workflow);
  const result = await runBenchmarkSuite({
    prompt,
    benchmarks: compatibleBenchmarks,
    criteria,
    execute: async ({ benchmark }) => {
      let workflowResult = await executeWorkflow({
        workflow: input.workflow,
        input: workflowBenchmarkInput(benchmark.input),
        executeStep: input.executeStep,
      });
      while (workflowResult.status === "paused" && workflowResult.pendingApproval) {
        workflowResult = await resumeWorkflow({
          workflow: input.workflow,
          checkpoint: workflowResult,
          decision: "approved",
          executeStep: input.executeStep,
        });
      }
      if (workflowResult.status !== "completed") {
        throw new Error(workflowResult.failure?.message ?? `Workflow ended with status ${workflowResult.status}`);
      }
      return workflowResult.data;
    },
    score: input.score,
  });

  const persisted: PersistedBenchmarkSuiteCase[] = [];
  const failedCases: Array<{ benchmarkId: string; error: string }> = [];
  for (const caseResult of result.caseResults) {
    const runId = await createEvaluationRun({
      workflowId: input.workflow.id,
      benchmarkCaseId: caseResult.benchmarkId,
      actualOutput: caseResult.actualOutput as Json,
      scores: caseResult.scores,
    });
    if (!runId) {
      failedCases.push({
        benchmarkId: caseResult.benchmarkId,
        error: "Workflow evaluation result could not be persisted",
      });
      continue;
    }
    persisted.push({ runId, ...caseResult });
  }

  for (const failedCase of result.failedCases) {
    failedCases.push(failedCase);
    await createEvaluationRun({
      workflowId: input.workflow.id,
      benchmarkCaseId: failedCase.benchmarkId,
      actualOutput: { benchmarkCaseId: failedCase.benchmarkId, error: failedCase.error } as Json,
      failures: [failedCase.error],
      reviewerNotes: `Benchmark case ${failedCase.benchmarkId} failed during workflow evaluation.`,
    });
  }

  const averageScore = persisted.length
    ? Number((persisted.reduce((sum, item) => sum + item.overallScore, 0) / persisted.length).toFixed(6))
    : 0;

  return { caseResults: persisted, failedCases, averageScore };
}

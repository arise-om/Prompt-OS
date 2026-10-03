import type {
  BenchmarkCase,
  EvaluationCriterion,
  EvaluationRun,
} from "@prompt-os/shared-types";

export type EvaluatableBenchmarkCase = BenchmarkCase & {
  weightOverrides?: Record<string, number>;
};

export interface BenchmarkExecutionContext {
  prompt: Pick<EvaluationPromptVersion, "id" | "version" | "body">;
  benchmark: BenchmarkCase;
  criteria: EvaluationCriterion[];
}

export interface EvaluationPromptVersion {
  id: string;
  version: string;
  body: string;
}

export type BenchmarkExecutor = (
  context: Omit<BenchmarkExecutionContext, "criteria">,
) => Promise<unknown>;

export type BenchmarkScorer = (context: {
  prompt: EvaluationPromptVersion;
  benchmark: BenchmarkCase;
  criteria: EvaluationCriterion[];
  actualOutput: unknown;
}) => Promise<Record<string, number>>;

export interface BenchmarkEvaluationResult {
  actualOutput: unknown;
  scores: Record<string, number>;
  overallScore: number;
}

export interface EvaluationComparison {
  deltas: Record<string, number>;
  regressions: string[];
  improvements: string[];
}

export interface BenchmarkSuiteCaseResult extends BenchmarkEvaluationResult {
  benchmarkId: string;
}

export interface BenchmarkSuiteFailure {
  benchmarkId: string;
  error: string;
}

export interface BenchmarkSuiteResult {
  caseResults: BenchmarkSuiteCaseResult[];
  failedCases: BenchmarkSuiteFailure[];
  averageScore: number;
}


export function selectWorkflowCompatibleBenchmarks(
  workflow: { steps: Array<{ type: string; inputKeys: string[] }> },
  benchmarks: EvaluatableBenchmarkCase[],
): EvaluatableBenchmarkCase[] {
  const entryStep = workflow.steps.find((step) => step.type === "input") ?? workflow.steps[0];
  const requiredKeys = entryStep?.inputKeys ?? [];

  return benchmarks.filter((benchmark) => {
    if (!benchmark.input || typeof benchmark.input !== "object" || Array.isArray(benchmark.input)) {
      return requiredKeys.length === 0;
    }
    const input = benchmark.input as Record<string, unknown>;
    return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(input, key));
  });
}

function criteriaById(criteria: EvaluationCriterion[]): Map<string, EvaluationCriterion> {
  return new Map(criteria.map((criterion) => [criterion.id, criterion]));
}

export function validateEvaluationScores(
  scores: Record<string, number>,
  criteria: EvaluationCriterion[],
): string[] {
  const errors: string[] = [];
  const knownCriteria = criteriaById(criteria);

  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (score === undefined) {
      errors.push(`Missing score for criterion: ${criterion.id}`);
      continue;
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      errors.push(`Score for ${criterion.id} must be between 0 and 100`);
      continue;
    }
    if (criterion.scoring === "binary" && score !== 0 && score !== 100) {
      errors.push(`Binary score for ${criterion.id} must be 0 or 100`);
    }
  }

  for (const key of Object.keys(scores)) {
    if (key === "overall") continue;
    if (!knownCriteria.has(key)) {
      errors.push(`Unknown criterion score: ${key}`);
    }
  }

  return errors;
}

export function aggregateEvaluationScore(
  scores: Record<string, number>,
  criteria: EvaluationCriterion[],
  weightOverrides: Record<string, number> = {},
): number {
  const active = criteria
    .map((criterion) => ({
      criterion,
      weight: weightOverrides[criterion.id] ?? criterion.weight,
    }))
    .filter(({ weight }) => weight > 0);

  if (!active.length) return 0;

  const totalWeight = active.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  const total = active.reduce(
    (sum, item) => sum + (scores[item.criterion.id] ?? 0) * item.weight,
    0,
  );

  return Number((total / totalWeight).toFixed(6));
}

export async function runBenchmarkCase(input: {
  prompt: EvaluationPromptVersion;
  benchmark: EvaluatableBenchmarkCase;
  criteria: EvaluationCriterion[];
  weightOverrides?: Record<string, number>;
  execute: BenchmarkExecutor;
  score: BenchmarkScorer;
}): Promise<BenchmarkEvaluationResult> {
  const criteriaByRequiredId = new Map(input.criteria.map((criterion) => [criterion.id, criterion]));
  const missingCriteria = input.benchmark.criterionIds.filter((criterionId) => !criteriaByRequiredId.has(criterionId));
  if (missingCriteria.length) {
    throw new Error(`Missing evaluation criteria: ${missingCriteria.join(", ")}`);
  }
  const allowedCriteria = input.benchmark.criterionIds.map((criterionId) => criteriaByRequiredId.get(criterionId)!);
  const actualOutput = await input.execute({
    prompt: input.prompt,
    benchmark: input.benchmark,
  });
  const scores = await input.score({
    prompt: input.prompt,
    benchmark: input.benchmark,
    criteria: allowedCriteria,
    actualOutput,
  });
  const validationErrors = validateEvaluationScores(scores, allowedCriteria);
  if (validationErrors.length) {
    throw new Error(`Invalid evaluation scores: ${validationErrors.join("; ")}`);
  }

  return {
    actualOutput,
    scores,
    overallScore: aggregateEvaluationScore(scores, allowedCriteria, input.weightOverrides),
  };
}

export async function runBenchmarkSuite(input: {
  prompt: EvaluationPromptVersion;
  benchmarks: EvaluatableBenchmarkCase[];
  criteria: EvaluationCriterion[];
  execute: BenchmarkExecutor;
  score: BenchmarkScorer;
}): Promise<BenchmarkSuiteResult> {
  const caseResults: BenchmarkSuiteCaseResult[] = [];
  const failedCases: BenchmarkSuiteFailure[] = [];

  for (const benchmark of input.benchmarks) {
    try {
      const result = await runBenchmarkCase({
        prompt: input.prompt,
        benchmark,
        criteria: input.criteria,
        weightOverrides: benchmark.weightOverrides,
        execute: input.execute,
        score: input.score,
      });
      caseResults.push({ benchmarkId: benchmark.id, ...result });
    } catch (error) {
      failedCases.push({
        benchmarkId: benchmark.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const averageScore = caseResults.length
    ? Number((caseResults.reduce((sum, item) => sum + item.overallScore, 0) / caseResults.length).toFixed(6))
    : 0;

  return { caseResults, failedCases, averageScore };
}

export function compareEvaluationRuns(
  older: Pick<EvaluationRun, "scores">,
  newer: Pick<EvaluationRun, "scores">,
): EvaluationComparison {
  const keys = new Set([...Object.keys(older.scores), ...Object.keys(newer.scores)]);
  const deltas: Record<string, number> = {};
  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const key of [...keys].sort()) {
    const olderScore = Number(older.scores[key] ?? 0);
    const newerScore = Number(newer.scores[key] ?? 0);
    const delta = Number((newerScore - olderScore).toFixed(6));
    deltas[key] = delta;
    if (delta < 0) regressions.push(key);
    if (delta > 0) improvements.push(key);
  }

  return { deltas, regressions, improvements };
}

export function weightedScore(scores: Record<string, number>, criteria: EvaluationCriterion[]): number {
  return aggregateEvaluationScore(scores, criteria);
}

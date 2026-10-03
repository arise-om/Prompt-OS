"use server";

import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import { getAccessiblePromptVersionById } from "../../lib/evaluation-lab-repository";
import {
  runSystemBenchmarkCase,
  runSystemBenchmarkSuite,
} from "../../lib/evaluation-repository";
import { createConfiguredOpenAIResponsesAdapter } from "../../lib/openai-responses-adapter";

function value(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function requireEvaluationPrompt(form: FormData) {
  if (!hasSupabaseConfig()) redirect("/evaluations?status=not_configured");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login?next=/evaluations");

  const promptVersionId = value(form, "promptVersionId");
  const promptId = value(form, "promptId");
  if (!promptVersionId || !promptId) {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&status=missing_selection`);
  }

  const prompt = await getAccessiblePromptVersionById(promptVersionId);
  if (!prompt || prompt.promptId !== promptId) {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&status=version_missing`);
  }

  return { prompt, promptId, promptVersionId };
}

export async function runEvaluation(form: FormData) {
  const { prompt, promptId, promptVersionId } = await requireEvaluationPrompt(form);
  const benchmarkCaseId = value(form, "benchmarkCaseId");
  if (!benchmarkCaseId) {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&status=missing_selection`);
  }

  let result: Awaited<ReturnType<typeof runSystemBenchmarkCase>>;
  try {
    const adapter = createConfiguredOpenAIResponsesAdapter();
    result = await runSystemBenchmarkCase({
      prompt,
      benchmarkCaseId,
      execute: adapter.createBenchmarkExecutor(),
      score: adapter.createBenchmarkScorer(),
    });
  } catch {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&benchmarkCaseId=${encodeURIComponent(benchmarkCaseId)}&status=model_failed`);
  }

  if (!result) {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&benchmarkCaseId=${encodeURIComponent(benchmarkCaseId)}&status=evaluation_failed`);
  }

  redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&benchmarkCaseId=${encodeURIComponent(benchmarkCaseId)}&status=completed`);
}

export async function runEvaluationSuite(form: FormData) {
  const { prompt, promptId, promptVersionId } = await requireEvaluationPrompt(form);

  let result: Awaited<ReturnType<typeof runSystemBenchmarkSuite>>;
  try {
    const adapter = createConfiguredOpenAIResponsesAdapter();
    result = await runSystemBenchmarkSuite({
      prompt,
      execute: adapter.createBenchmarkExecutor(),
      score: adapter.createBenchmarkScorer(),
    });
  } catch {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&status=model_failed`);
  }

  if (!result) {
    redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&status=evaluation_failed`);
  }

  const status = result.failedCases.length ? "suite_partial" : "suite_completed";
  redirect(`/evaluations?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersionId)}&status=${status}&failed=${result.failedCases.length}`);
}

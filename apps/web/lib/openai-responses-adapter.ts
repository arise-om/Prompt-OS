import type { BenchmarkCase, EvaluationCriterion } from "@prompt-os/shared-types";
import type { WorkflowStepExecutor, WorkflowToolCapability } from "@prompt-os/workflow-core";
import type { BenchmarkExecutor, BenchmarkScorer, EvaluationPromptVersion } from "@prompt-os/evaluation-core";

interface ResponsesAdapterOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  toolCapabilityResolver?: (step: { type: string; config: Record<string, unknown> }) => WorkflowToolCapability | undefined;
}

interface OpenAIResponse {
  output_text?: unknown;
  output?: Array<{
    type?: unknown;
    content?: Array<{
      type?: unknown;
      text?: unknown;
      annotations?: Array<{ type?: unknown; url?: unknown; title?: unknown }>;
    }>;
  }>;
}

interface WebSearchSource {
  url: string;
  title?: string;
}

function extractWebSearchSources(payload: OpenAIResponse): WebSearchSource[] {
  const seen = new Set<string>();
  const sources: WebSearchSource[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type !== "url_citation" || typeof annotation.url !== "string" || seen.has(annotation.url)) continue;
        seen.add(annotation.url);
        sources.push({
          url: annotation.url,
          ...(typeof annotation.title === "string" ? { title: annotation.title } : {}),
        });
      }
    }
  }
  return sources;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractOutputText(payload: OpenAIResponse): string {
  if (typeof payload.output_text === "string") return payload.output_text;

  const parts = (payload.output ?? []).flatMap((item) => item.content ?? []);
  const text = parts
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
  if (text) return text;

  throw new Error("OpenAI response did not contain output text");
}

export function parseScoringJson(value: string): Record<string, number> {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Model scoring response was not valid JSON");
  }

  if (!isRecord(parsed)) throw new Error("Model scoring response must be a JSON object");

  const scores: Record<string, number> = {};
  for (const [key, score] of Object.entries(parsed)) {
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error("Model criterion scores must be numbers");
    }
    scores[key] = score;
  }
  return scores;
}

export interface OpenAIResponsesAdapter {
  generateText(input: string): Promise<string>;
  createBenchmarkExecutor(): BenchmarkExecutor;
  createBenchmarkScorer(): BenchmarkScorer;
  createWorkflowStepExecutor(): WorkflowStepExecutor;
}

export function createOpenAIResponsesAdapter(options: ResponsesAdapterOptions): OpenAIResponsesAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1/responses";
  const resolveToolCapability = options.toolCapabilityResolver ?? (() => undefined);

  async function requestResponse(input: string, tools?: Array<Record<string, unknown>>): Promise<OpenAIResponse> {
    if (!options.apiKey.trim()) throw new Error("OPENAI_API_KEY is not configured");
    const response = await fetchImpl(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        ...(tools?.length ? { tools } : {}),
        input: [{ role: "user", content: input }],
      }),
    });

    const payload = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${payload.error?.message ?? `HTTP ${response.status}`}`);
    }
    return payload;
  }

  async function generateText(input: string): Promise<string> {
    return extractOutputText(await requestResponse(input));
  }

  return {
    generateText,
    createBenchmarkExecutor: () => async ({ prompt, benchmark }) =>
      generateText(buildExecutionInput(prompt, benchmark)),
    createBenchmarkScorer: () => async ({ prompt, benchmark, criteria, actualOutput }) =>
      parseScoringJson(await generateText(buildScoringInput(prompt, benchmark, criteria, actualOutput))),
    createWorkflowStepExecutor: () => async ({ workflow, step, data }) => {
      const capability = resolveToolCapability(step);
      const isWebSearch = capability?.id === "web_search";
      if (step.type === "tool" && !capability) {
        throw new Error("WORKFLOW_TOOL_UNSUPPORTED: no tool adapter is configured for this workflow step");
      }

      if (!isWebSearch) {
        const text = await generateText(buildWorkflowStepInput(workflow, step, data));
        return parseWorkflowOutputJson(text, step.outputKeys);
      }

      const searchContextSize = step.config.searchContextSize === "medium" || step.config.searchContextSize === "high"
        ? step.config.searchContextSize
        : "low";
      const payload = await requestResponse(
        buildWorkflowStepInput(workflow, step, data),
        [{ type: "web_search", search_context_size: searchContextSize }],
      );
      const parsed = parseWorkflowOutputJson(extractOutputText(payload), step.outputKeys);
      const sources = extractWebSearchSources(payload);
      if (sources.length && step.outputKeys.length === 1) {
        const key = step.outputKeys[0];
        parsed[key] = { value: parsed[key], sources };
      }
      if (!step.outputKeys.includes("sources")) delete parsed.sources;
      return parsed;
    },
  };
}

export function createConfiguredOpenAIResponsesAdapter(options: Pick<ResponsesAdapterOptions, "toolCapabilityResolver"> = {}): OpenAIResponsesAdapter {
  return createOpenAIResponsesAdapter({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    ...options,
  });
}

function buildExecutionInput(prompt: EvaluationPromptVersion, benchmark: BenchmarkCase): string {
  return [
    "You are executing a benchmark for Prompt OS.",
    "Use the saved prompt exactly as the task instruction.",
    "Return only the answer that the saved prompt should produce; do not describe the evaluation.",
    `\nSAVED PROMPT (v${prompt.version}):\n${prompt.body}`,
    `\nBENCHMARK INPUT:\n${JSON.stringify(benchmark.input, null, 2)}`,
  ].join("\n");
}

function buildScoringInput(
  prompt: EvaluationPromptVersion,
  benchmark: BenchmarkCase,
  criteria: EvaluationCriterion[],
  actualOutput: unknown,
): string {
  const rubric = criteria.map((criterion) => ({
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    weight: criterion.weight,
    scoring: criterion.scoring,
  }));

  return [
    "You are the scoring judge for a Prompt OS benchmark.",
    "Score the output against each supplied criterion.",
    "Return ONLY a JSON object mapping criterion IDs to numeric scores from 0 to 100.",
    "For binary criteria, return exactly 0 or 100.",
    "Do not include an overall score and do not include explanations.",
    `\nSAVED PROMPT (v${prompt.version}):\n${prompt.body}`,
    `\nBENCHMARK INPUT:\n${JSON.stringify(benchmark.input, null, 2)}`,
    `\nEXPECTED CHARACTERISTICS:\n${JSON.stringify(benchmark.expectedCharacteristics, null, 2)}`,
    benchmark.goldenOutput !== undefined
      ? `\nGOLDEN OUTPUT:\n${JSON.stringify(benchmark.goldenOutput, null, 2)}`
      : "",
    `\nCRITERIA:\n${JSON.stringify(rubric, null, 2)}`,
    `\nACTUAL OUTPUT:\n${JSON.stringify(actualOutput, null, 2)}`,
  ].filter(Boolean).join("\n");
}


function parseWorkflowOutputJson(value: string, outputKeys: string[]): Record<string, unknown> {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Workflow step response was not valid JSON");
  }
  if (!isRecord(parsed)) throw new Error("Workflow step response must be a JSON object");
  for (const key of outputKeys) {
    if (!(key in parsed)) throw new Error(`Workflow step response is missing output key: ${key}`);
  }
  return parsed;
}

function buildWorkflowStepInput(
  workflow: { id: string; name: string; version: string },
  step: { type: string; name: string; purpose: string; inputKeys: string[]; outputKeys: string[]; config: Record<string, unknown> },
  data: Record<string, unknown>,
): string {
  return [
    "You are executing one typed step inside a Prompt OS workflow.",
    "Follow the step purpose exactly and use only the supplied workflow data.",
    "Return ONLY a JSON object containing every declared output key.",
    `WORKFLOW: ${workflow.name} (v${workflow.version})`,
    `STEP TYPE: ${step.type}`,
    `STEP NAME: ${step.name}`,
    `STEP PURPOSE: ${step.purpose}`,
    `INPUT KEYS: ${JSON.stringify(step.inputKeys)}`,
    `OUTPUT KEYS: ${JSON.stringify(step.outputKeys)}`,
    `STEP CONFIG: ${JSON.stringify(step.config, null, 2)}`,
    `CURRENT DATA: ${JSON.stringify(data, null, 2)}`,
  ].join("\n");
}

import type { PromptDefinition, PromptComponent, PromptAuditFinding, PromptAuditResult } from "@prompt-os/shared-types";
export type { PromptAuditFinding, PromptAuditResult } from "@prompt-os/shared-types";

export function normalizePromptInput(input: string): string {
  return input.trim().replace(/\r\n/g, "\n");
}

export function hasPromptBody(prompt: Pick<PromptDefinition, "body">): boolean {
  return normalizePromptInput(prompt.body).length >= 10;
}

export function composePrompt(
  components: PromptComponent[],
  body: string,
): string {
  const blocks = components
    .map((component) => normalizePromptInput(component.body))
    .filter(Boolean);
  const base = normalizePromptInput(body);
  return [...blocks, base].filter(Boolean).join("\n\n");
}

export function filterPrompts(prompts: PromptDefinition[], query: string): PromptDefinition[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return prompts;

  return prompts.filter((prompt) => {
    const haystack = [
      prompt.name,
      prompt.description,
      prompt.intent,
      prompt.domain,
      ...prompt.tags,
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(normalized);
  });
}

export function getPromptById(prompts: PromptDefinition[], id: string): PromptDefinition | null {
  return prompts.find((prompt) => prompt.id === id) ?? null;
}

export interface PromptAuditInput {
  body?: string;
  goal?: string;
  context?: string;
  inputs?: string;
  constraints?: string;
  audience?: string;
  output?: string;
  quality?: string;
  verification?: string;
  variables?: string[];
}

const auditSections = [
  ["goal", "A clear objective is missing.", "State the concrete outcome the model must produce."] as const,
  ["context", "Relevant context is missing.", "Describe the source material, operating context, or facts the model should use."] as const,
  ["inputs", "Expected inputs are missing.", "List the inputs, variables, files, or data the prompt expects."] as const,
  ["constraints", "Constraints are missing.", "Add boundaries such as evidence rules, scope, length, or prohibited behavior."] as const,
  ["audience", "The target audience is missing.", "Specify who will consume or act on the output."] as const,
  ["output", "The required output format is missing.", "Define the structure, format, and level of detail expected from the result."] as const,
  ["quality", "Quality criteria are missing.", "State how a good answer should be judged."] as const,
  ["verification", "A verification step is missing.", "Tell the model how to check claims, calculations, constraints, or completeness before finalizing."] as const,
] as const;

function addFinding(
  findings: PromptAuditFinding[],
  code: string,
  severity: PromptAuditFinding["severity"],
  message: string,
  remediation: string,
) {
  findings.push({ code, severity, message, remediation });
}

export function auditPrompt(input: PromptAuditInput): PromptAuditResult {
  const findings: PromptAuditFinding[] = [];
  const missingSections: string[] = [];

  for (const [section, message, remediation] of auditSections) {
    if (!normalizePromptInput(input[section] ?? "")) {
      missingSections.push(section);
      addFinding(findings, `MISSING_${section.toUpperCase()}`, "warning", message, remediation);
    }
  }

  const body = normalizePromptInput(input.body ?? "");
  if (body.length < 10) {
    addFinding(
      findings,
      "BODY_TOO_SHORT",
      "critical",
      "The executable prompt body is too short to reliably communicate the task.",
      "Write a complete instruction that reflects the structured fields and expected behavior.",
    );
  }

  const variables = new Set((input.variables ?? []).map((item) => item.trim()).filter(Boolean));
  const referencedVariables = [...body.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1].trim());
  for (const variable of new Set(referencedVariables)) {
    if (!variables.has(variable)) {
      addFinding(
        findings,
        "UNRESOLVED_VARIABLE",
        "warning",
        `The prompt references "{{${variable}}}" but it is not defined as an input variable.`,
        `Add "${variable}" to the input variables or remove the placeholder.`,
      );
    }
  }

  const ambiguousMatches = body.match(/\b(etc\.?|as needed|appropriate|make it good|something like)\b/gi) ?? [];
  if (ambiguousMatches.length) {
    addFinding(
      findings,
      "AMBIGUOUS_LANGUAGE",
      "warning",
      `The prompt contains ${ambiguousMatches.length} ambiguous phrase${ambiguousMatches.length === 1 ? "" : "s"}.`,
      "Replace vague wording with observable requirements, thresholds, examples, or explicit decision rules.",
    );
  }

  const severeCount = findings.filter((finding) => finding.severity === "critical").length;
  const scorePenalty = (missingSections.length * 9)
    + (severeCount * 18)
    + (findings.filter((finding) => finding.code === "UNRESOLVED_VARIABLE").length * 7)
    + (findings.filter((finding) => finding.code === "AMBIGUOUS_LANGUAGE").length * 5);

  return {
    score: Math.max(0, Math.min(100, 100 - scorePenalty)),
    findings,
    missingSections,
  };
}

export function createPromptAuditSnapshot(result: PromptAuditResult): PromptAuditResult {
  return {
    score: result.score,
    findings: result.findings.map((finding) => ({ ...finding })),
    missingSections: [...result.missingSections],
  };
}

export interface PromptComposerDraft {
  instructions?: string;
  goal?: string;
  context?: string;
  inputs?: string;
  constraints?: string;
  audience?: string;
  output?: string;
  quality?: string;
  verification?: string;
}

const composerSections = [
  ["Instructions", "instructions"],
  ["Goal", "goal"],
  ["Context", "context"],
  ["Inputs", "inputs"],
  ["Constraints", "constraints"],
  ["Audience", "audience"],
  ["Output", "output"],
  ["Quality criteria", "quality"],
  ["Verification", "verification"],
] as const;

export function composePromptDraft(draft: PromptComposerDraft): string {
  return composerSections
    .map(([heading, key]) => {
      const value = normalizePromptInput(draft[key] ?? "");
      return value ? `## ${heading}\n${value}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export type PromptVersionDiffLine =
  | { type: "context"; text: string; oldLine: number; newLine: number }
  | { type: "added"; text: string; newLine: number }
  | { type: "removed"; text: string; oldLine: number };

export interface PromptVersionDiff {
  lines: PromptVersionDiffLine[];
  added: number;
  removed: number;
  unchanged: number;
}

function promptLines(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized ? normalized.split("\n") : [];
}

export function comparePromptVersions(oldBody: string, newBody: string): PromptVersionDiff {
  const oldLines = promptLines(oldBody);
  const newLines = promptLines(newBody);
  const rows = oldLines.length + 1;
  const cols = newLines.length + 1;
  const lcs = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lcs[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lcs[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][newIndex], lcs[oldIndex][newIndex + 1]);
    }
  }

  const lines: PromptVersionDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      lines.push({ type: "context", text: oldLines[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    const keepOld = oldIndex < oldLines.length ? lcs[oldIndex + 1][newIndex] : -1;
    const keepNew = newIndex < newLines.length ? lcs[oldIndex][newIndex + 1] : -1;
    if (oldIndex < oldLines.length && (newIndex >= newLines.length || keepOld >= keepNew)) {
      lines.push({ type: "removed", text: oldLines[oldIndex], oldLine: oldIndex + 1 });
      oldIndex += 1;
    } else {
      lines.push({ type: "added", text: newLines[newIndex], newLine: newIndex + 1 });
      newIndex += 1;
    }
  }

  return {
    lines,
    added: lines.filter((line) => line.type === "added").length,
    removed: lines.filter((line) => line.type === "removed").length,
    unchanged: lines.filter((line) => line.type === "context").length,
  };
}

export function nextMinorVersion(current: string): string {
  const match = current.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "1.0.0";
  return `${Number(match[1])}.${Number(match[2]) + 1}.0`;
}

export function parsePromptDraft(body: string): Required<PromptComposerDraft> {
  const keys: Record<string, keyof PromptComposerDraft> = {
    Instructions: "instructions",
    Goal: "goal",
    Context: "context",
    Inputs: "inputs",
    Constraints: "constraints",
    Audience: "audience",
    Output: "output",
    "Quality criteria": "quality",
    Verification: "verification",
  };
  const result: Required<PromptComposerDraft> = {
    instructions: "", goal: "", context: "", inputs: "", constraints: "",
    audience: "", output: "", quality: "", verification: "",
  };
  const sections = body.split(/^##\s+(.+)\s*$/m);
  let recognizedSection = false;
  for (let index = 1; index < sections.length; index += 2) {
    const key = keys[sections[index].trim()];
    if (key) {
      recognizedSection = true;
      result[key] = normalizePromptInput(sections[index + 1] ?? "");
    }
  }
  if (!recognizedSection) result.instructions = normalizePromptInput(body);
  return result;
}

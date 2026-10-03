import type { Database, Json } from "@prompt-os/db-types";
import type { PromptAuditFinding, PromptAuditResult, PromptDefinition } from "@prompt-os/shared-types";

type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];
type PromptVersionRow = Database["public"]["Tables"]["prompt_versions"]["Row"];

export type SystemPromptRecord = Pick<
  PromptRow,
  "id" | "name" | "description" | "intent" | "complexity" | "status" | "is_system" | "tags" | "domain_id"
> & {
  domainSlug: string;
  latest?: PromptVersionRow;
};

function stringArray(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function promptAuditResult(
  score: number | null | undefined,
  findingsValue: Json | null | undefined,
  missingSectionsValue: Json | null | undefined,
): PromptAuditResult | undefined {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) return undefined;

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

  return {
    score: Math.min(Math.max(Number(score), 0), 100),
    findings,
    missingSections: stringArray(missingSectionsValue),
  };
}

function promptStatus(value: string): PromptDefinition["status"] {
  const allowed: PromptDefinition["status"][] = [
    "draft",
    "experimental",
    "tested",
    "validated",
    "production",
    "deprecated",
    "archived",
  ];
  return allowed.includes(value as PromptDefinition["status"])
    ? value as PromptDefinition["status"]
    : "draft";
}

export function mapSystemPromptRecord(prompt: SystemPromptRecord): PromptDefinition {
  return {
    id: prompt.id,
    name: prompt.name,
    description: prompt.description ?? "",
    intent: prompt.intent,
    domain: prompt.domainSlug,
    complexity: Math.min(Math.max(Number(prompt.complexity) || 1, 1), 5) as PromptDefinition["complexity"],
    status: promptStatus(prompt.status),
    isSystem: true,
    version: prompt.latest?.version ?? "1.0.0",
    body: prompt.latest?.body ?? "",
    variables: stringArray(prompt.latest?.variables),
    requiredContext: stringArray(prompt.latest?.required_context),
    optionalContext: stringArray(prompt.latest?.optional_context),
    constraints: stringArray(prompt.latest?.constraints),
    expectedOutput: prompt.latest?.expected_output ?? "",
    evaluationCriteria: stringArray(prompt.latest?.evaluation_criteria),
    benchmarkCaseIds: [],
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    promptAudit: promptAuditResult(
      prompt.latest?.audit_score,
      prompt.latest?.audit_findings,
      prompt.latest?.audit_missing_sections,
    ),
  };
}

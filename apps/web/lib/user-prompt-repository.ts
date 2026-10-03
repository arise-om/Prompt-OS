import type { Database, Json } from "@prompt-os/db-types";
import type { PromptAuditFinding, PromptAuditResult, PromptDefinition } from "@prompt-os/shared-types";
import { createClient } from "./supabase/server";

type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];
type PromptVersionRow = Database["public"]["Tables"]["prompt_versions"]["Row"];
type DomainRow = Database["public"]["Tables"]["domains"]["Row"];
type PromptRecord = Pick<PromptRow, "id" | "name" | "description" | "intent" | "complexity" | "status" | "is_system" | "tags" | "domain_id">;
type PromptWithLatest = PromptRecord & { domainSlug: string; latest?: PromptVersionRow };

const promptVersionSelect = "id,prompt_id,version,body,variables,required_context,optional_context,constraints,expected_output,evaluation_criteria,created_at,parent_version_id,change_summary,audit_score,audit_findings,audit_missing_sections" as const;

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

function mapUserPrompt(prompt: PromptWithLatest): PromptDefinition {
  return {
    id: prompt.id,
    name: prompt.name,
    description: prompt.description ?? "",
    intent: prompt.intent,
    domain: prompt.domainSlug,
    complexity: Math.min(Math.max(Number(prompt.complexity) || 1, 1), 5) as PromptDefinition["complexity"],
    status: promptStatus(prompt.status),
    isSystem: false,
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

async function getCurrentUserPromptRows(id?: string): Promise<PromptWithLatest[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  let query = supabase
    .from("prompts")
    .select("id,name,description,intent,complexity,status,is_system,tags,domain_id")
    .eq("owner_user_id", userId)
    .eq("is_system", false)
    .order("updated_at", { ascending: false });

  if (id) query = query.eq("id", id);

  const { data: promptRows, error: promptError } = await query;
  if (promptError || !promptRows) return [];
  if (!promptRows.length) return [];

  const promptIds = promptRows.map((prompt) => prompt.id);
  const domainIds = [...new Set(promptRows.map((prompt) => prompt.domain_id).filter((value): value is string => Boolean(value)))];

  const [{ data: versionRows }, { data: domainRows }] = await Promise.all([
    supabase
      .from("prompt_versions")
      .select(promptVersionSelect)
      .in("prompt_id", promptIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    domainIds.length
      ? supabase.from("domains").select("id,slug").in("id", domainIds)
      : Promise.resolve({ data: [] as Pick<DomainRow, "id" | "slug">[] }),
  ]);

  const latestByPromptId = new Map<string, PromptVersionRow>();
  for (const version of versionRows ?? []) {
    if (!latestByPromptId.has(version.prompt_id)) latestByPromptId.set(version.prompt_id, version);
  }

  const domainById = new Map((domainRows ?? []).map((domain) => [domain.id, domain.slug]));

  return promptRows.map((prompt) => ({
    ...prompt,
    domainSlug: domainById.get(prompt.domain_id ?? "") ?? "general",
    latest: latestByPromptId.get(prompt.id),
  }));
}

export async function getCurrentUserPrompts(): Promise<PromptDefinition[]> {
  const rows = await getCurrentUserPromptRows();
  return rows.map(mapUserPrompt);
}

export async function getCurrentUserPromptById(id: string): Promise<PromptDefinition | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const rows = await getCurrentUserPromptRows(normalizedId);
  return rows[0] ? mapUserPrompt(rows[0]) : null;
}
export interface PromptVersionHistoryEntry {
  id: string;
  version: string;
  createdAt: string;
  parentVersionId: string | null;
  changeSummary: string;
  auditScore: number | null;
  auditFindingCount: number;
}

export interface PromptVersionContent {
  id: string;
  version: string;
  createdAt: string;
  parentVersionId: string | null;
  changeSummary: string;
  body: string;
}

export interface PromptVersionComparison {
  from: PromptVersionContent;
  to: PromptVersionContent;
}

export async function getCurrentUserPromptVersionComparison(
  promptId: string,
  fromVersionId: string,
  toVersionId: string,
): Promise<PromptVersionComparison | null> {
  const normalizedPromptId = promptId.trim();
  const normalizedFromVersionId = fromVersionId.trim();
  const normalizedToVersionId = toVersionId.trim();
  if (!normalizedPromptId || !normalizedFromVersionId || !normalizedToVersionId || normalizedFromVersionId === normalizedToVersionId) {
    return null;
  }

  const prompt = await getCurrentUserPromptById(normalizedPromptId);
  if (!prompt) return null;

  const supabase = await createClient();
  const { data: versions, error } = await supabase
    .from("prompt_versions")
    .select("id,version,body,created_at,parent_version_id,change_summary")
    .eq("prompt_id", normalizedPromptId)
    .in("id", [normalizedFromVersionId, normalizedToVersionId]);

  if (error || !versions || versions.length !== 2) return null;

  const byId = new Map(versions.map((version) => [version.id, version]));
  const from = byId.get(normalizedFromVersionId);
  const to = byId.get(normalizedToVersionId);
  if (!from || !to) return null;

  return {
    from: {
      id: from.id,
      version: from.version,
      createdAt: from.created_at,
      parentVersionId: from.parent_version_id,
      changeSummary: from.change_summary ?? "No change summary recorded.",
      body: from.body,
    },
    to: {
      id: to.id,
      version: to.version,
      createdAt: to.created_at,
      parentVersionId: to.parent_version_id,
      changeSummary: to.change_summary ?? "No change summary recorded.",
      body: to.body,
    },
  };
}

export async function getCurrentUserPromptVersions(promptId: string): Promise<PromptVersionHistoryEntry[]> {
  const prompt = await getCurrentUserPromptById(promptId);
  if (!prompt) return [];

  const supabase = await createClient();
  const { data: versions, error } = await supabase
    .from("prompt_versions")
    .select("id,version,created_at,parent_version_id,change_summary,audit_score,audit_findings")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error || !versions) return [];
  return versions.map((version) => ({
    id: version.id,
    version: version.version,
    createdAt: version.created_at,
    parentVersionId: version.parent_version_id,
    changeSummary: version.change_summary ?? "No change summary recorded.",
    auditScore: version.audit_score,
    auditFindingCount: Array.isArray(version.audit_findings) ? version.audit_findings.length : 0,
  }));
}

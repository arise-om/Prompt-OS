import type { Database, Json } from "@prompt-os/db-types";
import type { EvaluationRun, PromptAuditResult } from "@prompt-os/shared-types";
import { createClient } from "./supabase/server";
import { getSystemPromptById } from "./prompt-repository";
import { getCurrentUserPromptById } from "./user-prompt-repository";
import { getSystemBenchmarkById } from "./evaluation-catalog-repository";

export interface AccessiblePromptVersion {
  id: string;
  promptId: string;
  promptName: string;
  version: string;
  body: string;
  createdAt: string;
  auditScore: number | null;
  audit: PromptAuditResult | undefined;
}

export interface EvaluationRunRecord extends EvaluationRun {
  createdAt: string;
}

function auditFromJson(score: number | null, snapshot: Json | null): PromptAuditResult | undefined {
  if (score === null || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined;
  const record = snapshot as Record<string, Json | undefined>;
  const findingsValue = record.findings;
  const missingValue = record.missingSections;
  const findings = Array.isArray(findingsValue)
    ? findingsValue.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const finding = item as Record<string, unknown>;
        if (
          typeof finding.code !== "string" ||
          (finding.severity !== "info" && finding.severity !== "warning" && finding.severity !== "critical") ||
          typeof finding.message !== "string" ||
          typeof finding.remediation !== "string"
        ) return [];
        return [{
          code: finding.code,
          severity: finding.severity,
          message: finding.message,
          remediation: finding.remediation,
        }];
      })
    : [];
  return {
    score: Math.min(Math.max(Number(score), 0), 100),
    findings,
    missingSections: Array.isArray(missingValue)
      ? missingValue.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function getAccessiblePromptVersionById(id: string): Promise<AccessiblePromptVersion | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const supabase = await createClient();
  const { data: version, error } = await supabase
    .from("prompt_versions")
    .select("id,prompt_id,version,body,created_at,audit_score,audit_findings,audit_missing_sections")
    .eq("id", normalizedId)
    .maybeSingle();
  if (error || !version) return null;

  const systemPrompt = await getSystemPromptById(version.prompt_id);
  const userPrompt = systemPrompt ? null : await getCurrentUserPromptById(version.prompt_id);
  const promptName = systemPrompt?.name ?? userPrompt?.name;
  if (!promptName) return null;

  const snapshot = version.audit_score === null
    ? null
    : {
        score: version.audit_score,
        findings: version.audit_findings,
        missingSections: version.audit_missing_sections,
      } as Json;

  return {
    id: version.id,
    promptId: version.prompt_id,
    promptName,
    version: version.version,
    body: version.body,
    createdAt: version.created_at,
    auditScore: version.audit_score,
    audit: auditFromJson(version.audit_score, snapshot),
  };
}

export async function getAccessiblePromptVersions(promptId: string): Promise<AccessiblePromptVersion[]> {
  const normalizedId = promptId.trim();
  if (!normalizedId) return [];

  const prompt = await getSystemPromptById(normalizedId) ?? await getCurrentUserPromptById(normalizedId);
  if (!prompt) return [];

  const supabase = await createClient();
  const { data: versions, error } = await supabase
    .from("prompt_versions")
    .select("id,prompt_id,version,body,created_at,audit_score,audit_findings,audit_missing_sections")
    .eq("prompt_id", normalizedId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error || !versions) return [];

  return versions.map((version) => ({
    id: version.id,
    promptId: version.prompt_id,
    promptName: prompt.name,
    version: version.version,
    body: version.body,
    createdAt: version.created_at,
    auditScore: version.audit_score,
    audit: auditFromJson(version.audit_score, {
      score: version.audit_score,
      findings: version.audit_findings,
      missingSections: version.audit_missing_sections,
    } as Json),
  }));
}

export async function getEvaluationRunsForPromptVersion(
  promptVersionId: string,
): Promise<EvaluationRunRecord[]> {
  const normalizedId = promptVersionId.trim();
  if (!normalizedId) return [];

  const supabase = await createClient();
  const { data: runs, error } = await supabase
    .from("evaluation_runs")
    .select("id,prompt_version_id,workflow_id,benchmark_case_id,actual_output,scores,failure_codes,reviewer_notes,created_at,prompt_audit_snapshot")
    .eq("prompt_version_id", normalizedId)
    .order("created_at", { ascending: false });
  if (error || !runs) return [];

  return runs.map((run) => ({
    id: run.id,
    promptVersionId: run.prompt_version_id ?? undefined,
    workflowId: run.workflow_id ?? undefined,
    benchmarkCaseId: run.benchmark_case_id ?? undefined,
    actualOutput: run.actual_output,
    scores: isNumberRecord(run.scores) ? run.scores : {},
    failures: run.failure_codes,
    reviewerNotes: run.reviewer_notes ?? undefined,
    promptAudit: run.prompt_audit_snapshot
      ? restoreRunAudit(run.prompt_audit_snapshot)
      : undefined,
    createdAt: run.created_at,
  }));
}

export async function getEvaluationRunsForPrompt(
  promptId: string,
  benchmarkCaseId: string,
): Promise<EvaluationRunRecord[]> {
  const versions = await getAccessiblePromptVersions(promptId);
  if (!versions.length) return [];

  const supabase = await createClient();
  const { data: runs, error } = await supabase
    .from("evaluation_runs")
    .select("id,prompt_version_id,workflow_id,benchmark_case_id,actual_output,scores,failure_codes,reviewer_notes,created_at,prompt_audit_snapshot")
    .eq("benchmark_case_id", benchmarkCaseId)
    .in("prompt_version_id", versions.map((version) => version.id))
    .order("created_at", { ascending: false });
  if (error || !runs) return [];

  return runs.map((run) => ({
    id: run.id,
    promptVersionId: run.prompt_version_id ?? undefined,
    workflowId: run.workflow_id ?? undefined,
    benchmarkCaseId: run.benchmark_case_id ?? undefined,
    actualOutput: run.actual_output,
    scores: isNumberRecord(run.scores) ? run.scores : {},
    failures: run.failure_codes,
    reviewerNotes: run.reviewer_notes ?? undefined,
    promptAudit: run.prompt_audit_snapshot
      ? restoreRunAudit(run.prompt_audit_snapshot)
      : undefined,
    createdAt: run.created_at,
  }));
}

function isNumberRecord(value: Json): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, item]) => key === "overall" || typeof item === "number");
}

function restoreRunAudit(value: Json): PromptAuditResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, Json | undefined>;
  const score = record.score;
  if (typeof score !== "number") return undefined;
  const findings = Array.isArray(record.findings)
    ? record.findings.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const finding = item as Record<string, unknown>;
        if (
          typeof finding.code !== "string" ||
          (finding.severity !== "info" && finding.severity !== "warning" && finding.severity !== "critical") ||
          typeof finding.message !== "string" ||
          typeof finding.remediation !== "string"
        ) return [];
        return [{
          code: finding.code,
          severity: finding.severity,
          message: finding.message,
          remediation: finding.remediation,
        }];
      })
    : [];
  return {
    score: Math.min(Math.max(score, 0), 100),
    findings,
    missingSections: Array.isArray(record.missingSections)
      ? record.missingSections.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function getEvaluationBenchmarkForLab(id: string) {
  return getSystemBenchmarkById(id);
}

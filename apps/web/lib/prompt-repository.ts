import { filterPrompts, getPromptById } from "@prompt-os/prompt-core";
import type { Database } from "@prompt-os/db-types";
import type { PromptDefinition } from "@prompt-os/shared-types";
import { hasSupabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";
import { mapSystemPromptRecord, type SystemPromptRecord } from "./system-prompt-mapper";

type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];
type PromptVersionRow = Database["public"]["Tables"]["prompt_versions"]["Row"];
type DomainRow = Database["public"]["Tables"]["domains"]["Row"];
type PromptRecord = Pick<PromptRow, "id" | "name" | "description" | "intent" | "complexity" | "status" | "is_system" | "tags" | "domain_id">;

const promptVersionSelect = "id,prompt_id,version,body,variables,required_context,optional_context,constraints,expected_output,evaluation_criteria,created_at,parent_version_id,change_summary,audit_score,audit_findings,audit_missing_sections" as const;

async function getSystemPromptRows(): Promise<SystemPromptRecord[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = await createClient();
  const { data: promptRows, error: promptError } = await supabase
    .from("prompts")
    .select("id,name,description,intent,complexity,status,is_system,tags,domain_id")
    .eq("is_system", true)
    .order("name", { ascending: true });

  if (promptError || !promptRows?.length) return [];

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
    ...(prompt as PromptRecord),
    domainSlug: domainById.get(prompt.domain_id ?? "") ?? "general",
    latest: latestByPromptId.get(prompt.id),
  }));
}

export async function getSystemPrompts(query = ""): Promise<PromptDefinition[]> {
  const rows = await getSystemPromptRows();
  return filterPrompts(rows.map(mapSystemPromptRecord), query);
}

export async function getSystemPromptById(id: string): Promise<PromptDefinition | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const prompts = await getSystemPrompts();
  return getPromptById(prompts, normalizedId);
}

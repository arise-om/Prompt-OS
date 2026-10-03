"use server";

import { redirect } from "next/navigation";
import { auditPrompt, composePromptDraft, createPromptAuditSnapshot } from "@prompt-os/prompt-core";
import { getSystemPromptById } from "../../lib/prompt-repository";
import { getCurrentUserPromptById } from "../../lib/user-prompt-repository";
import { hasSupabaseConfig } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

function textValue(form: FormData, key: string, fallback = "") {
  return String(form.get(key) ?? fallback).trim();
}

function jsonArray(value: string): string[] {
  return value ? value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) : [];
}

export async function savePromptDraft(form: FormData) {
  if (!hasSupabaseConfig()) redirect("/login?error=not_configured");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login?next=/builder");

  const editId = textValue(form, "prompt_id");
  const templateId = textValue(form, "template_id");
  const source = editId
    ? await getCurrentUserPromptById(editId)
    : templateId ? await getSystemPromptById(templateId) : null;
  if (!source || (editId && source.isSystem) || (!editId && !source.isSystem)) {
    redirect(editId ? "/library?error=prompt_missing" : "/builder?error=template_missing");
  }

  const name = textValue(form, "name", source.name);
  const description = textValue(form, "description", source.description);
  const draft = {
    instructions: textValue(form, "instructions", source.body),
    goal: textValue(form, "goal"),
    context: textValue(form, "context", source.requiredContext.join("\n")),
    inputs: textValue(form, "inputs", source.variables.map((item) => `{{${item}}}`).join("\n")),
    constraints: textValue(form, "constraints", source.constraints.join("\n")),
    audience: textValue(form, "audience"),
    output: textValue(form, "output", source.expectedOutput),
    quality: textValue(form, "quality", source.evaluationCriteria.join("\n")),
    verification: textValue(form, "verification"),
  };
  const variables = jsonArray(textValue(form, "variables", source.variables.join("\n")));
  const body = composePromptDraft(draft);
  const audit = createPromptAuditSnapshot(auditPrompt({ ...draft, variables, body }));

  if (!name || !body) {
    redirect(editId
      ? `/builder?id=${encodeURIComponent(editId)}&error=missing_fields`
      : `/builder?template=${encodeURIComponent(templateId)}&error=missing_fields`);
  }

  if (editId) {
    const { data: versionId, error } = await supabase.rpc("create_prompt_version", {
      p_prompt_id: editId,
      p_name: name,
      p_description: description,
      p_body: body,
      p_variables: variables,
      p_required_context: jsonArray(draft.context),
      p_optional_context: [],
      p_constraints: jsonArray(draft.constraints),
      p_expected_output: draft.output,
      p_evaluation_criteria: [draft.quality, draft.verification].filter(Boolean),
      p_change_summary: "Updated in Prompt Composer",
      p_audit_score: audit.score,
      p_audit_findings: audit.findings,
      p_audit_missing_sections: audit.missingSections,
    });
    if (error || !versionId) redirect(`/builder?id=${encodeURIComponent(editId)}&error=save_failed`);
    redirect(`/library/${encodeURIComponent(editId)}?version=saved`);
  }

  const { data, error } = await supabase.rpc("create_prompt_clone", {
    p_name: name,
    p_description: description,
    p_intent: source.intent,
    p_domain_slug: source.domain,
    p_complexity: source.complexity,
    p_body: body,
    p_variables: variables,
    p_required_context: jsonArray(draft.context),
    p_optional_context: [],
    p_constraints: jsonArray(draft.constraints),
    p_expected_output: draft.output,
    p_evaluation_criteria: [draft.quality, draft.verification].filter(Boolean),
    p_audit_score: audit.score,
    p_audit_findings: audit.findings,
    p_audit_missing_sections: audit.missingSections,
  });

  if (error || !data) redirect(`/builder?template=${encodeURIComponent(templateId)}&error=save_failed`);
  redirect(`/library?status=saved&saved=${encodeURIComponent(String(data))}`);
}

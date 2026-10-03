-- Persist deterministic Prompt Auditor snapshots with immutable prompt versions.
-- Evaluation runs can optionally retain the same audit state observed at execution time.

alter table public.prompt_versions
  add column if not exists audit_score integer,
  add column if not exists audit_findings jsonb not null default '[]'::jsonb,
  add column if not exists audit_missing_sections jsonb not null default '[]'::jsonb;

alter table public.prompt_versions
  drop constraint if exists prompt_versions_audit_score_check,
  add constraint prompt_versions_audit_score_check
    check (audit_score is null or (audit_score >= 0 and audit_score <= 100)),
  drop constraint if exists prompt_versions_audit_findings_check,
  add constraint prompt_versions_audit_findings_check
    check (jsonb_typeof(audit_findings) = 'array'),
  drop constraint if exists prompt_versions_audit_missing_sections_check,
  add constraint prompt_versions_audit_missing_sections_check
    check (jsonb_typeof(audit_missing_sections) = 'array');

alter table public.evaluation_runs
  add column if not exists prompt_audit_snapshot jsonb,
  drop constraint if exists evaluation_runs_prompt_audit_snapshot_check,
  add constraint evaluation_runs_prompt_audit_snapshot_check
    check (prompt_audit_snapshot is null or jsonb_typeof(prompt_audit_snapshot) = 'object');

-- Keep user prompt versions append-only: audit snapshots are part of the immutable record.
drop policy if exists prompt_versions_update on public.prompt_versions;
drop policy if exists prompt_versions_delete on public.prompt_versions;

-- The RPC signatures changed so old overloads must not remain ambiguous to PostgREST.
drop function if exists public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb);
drop function if exists public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text);

create or replace function public.create_prompt_clone(
  p_name text,
  p_description text,
  p_intent text,
  p_domain_slug text,
  p_complexity integer,
  p_body text,
  p_variables jsonb,
  p_required_context jsonb,
  p_optional_context jsonb,
  p_constraints jsonb,
  p_expected_output text,
  p_evaluation_criteria jsonb,
  p_audit_score integer,
  p_audit_findings jsonb,
  p_audit_missing_sections jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_domain_id uuid;
  v_prompt_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_audit_score is null or p_audit_score < 0 or p_audit_score > 100 then
    raise exception 'audit score must be between 0 and 100';
  end if;
  if jsonb_typeof(p_audit_findings) is distinct from 'array'
    or jsonb_typeof(p_audit_missing_sections) is distinct from 'array' then
    raise exception 'audit snapshot fields must be JSON arrays';
  end if;

  select id into v_domain_id
  from public.domains
  where slug = p_domain_slug and is_system = true
  limit 1;

  insert into public.prompts (
    owner_user_id, domain_id, name, description, intent, complexity, status, is_system
  ) values (
    v_user_id, v_domain_id, p_name, p_description, p_intent, least(greatest(p_complexity,1),5), 'draft', false
  ) returning id into v_prompt_id;

  insert into public.prompt_versions (
    prompt_id, version, body, variables, required_context, optional_context,
    constraints, expected_output, evaluation_criteria, change_summary,
    audit_score, audit_findings, audit_missing_sections
  ) values (
    v_prompt_id, '1.0.0', p_body, p_variables, p_required_context, p_optional_context,
    p_constraints, p_expected_output, p_evaluation_criteria, 'Created from a system template clone.',
    p_audit_score, p_audit_findings, p_audit_missing_sections
  );

  return v_prompt_id;
end;
$$;

create or replace function public.create_prompt_version(
  p_prompt_id uuid,
  p_name text,
  p_description text,
  p_body text,
  p_variables jsonb,
  p_required_context jsonb,
  p_optional_context jsonb,
  p_constraints jsonb,
  p_expected_output text,
  p_evaluation_criteria jsonb,
  p_change_summary text,
  p_audit_score integer,
  p_audit_findings jsonb,
  p_audit_missing_sections jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_prompt_id uuid;
  v_latest_id uuid;
  v_latest_version text;
  v_next_version text;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 120 then
    raise exception 'prompt name is required and must be at most 120 characters';
  end if;
  if length(coalesce(p_body, '')) < 10 then
    raise exception 'prompt body must contain at least 10 characters';
  end if;
  if p_audit_score is null or p_audit_score < 0 or p_audit_score > 100 then
    raise exception 'audit score must be between 0 and 100';
  end if;
  if jsonb_typeof(p_variables) is distinct from 'array'
    or jsonb_typeof(p_required_context) is distinct from 'array'
    or jsonb_typeof(p_optional_context) is distinct from 'array'
    or jsonb_typeof(p_constraints) is distinct from 'array'
    or jsonb_typeof(p_evaluation_criteria) is distinct from 'array'
    or jsonb_typeof(p_audit_findings) is distinct from 'array'
    or jsonb_typeof(p_audit_missing_sections) is distinct from 'array' then
    raise exception 'prompt metadata and audit fields must be JSON arrays';
  end if;

  -- Lock the owned parent prompt to serialize concurrent version creation.
  select id into v_prompt_id
  from public.prompts
  where id = p_prompt_id
    and owner_user_id = v_user_id
    and is_system = false
  for update;

  if v_prompt_id is null then
    raise exception 'prompt not found or not owned by current user';
  end if;

  select id, version into v_latest_id, v_latest_version
  from public.prompt_versions
  where prompt_id = p_prompt_id
  order by created_at desc, id desc
  limit 1;

  if v_latest_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    v_next_version := split_part(v_latest_version, '.', 1) || '.' ||
      (split_part(v_latest_version, '.', 2)::integer + 1)::text || '.0';
  else
    v_next_version := '1.0.0';
  end if;

  update public.prompts
  set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''), updated_at = now()
  where id = p_prompt_id;

  insert into public.prompt_versions (
    prompt_id, version, parent_version_id, body, variables, required_context,
    optional_context, constraints, expected_output, evaluation_criteria, change_summary,
    audit_score, audit_findings, audit_missing_sections
  ) values (
    p_prompt_id, v_next_version, v_latest_id, p_body, p_variables, p_required_context,
    p_optional_context, p_constraints, p_expected_output, p_evaluation_criteria,
    coalesce(nullif(trim(p_change_summary), ''), 'Edited in Prompt Composer'),
    p_audit_score, p_audit_findings, p_audit_missing_sections
  ) returning id into v_version_id;

  return v_version_id;
end;
$$;

revoke execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,jsonb,jsonb) from public;
revoke execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,jsonb,jsonb) from anon;
revoke execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,jsonb,jsonb) from service_role;
grant execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,jsonb,jsonb) to authenticated;

revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,integer,jsonb,jsonb) from public;
revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,integer,jsonb,jsonb) from anon;
revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,integer,jsonb,jsonb) from service_role;
grant execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,integer,jsonb,jsonb) to authenticated;

-- Keep user prompt versions append-only and create each edit atomically.
drop policy if exists prompt_versions_update on public.prompt_versions;
drop policy if exists prompt_versions_delete on public.prompt_versions;

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
  p_change_summary text
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
  if jsonb_typeof(p_variables) is distinct from 'array'
    or jsonb_typeof(p_required_context) is distinct from 'array'
    or jsonb_typeof(p_optional_context) is distinct from 'array'
    or jsonb_typeof(p_constraints) is distinct from 'array'
    or jsonb_typeof(p_evaluation_criteria) is distinct from 'array' then
    raise exception 'prompt metadata fields must be JSON arrays';
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
    optional_context, constraints, expected_output, evaluation_criteria, change_summary
  ) values (
    p_prompt_id, v_next_version, v_latest_id, p_body, p_variables, p_required_context,
    p_optional_context, p_constraints, p_expected_output, p_evaluation_criteria,
    coalesce(nullif(trim(p_change_summary), ''), 'Edited in Prompt Composer')
  ) returning id into v_version_id;

  return v_version_id;
end;
$$;

revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) from public;
revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) from anon;
revoke execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) from service_role;
grant execute on function public.create_prompt_version(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) to authenticated;

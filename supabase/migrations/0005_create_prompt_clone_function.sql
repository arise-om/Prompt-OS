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
  p_evaluation_criteria jsonb
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
    constraints, expected_output, evaluation_criteria, change_summary
  ) values (
    v_prompt_id, '1.0.0', p_body, p_variables, p_required_context, p_optional_context,
    p_constraints, p_expected_output, p_evaluation_criteria, 'Created from a system template clone.'
  );

  return v_prompt_id;
end;
$$;

revoke execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) from anon;
grant execute on function public.create_prompt_clone(text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) to authenticated;

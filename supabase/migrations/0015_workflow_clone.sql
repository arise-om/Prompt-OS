create or replace function public.create_workflow_clone(
  p_source_workflow_id uuid,
  p_name text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.workflows%rowtype;
  v_clone_id uuid := gen_random_uuid();
  v_step_id uuid;
  v_from_step_id uuid;
  v_to_step_id uuid;
  v_step_map jsonb := '{}'::jsonb;
  v_name text;
  source_step record;
  source_edge record;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_source
  from public.workflows
  where id = p_source_workflow_id
    and (is_system = true or owner_user_id = v_user_id)
  for share;

  if v_source.id is null then
    raise exception 'workflow not found or not accessible';
  end if;

  v_name := coalesce(nullif(trim(coalesce(p_name, '')), ''), v_source.name || ' (Copy)');

  insert into public.workflows (
    id,
    name,
    description,
    trigger,
    version,
    status,
    approval_required,
    is_system,
    owner_user_id,
    project_id
  ) values (
    v_clone_id,
    v_name,
    v_source.description,
    v_source.trigger,
    '1.0.0',
    'draft',
    v_source.approval_required,
    false,
    v_user_id,
    null
  );

  for source_step in
    select id, position, step_type, name, purpose, input_keys, output_keys, config
    from public.workflow_steps
    where workflow_id = v_source.id
    order by position, id
  loop
    v_step_id := gen_random_uuid();
    insert into public.workflow_steps (
      id,
      workflow_id,
      position,
      step_type,
      name,
      purpose,
      input_keys,
      output_keys,
      config
    ) values (
      v_step_id,
      v_clone_id,
      source_step.position,
      source_step.step_type,
      source_step.name,
      source_step.purpose,
      source_step.input_keys,
      source_step.output_keys,
      source_step.config
    );
    v_step_map := jsonb_set(v_step_map, ARRAY[source_step.id::text], to_jsonb(v_step_id::text), true);
  end loop;

  for source_edge in
    select from_step_id, to_step_id, condition, priority
    from public.workflow_edges
    where workflow_id = v_source.id
    order by priority desc, id
  loop
    v_from_step_id := (v_step_map->>source_edge.from_step_id::text)::uuid;
    v_to_step_id := (v_step_map->>source_edge.to_step_id::text)::uuid;
    if v_from_step_id is null or v_to_step_id is null then
      raise exception 'workflow clone failed to map an edge endpoint';
    end if;

    insert into public.workflow_edges (
      workflow_id,
      from_step_id,
      to_step_id,
      condition,
      priority
    ) values (
      v_clone_id,
      v_from_step_id,
      v_to_step_id,
      source_edge.condition,
      source_edge.priority
    );
  end loop;

  return v_clone_id;
end;
$$;

revoke execute on function public.create_workflow_clone(uuid,text) from public;
revoke execute on function public.create_workflow_clone(uuid,text) from anon;
revoke execute on function public.create_workflow_clone(uuid,text) from service_role;
grant execute on function public.create_workflow_clone(uuid,text) to authenticated;

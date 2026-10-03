-- Harden production promotion so the database gate matches the application gate.
-- Every workflow step must be reachable from the first step, and every path to a
-- consequential step must pass an approval checkpoint.

create or replace function public.promote_workflow(
  p_workflow_id uuid,
  p_expected_version text,
  p_min_score numeric default 80,
  p_min_runs integer default 3,
  p_min_benchmarks integer default 3
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workflow public.workflows%rowtype;
  v_eval_count integer := 0;
  v_distinct_benchmark_count integer := 0;
  v_failed_count integer := 0;
  v_average_score numeric := 0;
  v_promotion_id uuid;
  v_unsupported_tools text[];
  v_consequential_count integer := 0;
  v_unprotected_consequential_count integer := 0;
  v_unreachable_count integer := 0;
  v_invalid_edge_count integer := 0;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_min_score < 0 or p_min_score > 100 then raise exception 'minimum score must be between 0 and 100'; end if;
  if p_min_runs <= 0 or p_min_benchmarks <= 0 then raise exception 'evaluation thresholds must be positive'; end if;

  select * into v_workflow
  from public.workflows
  where id = p_workflow_id
    and owner_user_id = v_user_id
    and is_system = false
  for update;

  if v_workflow.id is null then raise exception 'workflow not found or not owned by current user'; end if;
  if v_workflow.version <> p_expected_version then raise exception 'workflow version changed since promotion review'; end if;
  if v_workflow.status not in ('validated', 'tested') then raise exception 'workflow must be tested or validated before promotion'; end if;

  select count(*) into v_invalid_edge_count
  from public.workflow_edges e
  left join public.workflow_steps f on f.id = e.from_step_id
  left join public.workflow_steps t on t.id = e.to_step_id
  where e.workflow_id = p_workflow_id
    and (f.id is null or t.id is null or f.workflow_id <> p_workflow_id or t.workflow_id <> p_workflow_id);

  if v_invalid_edge_count > 0 then
    raise exception 'workflow graph contains % edge(s) crossing workflow boundaries', v_invalid_edge_count;
  end if;

  with recursive reachable(step_id, visited) as (
    select first_step.id, array[first_step.id]::uuid[]
    from (
      select ws.id
      from public.workflow_steps ws
      where ws.workflow_id = p_workflow_id
      order by ws.position, ws.id
      limit 1
    ) first_step
    union all
    select e.to_step_id, reachable.visited || e.to_step_id
    from reachable
    join public.workflow_edges e
      on e.workflow_id = p_workflow_id
     and e.from_step_id = reachable.step_id
    where not (e.to_step_id = any(reachable.visited))
  )
  select count(*) into v_unreachable_count
  from public.workflow_steps ws
  where ws.workflow_id = p_workflow_id
    and not exists (select 1 from reachable r where r.step_id = ws.id);

  if v_unreachable_count > 0 then
    raise exception 'WORKFLOW_PROMOTION_GRAPH_UNREACHABLE: workflow graph contains % unreachable step(s)', v_unreachable_count;
  end if;

  select coalesce(array_agg(ws.name order by ws.name), '{}') into v_unsupported_tools
  from public.workflow_steps ws
  where ws.workflow_id = p_workflow_id
    and ws.step_type = 'tool'
    and coalesce(ws.config->>'tool', '') <> 'web_search';

  if cardinality(v_unsupported_tools) > 0 then
    raise exception 'unsupported workflow tools: %', array_to_string(v_unsupported_tools, ', ');
  end if;

  select count(*) into v_consequential_count
  from public.workflow_steps ws
  where ws.workflow_id = p_workflow_id
    and (ws.config->>'requiresApproval' = 'true' or ws.config->>'riskLevel' in ('high','consequential'));

  if v_consequential_count > 0 then
    if not v_workflow.approval_required then
      raise exception 'consequential steps require workflow approval protection';
    end if;

    with recursive approval_paths(step_id, seen_approval, visited) as (
      select first_step.id,
             (first_step.step_type = 'approval'),
             array[first_step.id]::uuid[]
      from (
        select ws.id, ws.step_type
        from public.workflow_steps ws
        where ws.workflow_id = p_workflow_id
        order by ws.position, ws.id
        limit 1
      ) first_step
      union all
      select e.to_step_id,
             approval_paths.seen_approval or (target.step_type = 'approval'),
             approval_paths.visited || e.to_step_id
      from approval_paths
      join public.workflow_edges e
        on e.workflow_id = p_workflow_id
       and e.from_step_id = approval_paths.step_id
      join public.workflow_steps target
        on target.id = e.to_step_id
       and target.workflow_id = p_workflow_id
      where not (target.id = any(approval_paths.visited))
    )
    select count(*) into v_unprotected_consequential_count
    from public.workflow_steps target
    where target.workflow_id = p_workflow_id
      and (target.config->>'requiresApproval' = 'true' or target.config->>'riskLevel' in ('high','consequential'))
      and exists (
        select 1
        from approval_paths path
        where path.step_id = target.id
          and not path.seen_approval
      );

    if v_unprotected_consequential_count > 0 then
      raise exception 'WORKFLOW_PROMOTION_APPROVAL_PATH: consequential steps must be protected by an approval checkpoint on every reachable path (unprotected steps: %)', v_unprotected_consequential_count;
    end if;
  end if;

  select count(*) into v_eval_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select count(distinct benchmark_case_id) into v_distinct_benchmark_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select coalesce(avg((scores->>'overall')::numeric), 0)
    into v_average_score
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select count(*) into v_failed_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and (cardinality(failure_codes) > 0 or not (scores ? 'overall') or jsonb_typeof(scores->'overall') is distinct from 'number');

  if v_eval_count < p_min_runs or v_distinct_benchmark_count < p_min_benchmarks then
    raise exception 'insufficient benchmark coverage: % successful runs across % distinct benchmarks', v_eval_count, v_distinct_benchmark_count;
  end if;
  if v_average_score < p_min_score then
    raise exception 'average evaluation score %.3f is below minimum %.3f', v_average_score, p_min_score;
  end if;
  if v_failed_count > 0 then
    raise exception 'evaluation evidence contains % failed run(s)', v_failed_count;
  end if;

  update public.workflows
  set status = 'production', updated_at = now()
  where id = v_workflow.id;

  insert into public.workflow_promotions (
    workflow_id, workflow_version, owner_user_id, from_status, to_status,
    evaluation_run_count, distinct_benchmark_count, average_score, failed_run_count
  ) values (
    v_workflow.id, v_workflow.version, v_user_id, v_workflow.status, 'production',
    v_eval_count, v_distinct_benchmark_count, v_average_score, v_failed_count
  ) returning id into v_promotion_id;

  return v_promotion_id;
end;
$$;

revoke execute on function public.promote_workflow(uuid,text,numeric,integer,integer) from public;
revoke execute on function public.promote_workflow(uuid,text,numeric,integer,integer) from anon;
revoke execute on function public.promote_workflow(uuid,text,numeric,integer,integer) from service_role;
grant execute on function public.promote_workflow(uuid,text,numeric,integer,integer) to authenticated;

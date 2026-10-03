-- Bind workflow evaluation evidence to the exact workflow version that was executed.
-- Existing workflow evaluations are backfilled from the current workflow version.

alter table public.evaluation_runs
  add column if not exists workflow_version text;

update public.evaluation_runs e
set workflow_version = w.version
from public.workflows w
where e.workflow_id = w.id
  and e.workflow_version is null;

create index if not exists idx_eval_runs_workflow_version
  on public.evaluation_runs(workflow_id, workflow_version, created_at desc);

create or replace function public.create_evaluation_run(
  p_prompt_version_id uuid,
  p_workflow_id uuid,
  p_benchmark_case_id uuid,
  p_actual_output jsonb,
  p_scores jsonb,
  p_failure_codes text[],
  p_reviewer_notes text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_prompt_version_id uuid;
  v_workflow_id uuid;
  v_workflow_version text;
  v_benchmark_case_id uuid;
  v_run_id uuid;
  v_audit_snapshot jsonb;
  v_scores jsonb := coalesce(p_scores, '{}'::jsonb);
  v_overall numeric := 0;
  v_total_weight numeric := 0;
  v_existing_scores integer := 0;
  v_expected_scores integer := 0;
  v_invalid jsonb;
  v_unknown jsonb;
  v_missing jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if jsonb_typeof(v_scores) is distinct from 'object' then
    raise exception 'evaluation scores must be a JSON object';
  end if;
  if p_actual_output is null then
    raise exception 'actual output is required';
  end if;

  if p_prompt_version_id is not null then
    select pv.id,
           jsonb_build_object(
             'score', pv.audit_score,
             'findings', pv.audit_findings,
             'missingSections', pv.audit_missing_sections
           )
      into v_prompt_version_id, v_audit_snapshot
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    where pv.id = p_prompt_version_id
      and (p.is_system = true or p.owner_user_id = v_user_id);

    if v_prompt_version_id is null then
      raise exception 'prompt version not found or not accessible';
    end if;

    if v_audit_snapshot->>'score' is null then
      v_audit_snapshot := null;
    end if;
  end if;

  if p_workflow_id is not null then
    select id, version into v_workflow_id, v_workflow_version
    from public.workflows
    where id = p_workflow_id
      and (is_system = true or owner_user_id = v_user_id);
    if v_workflow_id is null then
      raise exception 'workflow not found or not accessible';
    end if;
  end if;

  if p_benchmark_case_id is not null then
    select id into v_benchmark_case_id
    from public.benchmark_cases
    where id = p_benchmark_case_id
      and (is_system = true or owner_user_id = v_user_id);
    if v_benchmark_case_id is null then
      raise exception 'benchmark case not found or not accessible';
    end if;

    select count(*) into v_expected_scores
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id);

    select count(*) into v_existing_scores
    from jsonb_object_keys(v_scores) as key
    where key <> 'overall';

    if v_existing_scores <> v_expected_scores then
      raise exception 'evaluation scores must include exactly one score per benchmark criterion';
    end if;

    select jsonb_agg(key) into v_unknown
    from jsonb_object_keys(v_scores) as key
    where key <> 'overall'
      and not exists (
        select 1
        from public.benchmark_case_criteria bcc
        where bcc.benchmark_case_id = v_benchmark_case_id
          and bcc.criterion_id::text = key
      );
    if v_unknown is not null then
      raise exception 'evaluation contains unknown benchmark criteria: %', v_unknown::text;
    end if;

    select jsonb_agg(c.id::text) into v_missing
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and not (v_scores ? c.id::text);
    if v_missing is not null then
      raise exception 'evaluation is missing benchmark criteria: %', v_missing::text;
    end if;

    select jsonb_agg(jsonb_build_object('id', c.id, 'score', v_scores->>(c.id::text)))
      into v_invalid
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and (
        jsonb_typeof(v_scores->c.id::text) is distinct from 'number'
        or ((v_scores->>c.id::text)::numeric < 0)
        or ((v_scores->>c.id::text)::numeric > 100)
        or (c.scoring_type = 'binary' and ((v_scores->>c.id::text)::numeric not in (0, 100)))
      );
    if v_invalid is not null then
      raise exception 'invalid evaluation scores: %', v_invalid::text;
    end if;

    select
      coalesce(sum((v_scores->>(c.id::text))::numeric * coalesce(bcc.weight_override, c.weight)), 0),
      coalesce(sum(coalesce(bcc.weight_override, c.weight)), 0)
      into v_overall, v_total_weight
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and coalesce(bcc.weight_override, c.weight) > 0;

    if v_total_weight > 0 then
      v_overall := round(v_overall / v_total_weight, 6);
    else
      v_overall := 0;
    end if;

    v_scores := jsonb_set(v_scores, '{overall}', to_jsonb(v_overall), true);
  else
    if jsonb_object_length(v_scores) > 0 then
      raise exception 'criterion scores require a benchmark case';
    end if;
  end if;

  insert into public.evaluation_runs (
    owner_user_id,
    prompt_version_id,
    workflow_id,
    workflow_version,
    benchmark_case_id,
    actual_output,
    scores,
    failure_codes,
    reviewer_notes,
    prompt_audit_snapshot
  ) values (
    v_user_id,
    v_prompt_version_id,
    v_workflow_id,
    v_workflow_version,
    v_benchmark_case_id,
    p_actual_output,
    v_scores,
    coalesce(p_failure_codes, '{}'::text[]),
    nullif(trim(coalesce(p_reviewer_notes, '')), ''),
    v_audit_snapshot
  ) returning id into v_run_id;

  if v_benchmark_case_id is not null then
    insert into public.evaluation_run_scores (evaluation_run_id, criterion_id, score, rationale)
    select
      v_run_id,
      c.id,
      (v_scores->>(c.id::text))::numeric,
      null
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id);
  end if;

  return v_run_id;
end;
$$;

revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from public;
revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from anon;
revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from service_role;
grant execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) to authenticated;

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
    and workflow_version = v_workflow.version
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select count(distinct benchmark_case_id) into v_distinct_benchmark_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and workflow_version = v_workflow.version
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select coalesce(avg((scores->>'overall')::numeric), 0)
    into v_average_score
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and workflow_version = v_workflow.version
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall'
    and jsonb_typeof(scores->'overall') = 'number';

  select count(*) into v_failed_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and workflow_version = v_workflow.version
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

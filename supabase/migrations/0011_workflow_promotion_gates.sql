create table if not exists public.workflow_promotions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  from_status text not null,
  to_status text not null check (to_status = 'production'),
  evaluation_run_count integer not null check (evaluation_run_count >= 0),
  distinct_benchmark_count integer not null check (distinct_benchmark_count >= 0),
  average_score numeric(9,6) not null check (average_score >= 0 and average_score <= 100),
  failed_run_count integer not null check (failed_run_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_promotions_workflow
  on public.workflow_promotions(workflow_id, created_at desc);
create index if not exists idx_workflow_promotions_owner
  on public.workflow_promotions(owner_user_id, created_at desc);

alter table public.workflow_promotions enable row level security;

drop policy if exists workflow_promotions_select on public.workflow_promotions;
create policy workflow_promotions_select on public.workflow_promotions
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists workflow_promotions_insert on public.workflow_promotions;
create policy workflow_promotions_insert on public.workflow_promotions
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

revoke update, delete on public.workflow_promotions from authenticated;
revoke all on public.workflow_promotions from anon;

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
  v_approval_count integer := 0;
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
    select count(*) into v_approval_count
    from public.workflow_steps ws
    where ws.workflow_id = p_workflow_id and ws.step_type = 'approval';
    if not v_workflow.approval_required or v_approval_count = 0 then
      raise exception 'consequential steps require an approval checkpoint';
    end if;
  end if;

  select count(*), count(distinct benchmark_case_id),
         coalesce(avg((scores->>'overall')::numeric) filter (where benchmark_case_id is not null and cardinality(failure_codes) = 0 and scores ? 'overall'), 0)
    into v_eval_count, v_distinct_benchmark_count, v_average_score
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and benchmark_case_id is not null
    and cardinality(failure_codes) = 0
    and scores ? 'overall';

  select count(*) into v_failed_count
  from public.evaluation_runs
  where workflow_id = p_workflow_id
    and (cardinality(failure_codes) > 0 or not (scores ? 'overall'));

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

-- Persist workflow execution state, approvals, and failure evidence for authenticated owners.
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('running','paused','completed','failed')),
  current_step_id uuid references public.workflow_steps(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  pending_approval jsonb,
  failure jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint workflow_runs_state_object check (jsonb_typeof(state) = 'object'),
  constraint workflow_runs_pending_approval_object check (pending_approval is null or jsonb_typeof(pending_approval) = 'object'),
  constraint workflow_runs_failure_object check (failure is null or jsonb_typeof(failure) = 'object')
);

create index if not exists idx_workflow_runs_owner on public.workflow_runs(owner_user_id);
create index if not exists idx_workflow_runs_workflow on public.workflow_runs(workflow_id);
create index if not exists idx_workflow_runs_status on public.workflow_runs(status);

alter table public.workflow_runs enable row level security;

create policy workflow_runs_select on public.workflow_runs
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy workflow_runs_insert on public.workflow_runs
  for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id
        and (w.is_system = true or w.owner_user_id = (select auth.uid()))
    )
  );

create policy workflow_runs_update on public.workflow_runs
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create or replace function public.create_workflow_run(
  p_workflow_id uuid,
  p_status text,
  p_current_step_id uuid,
  p_state jsonb,
  p_pending_approval jsonb,
  p_failure jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workflow_id uuid;
  v_workflow_version text;
  v_run_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_status not in ('running','paused','completed','failed') then
    raise exception 'invalid workflow run status';
  end if;
  if jsonb_typeof(coalesce(p_state, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'workflow run state must be a JSON object';
  end if;

  select w.id, w.version into v_workflow_id, v_workflow_version
  from public.workflows w
  where w.id = p_workflow_id
    and (w.is_system = true or w.owner_user_id = v_user_id);

  if v_workflow_id is null then
    raise exception 'workflow not found or not accessible';
  end if;

  insert into public.workflow_runs (
    workflow_id, workflow_version, owner_user_id, status, current_step_id,
    state, pending_approval, failure, completed_at
  ) values (
    v_workflow_id, v_workflow_version, v_user_id, p_status, p_current_step_id,
    coalesce(p_state, '{}'::jsonb), p_pending_approval, p_failure,
    case when p_status in ('completed','failed') then now() else null end
  ) returning id into v_run_id;

  if p_status = 'failed' and p_failure is not null then
    insert into public.failure_logs (
      owner_user_id, workflow_id, code, summary, evidence, remediation
    ) values (
      v_user_id,
      v_workflow_id,
      coalesce(p_failure->>'code', 'WORKFLOW_FAILED'),
      coalesce(p_failure->>'message', 'Workflow failed'),
      p_failure,
      'Inspect the persisted workflow run state and failed step evidence.'
    );
  end if;

  return v_run_id;
end;
$$;

create or replace function public.update_workflow_run(
  p_run_id uuid,
  p_status text,
  p_current_step_id uuid,
  p_state jsonb,
  p_pending_approval jsonb,
  p_failure jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_workflow_id uuid;
  v_previous_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_status not in ('running','paused','completed','failed') then
    raise exception 'invalid workflow run status';
  end if;
  if jsonb_typeof(coalesce(p_state, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'workflow run state must be a JSON object';
  end if;

  select owner_user_id, workflow_id, status
    into v_owner_user_id, v_workflow_id, v_previous_status
  from public.workflow_runs
  where id = p_run_id
  for update;

  if v_owner_user_id is null or v_owner_user_id <> v_user_id then
    raise exception 'workflow run not found or not owned by current user';
  end if;

  update public.workflow_runs
  set status = p_status,
      current_step_id = p_current_step_id,
      state = coalesce(p_state, '{}'::jsonb),
      pending_approval = p_pending_approval,
      failure = p_failure,
      updated_at = now(),
      completed_at = case when p_status in ('completed','failed') then coalesce(completed_at, now()) else null end
  where id = p_run_id;

  if p_status = 'failed' and v_previous_status <> 'failed' and p_failure is not null then
    insert into public.failure_logs (
      owner_user_id, workflow_id, code, summary, evidence, remediation
    ) values (
      v_user_id,
      v_workflow_id,
      coalesce(p_failure->>'code', 'WORKFLOW_FAILED'),
      coalesce(p_failure->>'message', 'Workflow failed'),
      p_failure,
      'Inspect the persisted workflow run state and failed step evidence.'
    );
  end if;
end;
$$;

revoke execute on function public.create_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from public;
revoke execute on function public.create_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from anon;
revoke execute on function public.create_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from service_role;
grant execute on function public.create_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) to authenticated;

revoke execute on function public.update_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from public;
revoke execute on function public.update_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from anon;
revoke execute on function public.update_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) from service_role;
grant execute on function public.update_workflow_run(uuid,text,uuid,jsonb,jsonb,jsonb) to authenticated;

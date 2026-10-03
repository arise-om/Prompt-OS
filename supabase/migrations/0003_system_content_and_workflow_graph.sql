-- System content can be shared across users while remaining immutable to normal clients.
alter table public.prompts alter column owner_user_id drop not null;
alter table public.prompt_components alter column owner_user_id drop not null;
alter table public.workflows alter column owner_user_id drop not null;
alter table public.benchmark_cases alter column owner_user_id drop not null;
alter table public.evaluation_criteria alter column owner_user_id drop not null;

alter table public.prompts add column if not exists is_system boolean not null default false;
alter table public.prompt_components add column if not exists is_system boolean not null default false;
alter table public.workflows add column if not exists is_system boolean not null default false;
alter table public.benchmark_cases add column if not exists is_system boolean not null default false;
alter table public.evaluation_criteria add column if not exists is_system boolean not null default false;

alter table public.prompt_versions add column if not exists parent_version_id uuid references public.prompt_versions(id) on delete set null;
create index if not exists idx_prompt_versions_parent on public.prompt_versions(parent_version_id);

create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  from_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  to_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  condition jsonb not null default '{}'::jsonb,
  priority integer not null default 0 check (priority >= 0),
  created_at timestamptz not null default now(),
  unique (workflow_id, from_step_id, to_step_id)
);

create table if not exists public.workflow_prompts (
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  position integer not null check (position >= 0),
  config jsonb not null default '{}'::jsonb,
  primary key (workflow_id, prompt_id),
  unique (workflow_id, position)
);

create table if not exists public.benchmark_case_criteria (
  benchmark_case_id uuid not null references public.benchmark_cases(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  weight_override numeric(6,3) check (weight_override is null or weight_override >= 0),
  primary key (benchmark_case_id, criterion_id)
);

create table if not exists public.evaluation_run_scores (
  evaluation_run_id uuid not null references public.evaluation_runs(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  score numeric(8,3) not null check (score >= 0),
  rationale text,
  primary key (evaluation_run_id, criterion_id)
);

create index if not exists idx_workflow_edges_workflow on public.workflow_edges(workflow_id);
create index if not exists idx_workflow_edges_from on public.workflow_edges(from_step_id);
create index if not exists idx_workflow_edges_to on public.workflow_edges(to_step_id);
create index if not exists idx_workflow_prompts_prompt on public.workflow_prompts(prompt_id);
create index if not exists idx_benchmark_case_criteria_criterion on public.benchmark_case_criteria(criterion_id);
create index if not exists idx_evaluation_run_scores_criterion on public.evaluation_run_scores(criterion_id);

create unique index if not exists uq_system_domain_slug on public.domains(slug) where is_system = true;
create unique index if not exists uq_system_prompt_component_name on public.prompt_components(name) where is_system = true;
create unique index if not exists uq_system_evaluation_criterion_name on public.evaluation_criteria(name) where is_system = true;

-- Replace top-level RLS policies with system-content-aware versions.
drop policy if exists domains_select on public.domains;
drop policy if exists domains_insert on public.domains;
drop policy if exists domains_update on public.domains;
drop policy if exists domains_delete on public.domains;
create policy domains_select on public.domains for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy domains_insert on public.domains for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy domains_update on public.domains for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy domains_delete on public.domains for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

drop policy if exists prompts_all on public.prompts;
create policy prompts_select on public.prompts for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy prompts_insert on public.prompts for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy prompts_update on public.prompts for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy prompts_delete on public.prompts for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

drop policy if exists prompt_components_all on public.prompt_components;
create policy prompt_components_select on public.prompt_components for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy prompt_components_insert on public.prompt_components for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy prompt_components_update on public.prompt_components for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy prompt_components_delete on public.prompt_components for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

drop policy if exists prompt_versions_all on public.prompt_versions;
create policy prompt_versions_select on public.prompt_versions for select
  to authenticated using (exists (
    select 1 from public.prompts p
    where p.id = prompt_versions.prompt_id
      and (p.is_system = true or p.owner_user_id = (select auth.uid()))
  ));
create policy prompt_versions_insert on public.prompt_versions for insert
  to authenticated with check (exists (
    select 1 from public.prompts p
    where p.id = prompt_versions.prompt_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  ));
create policy prompt_versions_update on public.prompt_versions for update
  to authenticated using (exists (
    select 1 from public.prompts p
    where p.id = prompt_versions.prompt_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.prompts p
    where p.id = prompt_versions.prompt_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  ));
create policy prompt_versions_delete on public.prompt_versions for delete
  to authenticated using (exists (
    select 1 from public.prompts p
    where p.id = prompt_versions.prompt_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  ));

drop policy if exists prompt_version_components_all on public.prompt_version_components;
create policy prompt_version_components_select on public.prompt_version_components for select
  to authenticated using (exists (
    select 1
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    where pv.id = prompt_version_components.prompt_version_id
      and (p.is_system = true or p.owner_user_id = (select auth.uid()))
  ));
create policy prompt_version_components_insert on public.prompt_version_components for insert
  to authenticated with check (exists (
    select 1
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    join public.prompt_components pc on pc.id = prompt_version_components.component_id
    where pv.id = prompt_version_components.prompt_version_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
      and (pc.is_system = true or pc.owner_user_id = (select auth.uid()))
  ));
create policy prompt_version_components_update on public.prompt_version_components for update
  to authenticated using (exists (
    select 1
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    where pv.id = prompt_version_components.prompt_version_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    join public.prompt_components pc on pc.id = prompt_version_components.component_id
    where pv.id = prompt_version_components.prompt_version_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
      and (pc.is_system = true or pc.owner_user_id = (select auth.uid()))
  ));
create policy prompt_version_components_delete on public.prompt_version_components for delete
  to authenticated using (exists (
    select 1
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    where pv.id = prompt_version_components.prompt_version_id
      and p.is_system = false
      and p.owner_user_id = (select auth.uid())
  ));

drop policy if exists workflows_all on public.workflows;
create policy workflows_select on public.workflows for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy workflows_insert on public.workflows for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy workflows_update on public.workflows for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy workflows_delete on public.workflows for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

drop policy if exists workflow_steps_all on public.workflow_steps;
create policy workflow_steps_select on public.workflow_steps for select
  to authenticated using (exists (
    select 1 from public.workflows w
    where w.id = workflow_steps.workflow_id
      and (w.is_system = true or w.owner_user_id = (select auth.uid()))
  ));
create policy workflow_steps_insert on public.workflow_steps for insert
  to authenticated with check (exists (
    select 1 from public.workflows w
    where w.id = workflow_steps.workflow_id
      and w.is_system = false
      and w.owner_user_id = (select auth.uid())
  ));
create policy workflow_steps_update on public.workflow_steps for update
  to authenticated using (exists (
    select 1 from public.workflows w
    where w.id = workflow_steps.workflow_id
      and w.is_system = false
      and w.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.workflows w
    where w.id = workflow_steps.workflow_id
      and w.is_system = false
      and w.owner_user_id = (select auth.uid())
  ));
create policy workflow_steps_delete on public.workflow_steps for delete
  to authenticated using (exists (
    select 1 from public.workflows w
    where w.id = workflow_steps.workflow_id
      and w.is_system = false
      and w.owner_user_id = (select auth.uid())
  ));

alter table public.workflow_edges enable row level security;
alter table public.workflow_prompts enable row level security;
alter table public.benchmark_case_criteria enable row level security;
alter table public.evaluation_run_scores enable row level security;

create policy workflow_edges_select on public.workflow_edges for select
  to authenticated using (exists (
    select 1 from public.workflows w
    where w.id = workflow_edges.workflow_id
      and (w.is_system = true or w.owner_user_id = (select auth.uid()))
  ));
create policy workflow_edges_insert on public.workflow_edges for insert
  to authenticated with check (exists (
    select 1 from public.workflows w
    where w.id = workflow_edges.workflow_id
      and w.is_system = false
      and w.owner_user_id = (select auth.uid())
  ));
create policy workflow_edges_update on public.workflow_edges for update
  to authenticated using (exists (
    select 1 from public.workflows w where w.id = workflow_edges.workflow_id and w.is_system = false and w.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.workflows w where w.id = workflow_edges.workflow_id and w.is_system = false and w.owner_user_id = (select auth.uid())
  ));
create policy workflow_edges_delete on public.workflow_edges for delete
  to authenticated using (exists (
    select 1 from public.workflows w where w.id = workflow_edges.workflow_id and w.is_system = false and w.owner_user_id = (select auth.uid())
  ));

create policy workflow_prompts_select on public.workflow_prompts for select
  to authenticated using (exists (
    select 1 from public.workflows w
    where w.id = workflow_prompts.workflow_id and (w.is_system = true or w.owner_user_id = (select auth.uid()))
  ));
create policy workflow_prompts_insert on public.workflow_prompts for insert
  to authenticated with check (exists (
    select 1 from public.workflows w join public.prompts p on p.id = workflow_prompts.prompt_id
    where w.id = workflow_prompts.workflow_id
      and w.is_system = false and w.owner_user_id = (select auth.uid())
      and (p.is_system = true or p.owner_user_id = (select auth.uid()))
  ));
create policy workflow_prompts_update on public.workflow_prompts for update
  to authenticated using (exists (
    select 1 from public.workflows w where w.id = workflow_prompts.workflow_id and w.is_system = false and w.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.workflows w join public.prompts p on p.id = workflow_prompts.prompt_id
    where w.id = workflow_prompts.workflow_id
      and w.is_system = false and w.owner_user_id = (select auth.uid())
      and (p.is_system = true or p.owner_user_id = (select auth.uid()))
  ));
create policy workflow_prompts_delete on public.workflow_prompts for delete
  to authenticated using (exists (
    select 1 from public.workflows w where w.id = workflow_prompts.workflow_id and w.is_system = false and w.owner_user_id = (select auth.uid())
  ));

-- System benchmarks/rubrics are readable but not writable by normal clients.
drop policy if exists benchmarks_all on public.benchmark_cases;
create policy benchmarks_select on public.benchmark_cases for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy benchmarks_insert on public.benchmark_cases for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy benchmarks_update on public.benchmark_cases for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy benchmarks_delete on public.benchmark_cases for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

drop policy if exists evaluation_criteria_all on public.evaluation_criteria;
create policy evaluation_criteria_select on public.evaluation_criteria for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy evaluation_criteria_insert on public.evaluation_criteria for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy evaluation_criteria_update on public.evaluation_criteria for update
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false)
  with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy evaluation_criteria_delete on public.evaluation_criteria for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

create policy benchmark_case_criteria_select on public.benchmark_case_criteria for select
  to authenticated using (exists (
    select 1 from public.benchmark_cases b
    where b.id = benchmark_case_criteria.benchmark_case_id and (b.is_system = true or b.owner_user_id = (select auth.uid()))
  ));
create policy benchmark_case_criteria_insert on public.benchmark_case_criteria for insert
  to authenticated with check (exists (
    select 1
    from public.benchmark_cases b
    join public.evaluation_criteria c on c.id = benchmark_case_criteria.criterion_id
    where b.id = benchmark_case_criteria.benchmark_case_id
      and b.is_system = false and b.owner_user_id = (select auth.uid())
      and (c.is_system = true or c.owner_user_id = (select auth.uid()))
  ));
create policy benchmark_case_criteria_update on public.benchmark_case_criteria for update
  to authenticated using (exists (
    select 1 from public.benchmark_cases b where b.id = benchmark_case_criteria.benchmark_case_id and b.is_system = false and b.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1
    from public.benchmark_cases b
    join public.evaluation_criteria c on c.id = benchmark_case_criteria.criterion_id
    where b.id = benchmark_case_criteria.benchmark_case_id
      and b.is_system = false and b.owner_user_id = (select auth.uid())
      and (c.is_system = true or c.owner_user_id = (select auth.uid()))
  ));
create policy benchmark_case_criteria_delete on public.benchmark_case_criteria for delete
  to authenticated using (exists (
    select 1 from public.benchmark_cases b where b.id = benchmark_case_criteria.benchmark_case_id and b.is_system = false and b.owner_user_id = (select auth.uid())
  ));

create policy evaluation_run_scores_select on public.evaluation_run_scores for select
  to authenticated using (exists (
    select 1 from public.evaluation_runs er where er.id = evaluation_run_scores.evaluation_run_id and er.owner_user_id = (select auth.uid())
  ));
create policy evaluation_run_scores_insert on public.evaluation_run_scores for insert
  to authenticated with check (exists (
    select 1 from public.evaluation_runs er
    join public.evaluation_criteria c on c.id = evaluation_run_scores.criterion_id
    where er.id = evaluation_run_scores.evaluation_run_id
      and er.owner_user_id = (select auth.uid())
      and (c.is_system = true or c.owner_user_id = (select auth.uid()))
  ));
create policy evaluation_run_scores_update on public.evaluation_run_scores for update
  to authenticated using (exists (
    select 1 from public.evaluation_runs er where er.id = evaluation_run_scores.evaluation_run_id and er.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.evaluation_runs er
    join public.evaluation_criteria c on c.id = evaluation_run_scores.criterion_id
    where er.id = evaluation_run_scores.evaluation_run_id
      and er.owner_user_id = (select auth.uid())
      and (c.is_system = true or c.owner_user_id = (select auth.uid()))
  ));
create policy evaluation_run_scores_delete on public.evaluation_run_scores for delete
  to authenticated using (exists (
    select 1 from public.evaluation_runs er where er.id = evaluation_run_scores.evaluation_run_id and er.owner_user_id = (select auth.uid())
  ));

-- Prompt OS core schema.
-- All user/project-owned tables use row-level security.

create extension if not exists pgcrypto;

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_user_id, slug)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, slug)
);

create table if not exists public.context_packs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  description text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  name text not null,
  description text,
  intent text not null,
  complexity integer not null default 2 check (complexity between 1 and 5),
  status text not null default 'draft' check (status in ('draft','experimental','tested','validated','production','deprecated','archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  version text not null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  required_context jsonb not null default '[]'::jsonb,
  optional_context jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  expected_output text,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  change_summary text,
  created_at timestamptz not null default now(),
  unique (prompt_id, version)
);

create table if not exists public.prompt_components (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  component_type text not null check (component_type in ('context','objective','constraint','audience','output','quality','verification','uncertainty','scope','example','instruction')),
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_version_components (
  prompt_version_id uuid not null references public.prompt_versions(id) on delete cascade,
  component_id uuid not null references public.prompt_components(id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (prompt_version_id, component_id)
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  description text,
  trigger text,
  version text not null default '1.0.0',
  status text not null default 'draft' check (status in ('draft','experimental','tested','validated','production','deprecated','archived')),
  approval_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  position integer not null check (position >= 0),
  step_type text not null check (step_type in ('input','prompt','research','tool','decision','condition','approval','evaluation','retry','output')),
  name text not null,
  purpose text not null,
  input_keys jsonb not null default '[]'::jsonb,
  output_keys jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  unique (workflow_id, position)
);

create table if not exists public.benchmark_cases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  name text not null,
  input jsonb not null,
  expected_characteristics jsonb not null default '[]'::jsonb,
  golden_output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  weight numeric(6,3) not null default 1 check (weight >= 0),
  scoring_type text not null default 'scale' check (scoring_type in ('binary','scale','reference')),
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  workflow_id uuid references public.workflows(id) on delete set null,
  benchmark_case_id uuid references public.benchmark_cases(id) on delete set null,
  actual_output jsonb not null,
  scores jsonb not null default '{}'::jsonb,
  failure_codes text[] not null default '{}',
  reviewer_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.failure_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete set null,
  workflow_id uuid references public.workflows(id) on delete set null,
  code text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  remediation text,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_owner on public.projects(owner_user_id);
create index if not exists idx_prompts_owner on public.prompts(owner_user_id);
create index if not exists idx_prompts_project on public.prompts(project_id);
create index if not exists idx_prompt_versions_prompt on public.prompt_versions(prompt_id);
create index if not exists idx_workflows_owner on public.workflows(owner_user_id);
create index if not exists idx_benchmarks_owner on public.benchmark_cases(owner_user_id);
create index if not exists idx_eval_runs_owner on public.evaluation_runs(owner_user_id);

-- Make Data API exposure explicit. RLS controls rows; grants control table reachability.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter table public.domains enable row level security;
alter table public.projects enable row level security;
alter table public.context_packs enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.prompt_components enable row level security;
alter table public.prompt_version_components enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.benchmark_cases enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.failure_logs enable row level security;

create policy domains_select on public.domains for select
  to authenticated using (is_system = true or owner_user_id = (select auth.uid()));
create policy domains_insert on public.domains for insert
  to authenticated with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy domains_update on public.domains for update
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()) and is_system = false);
create policy domains_delete on public.domains for delete
  to authenticated using (owner_user_id = (select auth.uid()) and is_system = false);

create policy projects_all on public.projects for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy context_packs_all on public.context_packs for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy prompts_all on public.prompts for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy prompt_versions_all on public.prompt_versions for all
  to authenticated using ((select owner_user_id from public.prompts p where p.id = prompt_id) = (select auth.uid()))
  with check ((select owner_user_id from public.prompts p where p.id = prompt_id) = (select auth.uid()));
create policy prompt_components_all on public.prompt_components for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy prompt_version_components_all on public.prompt_version_components for all
  to authenticated using ((select owner_user_id from public.prompts p join public.prompt_versions pv on pv.prompt_id = p.id where pv.id = prompt_version_id) = (select auth.uid()))
  with check ((select owner_user_id from public.prompts p join public.prompt_versions pv on pv.prompt_id = p.id where pv.id = prompt_version_id) = (select auth.uid()));
create policy workflows_all on public.workflows for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy workflow_steps_all on public.workflow_steps for all
  to authenticated using ((select owner_user_id from public.workflows w where w.id = workflow_id) = (select auth.uid()))
  with check ((select owner_user_id from public.workflows w where w.id = workflow_id) = (select auth.uid()));
create policy benchmarks_all on public.benchmark_cases for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy evaluation_criteria_all on public.evaluation_criteria for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy evaluation_runs_all on public.evaluation_runs for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy failure_logs_all on public.failure_logs for all
  to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

-- Cover the workflow run current-step foreign key for status/checkpoint lookups.
create index if not exists idx_workflow_runs_current_step
  on public.workflow_runs(current_step_id);

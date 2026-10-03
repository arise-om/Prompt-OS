import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('workflow repository loads an accessible workflow with steps and edges from Supabase', () => {
  const repo = read('apps/web/lib/workflow-repository.ts');
  assert.match(repo, /getAccessibleWorkflowById/);
  assert.match(repo, /from\("workflows"\)/);
  assert.match(repo, /from\("workflow_steps"\)/);
  assert.match(repo, /from\("workflow_edges"\)/);
  assert.match(repo, /is_system/);
});

test('workflow persistence has authenticated create and update RPC boundaries', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(actions, /"use server"/);
  assert.match(actions, /createWorkflowRun/);
  assert.match(actions, /updateWorkflowRun/);
  assert.match(actions, /getClaims/);
});

test('workflow page exposes run, approval resume, status, and failure evidence', () => {
  const page = read('apps/web/app/workflows/page.tsx');
  assert.match(page, /Run workflow/);
  assert.match(page, /Approve/);
  assert.match(page, /Reject/);
  assert.match(page, /Pending approval/);
  assert.match(page, /Failure evidence/);
});

test('workflow approval action refuses to resume against a changed workflow version', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(actions, /run\.workflowVersion/);
  assert.match(actions, /workflow\.version/);
  assert.match(actions, /workflow_changed/);
});

test('workflow action does not expose model credentials to the client', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.doesNotMatch(actions, /NEXT_PUBLIC_OPENAI/);
  assert.doesNotMatch(actions, /OPENAI_API_KEY[^\n]*searchParams/);
});

test('workflow persistence migration protects run rows by authenticated ownership', () => {
  const migration = read('supabase/migrations/0009_workflow_run_state.sql');
  const indexMigration = read('supabase/migrations/0010_workflow_run_current_step_index.sql');
  assert.match(migration, /create table if not exists public\.workflow_runs/);
  assert.match(migration, /alter table public\.workflow_runs enable row level security/);
  assert.match(migration, /create policy workflow_runs_select/);
  assert.match(migration, /create policy workflow_runs_update/);
  assert.match(migration, /create or replace function public\.create_workflow_run/);
  assert.match(migration, /create or replace function public\.update_workflow_run/);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\)/);
  assert.match(indexMigration, /idx_workflow_runs_current_step/);
});

test('workflow runner adapter supports model-backed executable steps and rejects unsupported tool execution explicitly', () => {
  const adapter = read('apps/web/lib/openai-responses-adapter.ts');
  assert.match(adapter, /createWorkflowStepExecutor/);
  assert.match(adapter, /WORKFLOW_TOOL_UNSUPPORTED/);
});

test('home page exposes the workflow engine entry point', () => {
  const page = read('apps/web/app/page.tsx');
  assert.match(page, /href="\/workflows"/);
  assert.match(page, /Open Workflow Engine/);
});

test('workflow page exposes promotion readiness and promotion action', () => {
  const page = read('apps/web/app/workflows/page.tsx');
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(page, /Promotion/);
  assert.match(actions, /promoteWorkflow/);
});

test('workflow repository exposes promotion readiness and promotion history boundaries', () => {
  const repo = read('apps/web/lib/workflow-repository.ts');
  assert.match(repo, /getWorkflowPromotionEvidence/);
  assert.match(repo, /promoteAccessibleWorkflow/);
});

test('workflow promotion migration is owner-scoped and records the promoted version', () => {
  const migration = read('supabase/migrations/0011_workflow_promotion_gates.sql');
  assert.match(migration, /create table if not exists public\.workflow_promotions/);
  assert.match(migration, /workflow_version/);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /create or replace function public\.promote_workflow/);
});

test('workflow promotion action uses a server-side promotion RPC and surfaces gate blockers', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(actions, /promote_workflow|promoteAccessibleWorkflow/);
  assert.match(actions, /promotion_blocked/);
});


test('workflow server actions inject the shared workflow tool capability registry into the model adapter', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(actions, /getWorkflowToolCapability/);
  assert.match(actions, /toolCapabilityResolver:\s*getWorkflowToolCapability/);
});

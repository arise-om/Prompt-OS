import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('workflow clone repository exposes an authenticated user-owned clone boundary', () => {
  const repo = read('apps/web/lib/workflow-repository.ts');
  assert.match(repo, /cloneAccessibleWorkflow/);
  assert.match(repo, /create_workflow_clone/);
  assert.match(repo, /sourceWorkflowId/);
});

test('workflow clone action validates ownership and redirects to the new workflow', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  assert.match(actions, /export async function cloneWorkflow/);
  assert.match(actions, /getAccessibleWorkflowById/);
  assert.match(actions, /cloneAccessibleWorkflow/);
  assert.match(actions, /workflow_cloned/);
});

test('workflow page exposes clone as an editable workflow action', () => {
  const page = read('apps/web/app/workflows/page.tsx');
  assert.match(page, /Duplicate as editable/);
  assert.match(page, /action=?cloneWorkflow|cloneWorkflow/);
});

test('workflow clone migration creates a draft owned by the authenticated user with remapped steps and edges', () => {
  const migration = read('supabase/migrations/0015_workflow_clone.sql');
  assert.match(migration, /create or replace function public\.create_workflow_clone/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /'draft'/);
  assert.match(migration, /false,\s*v_user_id/);
  assert.match(migration, /'draft'/);
  assert.match(migration, /'1\.0\.0'/);
  assert.match(migration, /gen_random_uuid\(\)/);
  assert.match(migration, /workflow_steps/);
  assert.match(migration, /workflow_edges/);
  assert.match(migration, /revoke execute.*anon/i);
  assert.match(migration, /grant execute.*authenticated/i);
});

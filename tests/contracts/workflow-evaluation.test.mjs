import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('workflow evaluation bridge executes benchmarks through the workflow engine and persists workflow-scoped evidence', () => {
  const repo = read('apps/web/lib/evaluation-repository.ts');
  assert.match(repo, /runWorkflowBenchmarkSuite/);
  assert.match(repo, /selectWorkflowCompatibleBenchmarks/);
  assert.match(repo, /compatibleBenchmarks/);
  assert.match(repo, /executeWorkflow/);
  assert.match(repo, /resumeWorkflow/);
  assert.match(repo, /decision:\s*"approved"/);
  assert.match(repo, /workflowId:\s*input\.workflow\.id/);
  assert.match(repo, /benchmarkCaseId:\s*caseResult\.benchmarkId/);
  assert.match(repo, /failure_codes|failures/);
  assert.match(repo, /benchmarkCaseId:\s*failedCase\.benchmarkId/);
  assert.match(repo, /actualOutput: \{ benchmarkCaseId: failedCase\.benchmarkId, error: failedCase\.error \}/);
});


test('workflow evaluation evidence is bound to the evaluated workflow version', () => {
  const repo = read('apps/web/lib/evaluation-repository.ts');
  const workflowRepo = read('apps/web/lib/workflow-repository.ts');
  const dbTypes = read('packages/db-types/src/index.ts');
  const migration = read('supabase/migrations/0013_workflow_evaluation_version.sql');
  const failureMigration = read('supabase/migrations/0014_benchmark_failure_evidence.sql');

  assert.match(repo, /workflowId:\s*input\.workflow\.id/);
  assert.match(workflowRepo, /workflow_version/);
  assert.match(workflowRepo, /getWorkflowPromotionEvidence\(workflowId: string, workflowVersion: string\)/);
  assert.match(workflowRepo, /eq\(\"workflow_version\",\s*workflowVersion\)/);
  assert.match(dbTypes, /workflow_version: string \| null;/);
  assert.match(migration, /add column if not exists workflow_version text/);
  assert.match(migration, /create or replace function public\.create_evaluation_run/);
  assert.match(migration, /select id, version into v_workflow_id, v_workflow_version/);
  assert.match(migration, /e\.workflow_version/);
  assert.match(migration, /workflow_id = p_workflow_id\s+and workflow_version = v_workflow\.version/);
  assert.match(migration, /create or replace function public\.promote_workflow/);
  assert.match(migration, /raise exception 'average evaluation score %\.3f is below minimum %\.3f', v_average_score, p_min_score;/);
  assert.ok(failureMigration.includes("cardinality(coalesce(p_failure_codes, '{}'::text[])) = 0"));
  assert.ok(failureMigration.includes("if cardinality(coalesce(p_failure_codes, '{}'::text[])) = 0 then"));
});

test('workflow page action exposes a benchmark-suite evaluation action', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  const page = read('apps/web/app/workflows/page.tsx');
  assert.match(actions, /runWorkflowBenchmarkSuite/);
  assert.match(actions, /workflow_evaluated/);
  assert.match(page, /Run benchmark suite/);
  assert.match(page, /failed\?: string/);
  assert.match(page, /reason\?: string/);
});


test('workflow evaluation action keeps successful redirect outside the model-error catch', () => {
  const actions = read('apps/web/app/workflows/actions.ts');
  const action = actions.slice(actions.indexOf('export async function runWorkflowEvaluation'));
  const catchIndex = action.indexOf('} catch {');
  const successRedirectIndex = action.indexOf('status=workflow_evaluated');
  assert.ok(catchIndex >= 0, 'expected model-error catch');
  assert.ok(successRedirectIndex > catchIndex, 'successful redirect must execute after the catch block');
});


test('research benchmark coverage includes dedicated entry-contract cases for promotion evidence', () => {
  const seed = read('supabase/migrations/0004_seed_prompt_os_catalog.sql');
  const coverage = read('supabase/migrations/0016_research_benchmark_coverage.sql');
  for (const name of [
    'Research ROS 2 navigation technology',
    'Research self-driving laboratories',
    'Research vision-language-action robotics',
  ]) {
    assert.match(seed, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(coverage, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(coverage, /question/);
  assert.match(coverage, /General Output Quality/);
  assert.match(coverage, /Evidence Discipline/);
  assert.match(coverage, /Actionability/);
});

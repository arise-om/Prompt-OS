import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('evaluation lab exposes a server action that executes and persists a selected benchmark', () => {
  const actions = read('apps/web/app/evaluations/actions.ts');
  assert.match(actions, /"use server"/);
  assert.match(actions, /runSystemBenchmarkCase/);
  assert.match(actions, /createConfiguredOpenAIResponsesAdapter/);
  assert.doesNotMatch(actions, /NEXT_PUBLIC_OPENAI/);
});

test('evaluation lab UI exposes version and benchmark selection plus regression summary', () => {
  const page = read('apps/web/app/evaluations/page.tsx');
  assert.match(page, /compareEvaluationRuns/);
  assert.match(page, /name="benchmarkCaseId"/);
  assert.match(page, /name="promptVersionId"/);
  assert.match(page, /Run evaluation/);
  assert.match(page, /Regression/);
});

test('evaluation lab repository scopes version and run reads through Supabase', () => {
  const repo = read('apps/web/lib/evaluation-lab-repository.ts');
  assert.match(repo, /from\("prompt_versions"\)/);
  assert.match(repo, /from\("evaluation_runs"\)/);
  assert.match(repo, /getSystemPromptById/);
  assert.match(repo, /getCurrentUserPromptById/);
});


test('evaluation action keeps successful redirect outside the model-error catch', () => {
  const actions = read('apps/web/app/evaluations/actions.ts');
  const tryBlock = actions.match(/try \{([\s\S]*?)\} catch/);
  assert.ok(tryBlock, 'expected model execution try/catch');
  assert.doesNotMatch(tryBlock[1], /status=completed/);
  assert.match(actions, /catch \{[\s\S]*status=model_failed/);
  assert.match(actions, /}\r?\n\r?\n  redirect\(`\/evaluations\?promptId=.*status=completed/);
});

test('evaluation action exposes a full benchmark suite action', () => {
  const actions = read('apps/web/app/evaluations/actions.ts');
  assert.match(actions, /runEvaluationSuite/);
  assert.match(actions, /runSystemBenchmarkSuite/);
  assert.match(actions, /"suite_completed"/);
  assert.match(actions, /"suite_partial"/);
});

test('evaluation lab UI exposes a full suite run and aggregate summary', () => {
  const page = read('apps/web/app/evaluations/page.tsx');
  assert.match(page, /Run full suite/);
  assert.match(page, /Suite result/);
  assert.match(page, /suiteAverage/);
  assert.match(page, /suite_partial/);
});

test('evaluation lab repository can load all runs for one immutable version', () => {
  const repo = read('apps/web/lib/evaluation-lab-repository.ts');
  assert.match(repo, /getEvaluationRunsForPromptVersion/);
  assert.match(repo, /eq\("prompt_version_id", normalizedId\)/);
});

test('partial suite redirect exposes the failed benchmark count', () => {
  const actions = read('apps/web/app/evaluations/actions.ts');
  const page = read('apps/web/app/evaluations/page.tsx');
  assert.match(actions, /failed=\$\{result\.failedCases\.length\}/);
  assert.match(page, /params\.failed/);
});

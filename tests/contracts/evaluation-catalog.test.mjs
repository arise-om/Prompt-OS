import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('evaluation catalog reads system benchmarks and rubrics from Supabase', () => {
  const repo = read('apps/web/lib/evaluation-catalog-repository.ts');
  assert.match(repo, /\.from\("benchmark_cases"\)/);
  assert.match(repo, /\.from\("evaluation_criteria"\)/);
  assert.match(repo, /is_system/);
  assert.doesNotMatch(repo, /any/);
});

test('evaluation bridge runs a benchmark through evaluation-core and persists its result', () => {
  const repo = read('apps/web/lib/evaluation-repository.ts');
  assert.match(repo, /runBenchmarkCase/);
  assert.match(repo, /createEvaluationRun/);
  assert.match(repo, /getSystemBenchmarkById/);
  assert.match(repo, /getSystemEvaluationCriteria/);
});

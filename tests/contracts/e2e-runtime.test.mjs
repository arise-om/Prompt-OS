import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Playwright runtime config targets a single Chromium smoke project with the app base URL', () => {
  const config = read('playwright.config.ts');
  assert.match(config, /defineConfig/);
  assert.match(config, /process\.env\.PROMPT_OS_BASE_URL/);
  assert.match(config, /chromium/);
  assert.match(config, /tests\/e2e/);
});

test('authenticated workflow E2E uses a Supabase admin-generated magic link without exposing service credentials to the browser', () => {
  const spec = read('tests/e2e/workflow-runtime.spec.ts');
  assert.match(spec, /admin\.generateLink/);
  assert.match(spec, /type:\s*["']magiclink["']/);
  assert.match(spec, /SUPABASE_SECRET_KEY/);
  assert.match(spec, /page\.goto\(confirmURL\.toString\(\)\)/);
  assert.doesNotMatch(spec, /service_role.*page\.evaluate/);
});

test('workflow E2E clones a system template, evaluates the real benchmark suite, then verifies persisted evidence', () => {
  const spec = read('tests/e2e/workflow-runtime.spec.ts');
  assert.match(spec, /Research Workflow/);
  assert.match(spec, /Duplicate as editable/);
  assert.match(spec, /Run benchmark suite/);
  assert.match(spec, /workflow_evaluated/);
  assert.match(spec, /evaluation_runs/);
  assert.match(spec, /workflow_version/);
  assert.match(spec, /evaluationRunsForWorkflow/);
  assert.match(spec, /BLOCKED/);
  assert.match(spec, /toBeGreaterThanOrEqual\(3\)/);
  assert.match(spec, /failure_codes/);
});

test('CI installs Playwright Chromium and runs the authenticated E2E suite only when live E2E variables are enabled', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /playwright install --with-deps chromium/);
  assert.match(ci, /PROMPT_OS_E2E_ENABLED/);
  assert.match(ci, /pnpm test:e2e/);
  assert.match(ci, /playwright install --with-deps chromium/);
  assert.match(ci, /PROMPT_OS_E2E_EMAIL/);
  assert.match(ci, /SUPABASE_SECRET_KEY/);
});

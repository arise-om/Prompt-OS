import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('runtime preflight exposes health validation, config checks, and fail-closed exit behavior', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.match(script, /export function validateHealthPayload/);
  assert.match(script, /export function validateRequiredEnvironment/);
  assert.match(script, /PROMPT_OS_BASE_URL/);
  assert.match(script, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(script, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(script, /OPENAI_API_KEY/);
  assert.match(script, /process\.exitCode\s*=\s*1/);
});

test('runtime preflight never prints secret values', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.doesNotMatch(script, /console\.(log|error)\([^\n]*(?:API_KEY|PUBLISHABLE_KEY|SECRET)/);
  assert.match(script, /SET|missing/i);
});

test('runtime preflight can require model credentials only for an explicit live-provider check', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.match(script, /requireModel|PROMPT_OS_REQUIRE_MODEL/);
  assert.match(script, /OPENAI_API_KEY.*(?:optional|required)|(?:optional|required).*OPENAI_API_KEY/i);
});

test('runtime preflight can perform one explicit minimal Responses API provider check without exposing the key', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.match(script, /runOpenAIModelCheck/);
  assert.match(script, /api\.openai\.com\/v1\/responses/);
  assert.match(script, /Authorization.*Bearer/);
  assert.match(script, /store:\s*false/);
  assert.match(script, /max_output_tokens:\s*16/);
  assert.doesNotMatch(script, /console\.(log|error)\([^\n]*environment\.OPENAI_API_KEY/);
});

test('repository CI uses the shared runtime preflight command', () => {
  const packageJson = JSON.parse(read('package.json'));
  const ci = read('.github/workflows/ci.yml');
  assert.equal(packageJson.scripts['preflight:runtime'], 'node scripts/runtime-preflight.mjs');
  assert.match(ci, /pnpm preflight:runtime/);
  assert.match(ci, /PROMPT_OS_BASE_URL/);
});

test('runtime preflight treats only a completed Responses API object as a successful model check', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.match(script, /response\.json\(\)/);
  assert.match(script, /payload\.object\s*===\s*['"]response['"]/);
  assert.match(script, /payload\.status\s*===\s*['"]completed['"]/);
});

test('runtime preflight reports the live model check only when explicitly requested', () => {
  const script = read('scripts/runtime-preflight.mjs');
  assert.match(script, /result\.requireModel/);
  assert.match(script, /Model provider:.*result\.modelCheck/);
});

test('CI has an opt-in live OpenAI provider smoke job guarded by repository secrets', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /provider-smoke:/);
  assert.match(ci, /vars\.PROMPT_OS_LIVE_PROVIDER_ENABLED/);
  assert.match(ci, /secrets\.OPENAI_API_KEY/);
  assert.match(ci, /PROMPT_OS_REQUIRE_MODEL:\s*true/);
  assert.match(ci, /pnpm preflight:runtime/);
});

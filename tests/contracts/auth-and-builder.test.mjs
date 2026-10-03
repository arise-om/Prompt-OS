import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Supabase SSR uses cookie-backed server client and getClaims refresh path', () => {
  const server = read('apps/web/lib/supabase/server.ts');
  const proxy = read('apps/web/lib/supabase/proxy.ts');
  assert.match(server, /createServerClient/);
  assert.match(server, /cookies\(\)/);
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/);
});

test('clone action never accepts an owner id from the browser', () => {
  const action = read('apps/web/app/builder/actions.ts');
  assert.match(action, /p_domain_slug/);
  assert.match(action, /create_prompt_clone/);
  assert.doesNotMatch(action, /owner_user_id.*form/);
});

test('builder submits through the server action', () => {
  const page = read('apps/web/app/builder/page.tsx');
  assert.match(page, /action=\{savePromptDraft\}/);
  assert.match(page, /template_id/);
});

test('prompt detail resolves both system and current-user prompts', () => {
  const detail = read('apps/web/app/library/[id]/page.tsx');
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(detail, /getCurrentUserPromptById/);
  assert.match(repo, /export async function getCurrentUserPromptById/);
  assert.match(repo, /\.eq\(['"]id['"], id\)/);
});

test('Supabase access layer uses checked-in database types', () => {
  const server = read('apps/web/lib/supabase/server.ts');
  const client = read('apps/web/lib/supabase/client.ts');
  const browserRepo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(server, /Database/);
  assert.match(client, /Database/);
  assert.doesNotMatch(browserRepo, /: any/);
  assert.match(read('packages/db-types/src/index.ts'), /export type Database/);
});

test('builder exposes the structured composer and live audit fields', () => {
  const page = read('apps/web/app/builder/page.tsx');
  const composer = read('apps/web/components/prompt-composer.tsx');
  assert.match(page, /PromptComposer/);
  assert.match(composer, /name=\{field\.key\}/);
  for (const field of ['instructions', 'goal', 'context', 'inputs', 'constraints', 'audience', 'output', 'quality', 'verification']) {
    assert.match(composer, new RegExp(`key: "${field}"`));
  }
  assert.match(composer, /name="variables"/);
  assert.match(composer, /auditPrompt/);
  assert.match(composer, /composePromptDraft/);
});

test('clone action sends structured JSON values to the typed RPC', () => {
  const action = read('apps/web/app/builder/actions.ts');
  assert.match(action, /p_variables: variables/);
  assert.match(action, /p_required_context: jsonArray\(draft\.context\)/);
  assert.match(action, /p_constraints: jsonArray\(draft\.constraints\)/);
  assert.match(action, /p_evaluation_criteria: \[draft\.quality, draft\.verification\]\.filter\(Boolean\)/);
  assert.doesNotMatch(action, /p_variables: JSON\.stringify/);
});

test('personal prompt repository uses typed parent/version queries instead of untyped reverse nesting', () => {
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(repo, /\.from\("prompts"\)/);
  assert.match(repo, /\.from\("prompt_versions"\)/);
  assert.doesNotMatch(repo, /prompt_versions\(id,version/);
  assert.doesNotMatch(repo, /function mapUserPrompt\(prompt: any/);
});

test('personal prompt repository keeps domain mapping typed too', () => {
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(repo, /\.from\("domains"\)/);
  assert.doesNotMatch(repo, /domains\(slug\)/);
});

test('editing an owned prompt creates a new immutable version through the version RPC', () => {
  const action = read('apps/web/app/builder/actions.ts');
  const migration = read('supabase/migrations/0006_create_prompt_version_function.sql');
  assert.match(action, /create_prompt_version/);
  assert.match(action, /getCurrentUserPromptById/);
  assert.match(action, /p_prompt_id/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /parent_version_id/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /revoke execute/i);
  assert.match(migration, /grant execute.*authenticated/i);
  assert.match(migration, /drop policy if exists prompt_versions_update/i);
  assert.match(migration, /drop policy if exists prompt_versions_delete/i);
  assert.match(migration, /split_part\(v_latest_version, '\.', 2\)::integer \+ 1/i);
});

test('builder can load an owned prompt for editing and preserves the edit id', () => {
  const page = read('apps/web/app/builder/page.tsx');
  assert.match(page, /getCurrentUserPromptById/);
  assert.match(page, /searchParams: Promise<\{[^}]*id\?/s);
  assert.match(page, /name="prompt_id"/);
  assert.match(page, /Save new version/);
  assert.match(page, /nextMinorVersion\(source\.version\)/);
});

test('prompt detail links owned prompts to the editor and renders version history', () => {
  const detail = read('apps/web/app/library/[id]/page.tsx');
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(detail, /\/builder\?id=/);
  assert.match(detail, /getCurrentUserPromptVersions/);
  assert.match(detail, /Version history/);
  assert.match(repo, /export async function getCurrentUserPromptVersions/);
});


test('prompt detail renders the saved Prompt Auditor snapshot for owned prompts', () => {
  const detail = read('apps/web/app/library/[id]/page.tsx');
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(detail, /Saved Prompt Auditor/);
  assert.match(detail, /prompt\.promptAudit\.score/);
  assert.match(repo, /promptAuditResult/);
  assert.match(repo, /audit_score/);
  assert.match(repo, /audit_findings/);
  assert.match(repo, /audit_missing_sections/);
});

test('version comparison reads only versions owned through the parent prompt', () => {
  const repo = read('apps/web/lib/user-prompt-repository.ts');
  assert.match(repo, /export async function getCurrentUserPromptVersionComparison/);
  assert.match(repo, /getCurrentUserPromptById\(promptId\)/);
  assert.match(repo, /\.eq\(['"]prompt_id['"], promptId\)/);
  assert.match(repo, /\.in\(['"]id['"], \[normalizedFromVersionId, normalizedToVersionId\]\)/);
});

test('prompt detail exposes explicit version comparison controls and renders diff output', () => {
  const detail = read('apps/web/app/library/[id]/page.tsx');
  assert.match(detail, /compareFrom/);
  assert.match(detail, /compareTo/);
  assert.match(detail, /getCurrentUserPromptVersionComparison/);
  assert.match(detail, /comparePromptVersions/);
  assert.match(detail, /version-diff/);
});

test('saved prompt versions persist the exact Prompt Auditor snapshot', () => {
  const action = read('apps/web/app/builder/actions.ts');
  const migration = read('supabase/migrations/0007_prompt_audit_snapshots_and_evaluation_metadata.sql');
  assert.match(action, /auditPrompt/);
  assert.match(action, /function auditFindingsJson/);
  assert.match(action, /p_audit_score: audit\.score/);
  assert.match(action, /p_audit_findings: auditFindingsJson\(audit\.findings\)/);
  assert.match(action, /p_audit_missing_sections: audit\.missingSections/);
  assert.match(action, /p_audit_score: audit\.score/);
  assert.match(action, /p_audit_findings: auditFindingsJson\(audit\.findings\)/);
  assert.match(action, /p_audit_missing_sections: audit\.missingSections/);
  assert.match(migration, /audit_score/);
  assert.match(migration, /audit_findings/);
  assert.match(migration, /audit_missing_sections/);
});

test('evaluation runs keep an optional prompt audit snapshot', () => {
  const shared = read('packages/shared-types/src/index.ts');
  const db = read('packages/db-types/src/index.ts');
  const migration = read('supabase/migrations/0007_prompt_audit_snapshots_and_evaluation_metadata.sql');
  assert.match(shared, /promptAudit\?: PromptAuditResult/);
  assert.match(db, /prompt_audit_snapshot/);
  assert.match(migration, /prompt_audit_snapshot/);
});

test('evaluation run creation delegates audit provenance to the authenticated RPC', () => {
  const repo = read('apps/web/lib/evaluation-repository.ts');
  const migration = read('supabase/migrations/0008_create_evaluation_run_function.sql');
  assert.match(repo, /export async function createEvaluationRun/);
  assert.match(repo, /rpc\("create_evaluation_run"/);
  assert.match(repo, /p_scores: scores/);
  assert.doesNotMatch(repo, /input\.promptAudit/);
  assert.match(migration, /prompt_audit_snapshot/);
  assert.match(migration, /jsonb_build_object/);
  assert.match(migration, /pv\.audit_score/);
});

test('evaluation persistence uses an atomic authenticated RPC and normalizes criterion scores', () => {
  const repo = read('apps/web/lib/evaluation-repository.ts');
  const migration = read('supabase/migrations/0008_create_evaluation_run_function.sql');
  assert.match(repo, /create_evaluation_run/);
  assert.match(repo, /scores/);
  assert.match(migration, /create or replace function public\.create_evaluation_run/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /benchmark_case_criteria/);
  assert.match(migration, /evaluation_run_scores/);
  assert.match(migration, /prompt_audit_snapshot/);
  assert.match(migration, /revoke execute/i);
  assert.match(migration, /grant execute.*authenticated/i);
});

test('evaluation regression comparison is defined in the evaluation-core package', () => {
  const core = read('packages/evaluation-core/src/index.ts');
  assert.match(core, /export function compareEvaluationRuns/);
  assert.match(core, /regressions/);
  assert.match(core, /improvements/);
});

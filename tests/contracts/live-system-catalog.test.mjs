import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('system prompt repository reads system prompts and their versions from Supabase', () => {
  const repo = read('apps/web/lib/prompt-repository.ts');
  assert.match(repo, /createClient/);
  assert.match(repo, /\.from\(["']prompts["']\)/);
  assert.match(repo, /\.eq\(["']is_system["'],\s*true\)/);
  assert.match(repo, /\.from\(["']prompt_versions["']\)/);
  assert.match(repo, /\.in\(["']prompt_id["'],/);
  assert.doesNotMatch(repo, /systemPromptCatalog/);
});

test('system prompt mapper preserves the existing PromptDefinition contract', async () => {
  const { mapSystemPromptRecord } = await import('../../apps/web/lib/system-prompt-mapper.ts');
  const mapped = mapSystemPromptRecord({
    id: 'system-1',
    name: 'Research Brief',
    description: 'Evidence-driven research',
    intent: 'research',
    complexity: 4,
    status: 'validated',
    is_system: true,
    tags: ['research', 'evidence'],
    domainSlug: 'research',
    latest: {
      id: 'version-1',
      prompt_id: 'system-1',
      version: '1.0.0',
      body: 'Research {{topic}}',
      variables: ['topic'],
      required_context: ['scope'],
      optional_context: ['audience'],
      constraints: ['Use primary sources.'],
      expected_output: 'Brief',
      evaluation_criteria: ['evidence-discipline'],
      created_at: '2026-10-02T00:00:00.000Z',
      parent_version_id: null,
      change_summary: 'Initial system catalog template',
      audit_score: 92,
      audit_findings: [{ code: 'MISSING_OUTPUT', severity: 'warning', message: 'Example finding', remediation: 'Define output.' }],
      audit_missing_sections: ['output'],
    },
  });

  assert.deepEqual(mapped, {
    id: 'system-1',
    name: 'Research Brief',
    description: 'Evidence-driven research',
    intent: 'research',
    domain: 'research',
    complexity: 4,
    status: 'validated',
    isSystem: true,
    version: '1.0.0',
    body: 'Research {{topic}}',
    variables: ['topic'],
    requiredContext: ['scope'],
    optionalContext: ['audience'],
    constraints: ['Use primary sources.'],
    expectedOutput: 'Brief',
    evaluationCriteria: ['evidence-discipline'],
    benchmarkCaseIds: [],
    tags: ['research', 'evidence'],
    promptAudit: {
      score: 92,
      findings: [{ code: 'MISSING_OUTPUT', severity: 'warning', message: 'Example finding', remediation: 'Define output.' }],
      missingSections: ['output'],
    },
  });
});

test('library no longer imports the fixture catalog', () => {
  const library = read('apps/web/lib/prompt-repository.ts');
  assert.doesNotMatch(library, /prompt-catalog/);
  assert.doesNotMatch(library, /filterPrompts\(systemPromptCatalog/);
});

import test from 'node:test';
import assert from 'node:assert/strict';

const { auditPrompt } = await import('../../packages/prompt-core/src/index.ts');

const complete = {
  body: 'You are a senior reviewer. Produce a structured engineering review for the supplied project.',
  goal: 'Review the project and identify the most important engineering risks.',
  context: 'Use the project requirements, architecture notes, and test evidence supplied by the user.',
  inputs: 'Project description, repository notes, and test results.',
  constraints: 'Do not invent facts. Separate evidence from assumptions. Keep the review actionable.',
  audience: 'Robotics engineering student and project mentor.',
  output: 'Return a prioritized table followed by recommended next actions.',
  quality: 'Accuracy, evidence traceability, relevance, and practical usefulness.',
  verification: 'Flag unsupported claims and verify every high-impact recommendation against the supplied evidence.',
  variables: ['project']
};

test('auditPrompt gives a high score to a complete structured prompt', () => {
  const result = auditPrompt(complete);
  assert.ok(result.score >= 90);
  assert.deepEqual(result.missingSections, []);
  assert.equal(result.findings.some((finding) => finding.severity === 'critical'), false);
});

test('auditPrompt identifies missing core sections', () => {
  const result = auditPrompt({ body: 'Do the task.' });
  assert.ok(result.missingSections.includes('goal'));
  assert.ok(result.missingSections.includes('verification'));
  assert.ok(result.findings.some((finding) => finding.code === 'MISSING_GOAL'));
  assert.ok(result.score < 60);
});

test('auditPrompt flags unresolved variables and ambiguous language', () => {
  const result = auditPrompt({
    ...complete,
    body: 'Review {{project}} and return an appropriate answer etc.',
    variables: []
  });
  assert.ok(result.findings.some((finding) => finding.code === 'UNRESOLVED_VARIABLE'));
  assert.ok(result.findings.some((finding) => finding.code === 'AMBIGUOUS_LANGUAGE'));
});

test('composePromptDraft renders structured sections and omits empty sections', async () => {
  const { composePromptDraft } = await import('../../packages/prompt-core/src/index.ts');
  const result = composePromptDraft({
    goal: 'Review the system.',
    context: 'Use the supplied requirements.',
    inputs: '',
    constraints: 'Do not invent facts.',
    audience: 'Engineering mentor.',
    output: 'Return a concise review.',
    quality: 'Evidence and relevance.',
    verification: 'Check claims before finalizing.'
  });

  assert.match(result, /## Goal/);
  assert.match(result, /## Context/);
  assert.doesNotMatch(result, /## Inputs/);
  assert.match(result, /## Verification/);
});

test('auditPrompt snapshots contain only stable persisted audit fields', async () => {
  const { createPromptAuditSnapshot } = await import('../../packages/prompt-core/src/index.ts');
  const result = auditPrompt(complete);
  const snapshot = createPromptAuditSnapshot(result);

  assert.deepEqual(snapshot, {
    score: result.score,
    findings: result.findings,
    missingSections: result.missingSections,
  });
  assert.notEqual(snapshot.findings, result.findings);
  assert.notEqual(snapshot.missingSections, result.missingSections);
});

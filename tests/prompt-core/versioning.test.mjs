import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMinorVersion } from '../../packages/prompt-core/src/index.ts';

test('nextMinorVersion advances the minor segment and resets patch', () => {
  assert.equal(nextMinorVersion('1.0.0'), '1.1.0');
  assert.equal(nextMinorVersion('2.7.4'), '2.8.0');
});

test('nextMinorVersion treats malformed versions as the first editable release', () => {
  assert.equal(nextMinorVersion('draft'), '1.0.0');
  assert.equal(nextMinorVersion(''), '1.0.0');
});

test('parsePromptDraft restores composer sections without nesting the compiled prompt', async () => {
  const { parsePromptDraft } = await import('../../packages/prompt-core/src/index.ts');
  const body = [
    '## Instructions\nKeep it concise.',
    '## Goal\nExplain the system.',
    '## Context\nUse the supplied notes.',
    '## Output\nA short report.'
  ].join('\n\n');
  assert.deepEqual(parsePromptDraft(body), {
    instructions: 'Keep it concise.',
    goal: 'Explain the system.',
    context: 'Use the supplied notes.',
    inputs: '',
    constraints: '',
    audience: '',
    output: 'A short report.',
    quality: '',
    verification: ''
  });
});

test('comparePromptVersions reports added, removed, and unchanged lines in order', async () => {
  const { comparePromptVersions } = await import('../../packages/prompt-core/src/index.ts');
  assert.deepEqual(comparePromptVersions(
    'Line one\nLine two\nLine four',
    'Line one\nLine three\nLine four\nLine five',
  ), {
    lines: [
      { type: 'context', text: 'Line one', oldLine: 1, newLine: 1 },
      { type: 'removed', text: 'Line two', oldLine: 2 },
      { type: 'added', text: 'Line three', newLine: 2 },
      { type: 'context', text: 'Line four', oldLine: 3, newLine: 3 },
      { type: 'added', text: 'Line five', newLine: 4 },
    ],
    added: 2,
    removed: 1,
    unchanged: 2,
  });
});

test('comparePromptVersions normalizes line endings and handles identical empty bodies', async () => {
  const { comparePromptVersions } = await import('../../packages/prompt-core/src/index.ts');
  assert.deepEqual(comparePromptVersions('A\r\nB', 'A\nB'), {
    lines: [
      { type: 'context', text: 'A', oldLine: 1, newLine: 1 },
      { type: 'context', text: 'B', oldLine: 2, newLine: 2 },
    ],
    added: 0,
    removed: 0,
    unchanged: 2,
  });

  assert.deepEqual(comparePromptVersions('', ''), {
    lines: [],
    added: 0,
    removed: 0,
    unchanged: 0,
  });
});

test('comparePromptVersions preserves meaningful leading and trailing whitespace changes', async () => {
  const { comparePromptVersions } = await import('../../packages/prompt-core/src/index.ts');
  assert.deepEqual(comparePromptVersions(' A', 'A '), {
    lines: [
      { type: 'removed', text: ' A', oldLine: 1 },
      { type: 'added', text: 'A ', newLine: 1 },
    ],
    added: 1,
    removed: 1,
    unchanged: 0,
  });
});

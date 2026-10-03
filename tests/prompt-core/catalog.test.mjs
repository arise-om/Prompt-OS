import test from 'node:test';
import assert from 'node:assert/strict';

const { filterPrompts, getPromptById } = await import('../../packages/prompt-core/src/index.ts');

const prompts = [
  {
    id: 'p1', name: 'Research Brief', description: 'Evidence-driven research', intent: 'research',
    domain: 'research', complexity: 4, status: 'validated', isSystem: true, version: '1.0.0', body: 'Research {{topic}}',
    variables: ['topic'], requiredContext: [], optionalContext: [], constraints: [], expectedOutput: 'Report',
    evaluationCriteria: [], benchmarkCaseIds: [], tags: ['evidence', 'research']
  },
  {
    id: 'p2', name: 'Robotics Planner', description: 'Plan a ROS2 robot', intent: 'plan',
    domain: 'robotics', complexity: 4, status: 'validated', isSystem: true, version: '1.0.0', body: 'Plan {{system}}',
    variables: ['system'], requiredContext: [], optionalContext: [], constraints: [], expectedOutput: 'Architecture',
    evaluationCriteria: [], benchmarkCaseIds: [], tags: ['ROS2', 'robotics']
  }
];

test('filterPrompts matches name, description, and tags case-insensitively', () => {
  assert.equal(filterPrompts(prompts, 'ros2')[0].id, 'p2');
  assert.equal(filterPrompts(prompts, 'EVIDENCE')[0].id, 'p1');
  assert.equal(filterPrompts(prompts, 'robotics planner')[0].id, 'p2');
});

test('filterPrompts returns every prompt for an empty query', () => {
  assert.equal(filterPrompts(prompts, '').length, 2);
});

test('getPromptById returns null for unknown IDs', () => {
  assert.equal(getPromptById(prompts, 'missing'), null);
});

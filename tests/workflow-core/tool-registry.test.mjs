import test from 'node:test';
import assert from 'node:assert/strict';

const {
  getWorkflowToolCapability,
  isWorkflowStepToolSupported,
} = await import('../../packages/workflow-core/src/index.ts');

test('workflow tool registry recognizes web_search for research and explicit tool steps', () => {
  assert.deepEqual(getWorkflowToolCapability({ type: 'research', config: {} }), {
    id: 'web_search',
    stepTypes: ['research', 'tool'],
  });
  assert.deepEqual(getWorkflowToolCapability({ type: 'tool', config: { tool: 'web_search' } }), {
    id: 'web_search',
    stepTypes: ['research', 'tool'],
  });
});

test('workflow tool registry rejects unsupported or malformed tool steps', () => {
  assert.equal(isWorkflowStepToolSupported({ type: 'tool', config: { tool: 'shell' } }), false);
  assert.equal(isWorkflowStepToolSupported({ type: 'tool', config: {} }), false);
  assert.equal(isWorkflowStepToolSupported({ type: 'prompt', config: {} }), true);
});

test('workflow promotion uses the same capability registry as execution', async () => {
  const core = await import('../../packages/workflow-core/src/index.ts');
  const workflow = {
    id: 'wf', name: 'Tool', purpose: 'test', trigger: 'manual',
    steps: [
      { id: 'research', type: 'research', name: 'Research', purpose: 'search', inputKeys: [], outputKeys: ['evidence'], config: {} },
    ],
    edges: [], dependencies: [], tools: ['web_search'], approvalRequired: false,
    evaluationIds: [], failureStates: [], version: '1.0.0', status: 'validated', isSystem: false,
  };
  const result = core.evaluateWorkflowPromotion(workflow, {
    evaluationRunCount: 3, distinctBenchmarkCount: 3, averageScore: 90, failedRunCount: 0,
  });
  assert.equal(result.checks.supportedTools, true);
  assert.equal(result.allowed, true);
});

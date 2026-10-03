import test from 'node:test';
import assert from 'node:assert/strict';

const { evaluateWorkflowPromotion } = await import('../../packages/workflow-core/src/index.ts');

function workflow(overrides = {}) {
  return {
    id: 'wf-1',
    name: 'Promotion candidate',
    purpose: 'test',
    trigger: 'manual',
    steps: [
      { id: 'start', type: 'input', name: 'Start', purpose: 'Capture input', inputKeys: ['request'], outputKeys: ['request'], config: {} },
      { id: 'finish', type: 'output', name: 'Finish', purpose: 'Return result', inputKeys: ['request'], outputKeys: ['result'], config: {} },
    ],
    edges: [{ id: 'e1', fromStepId: 'start', toStepId: 'finish', condition: {}, priority: 0 }],
    dependencies: [],
    tools: [],
    approvalRequired: false,
    evaluationIds: [],
    failureStates: [],
    version: '1.0.0',
    status: 'validated',
    isSystem: false,
    ...overrides,
  };
}

const passingEvidence = {
  evaluationRunCount: 3,
  distinctBenchmarkCount: 3,
  averageScore: 86,
  failedRunCount: 0,
};

test('promotion gate passes a validated workflow with representative successful evaluations', () => {
  const result = evaluateWorkflowPromotion(workflow({ status: 'validated' }), passingEvidence);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.blockers, []);
});

test('promotion gate blocks workflows without enough benchmark coverage or score', () => {
  const result = evaluateWorkflowPromotion(
    workflow({ status: 'validated' }),
    { evaluationRunCount: 2, distinctBenchmarkCount: 1, averageScore: 79, failedRunCount: 0 },
  );
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((item) => /benchmark coverage/i.test(item)));
  assert.ok(result.blockers.some((item) => /average evaluation score/i.test(item)));
});

test('promotion gate requires approval protection for consequential tool steps', () => {
  const result = evaluateWorkflowPromotion(
    workflow({
      status: 'validated',
      steps: [
        { id: 'tool', type: 'tool', name: 'Publish', purpose: 'Publish externally', inputKeys: [], outputKeys: ['result'], config: { tool: 'web_search', requiresApproval: true } },
      ],
    }),
    passingEvidence,
  );
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((item) => /approval/i.test(item)));
});

test('promotion gate rejects unsupported tools before production promotion', () => {
  const result = evaluateWorkflowPromotion(
    workflow({
      status: 'validated',
      steps: [
        { id: 'tool', type: 'tool', name: 'Execute', purpose: 'Execute external action', inputKeys: [], outputKeys: [], config: { tool: 'shell' } },
      ],
    }),
    passingEvidence,
  );
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((item) => /unsupported tool/i.test(item)));
});

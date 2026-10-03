import test from 'node:test';
import assert from 'node:assert/strict';

const {
  executeWorkflow,
  resumeWorkflow,
  evaluateWorkflowCondition,
} = await import('../../packages/workflow-core/src/index.ts');

function step(id, type, inputKeys = [], outputKeys = [], config = {}) {
  return { id, type, name: id, purpose: id, inputKeys, outputKeys, config };
}

function edge(id, fromStepId, toStepId, condition = {}, priority = 0) {
  return { id, fromStepId, toStepId, condition, priority };
}

function workflow(steps, edges, overrides = {}) {
  return {
    id: 'wf-1',
    name: 'Test workflow',
    purpose: 'test',
    trigger: 'test',
    steps,
    edges,
    dependencies: [],
    tools: [],
    approvalRequired: false,
    evaluationIds: [],
    failureStates: [],
    version: '1.0.0',
    status: 'validated',
    isSystem: true,
    ...overrides,
  };
}

test('executeWorkflow runs a linear graph and returns produced data', async () => {
  const wf = workflow(
    [
      step('input', 'input', ['request'], ['request']),
      step('prompt', 'prompt', ['request'], ['draft']),
      step('output', 'output', ['draft'], ['result']),
    ],
    [edge('e1', 'input', 'prompt'), edge('e2', 'prompt', 'output')],
  );

  const result = await executeWorkflow({
    workflow: wf,
    input: { request: 'hello' },
    executeStep: async ({ step: current, data }) => ({
      [current.outputKeys[0]]: `${data.request}:done`,
    }),
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.data.result, 'hello:done');
  assert.deepEqual(result.events.map((event) => event.type), [
    'step_started', 'step_completed',
    'step_started', 'step_completed',
    'step_started', 'step_completed',
    'workflow_completed',
  ]);
});

test('evaluateWorkflowCondition supports empty, comparison, and key-to-key conditions', () => {
  assert.equal(evaluateWorkflowCondition({}, { mastery: 70 }), true);
  assert.equal(evaluateWorkflowCondition({ when: 'mastery<target' }, { mastery: 70, target: 80 }), true);
  assert.equal(evaluateWorkflowCondition({ when: 'mastery<target' }, { mastery: 90, target: 80 }), false);
  assert.equal(evaluateWorkflowCondition({ when: 'status==approved' }, { status: 'approved' }), true);
});

test('executeWorkflow chooses the highest-priority passing edge for conditional branches', async () => {
  const wf = workflow(
    [step('start', 'input', [], ['status']), step('fallback', 'output'), step('approved', 'output')],
    [
      edge('fallback-edge', 'start', 'fallback', {}, 0),
      edge('approved-edge', 'start', { id: 'approved' }.id, { when: 'status==approved' }, 10),
    ],
  );

  const result = await executeWorkflow({
    workflow: wf,
    input: { status: 'approved' },
    executeStep: async () => ({}),
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.events.find((event) => event.type === 'step_started' && event.stepId === 'approved')?.stepId, 'approved');
});

test('executeWorkflow pauses at approval steps and resumeWorkflow continues after approval', async () => {
  const wf = workflow(
    [step('start', 'input', [], ['ready']), step('approval', 'approval', ['ready'], [], { reason: 'Review before delivery' }), step('output', 'output')],
    [edge('e1', 'start', 'approval'), edge('e2', 'approval', 'output')],
  );

  const paused = await executeWorkflow({
    workflow: wf,
    input: { ready: true },
    executeStep: async () => ({}),
  });

  assert.equal(paused.status, 'paused');
  assert.equal(paused.pendingApproval?.stepId, 'approval');

  const resumed = await resumeWorkflow({
    workflow: wf,
    checkpoint: paused,
    decision: 'approved',
    executeStep: async () => ({ result: 'delivered' }),
  });

  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.data.result, 'delivered');
});

test('resumeWorkflow rejects an approval and records failure evidence', async () => {
  const wf = workflow(
    [step('approval', 'approval', [], [])],
    [],
  );
  const paused = await executeWorkflow({ workflow: wf, input: {}, executeStep: async () => ({}) });
  const rejected = await resumeWorkflow({
    workflow: wf,
    checkpoint: paused,
    decision: 'rejected',
    executeStep: async () => ({}),
  });

  assert.equal(rejected.status, 'failed');
  assert.equal(rejected.failure?.code, 'WORKFLOW_APPROVAL_REJECTED');
  assert.equal(rejected.failure?.stepId, 'approval');
});

test('executeWorkflow retries a failing executable step within its configured bound', async () => {
  const wf = workflow(
    [step('retryable', 'tool', [], ['result'], { maxAttempts: 3 })],
    [],
  );
  let attempts = 0;

  const result = await executeWorkflow({
    workflow: wf,
    input: {},
    executeStep: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('temporary failure');
      return { result: 'ok' };
    },
  });

  assert.equal(result.status, 'completed');
  assert.equal(attempts, 3);
  assert.equal(result.attempts.retryable, 3);
});

test('executeWorkflow fails with bounded failure evidence when retries are exhausted', async () => {
  const wf = workflow(
    [step('broken', 'tool', [], [], { maxAttempts: 2 })],
    [],
  );

  const result = await executeWorkflow({
    workflow: wf,
    input: {},
    executeStep: async () => { throw new Error('provider down'); },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failure?.code, 'WORKFLOW_STEP_FAILED');
  assert.equal(result.failure?.stepId, 'broken');
  assert.equal(result.failure?.attempts, 2);
  assert.match(result.failure?.message, /provider down/);
});

test('executeWorkflow stops a loop at the transition bound with explicit failure evidence', async () => {
  const wf = workflow(
    [step('loop', 'condition', [], ['count'])],
    [edge('loop-edge', 'loop', 'loop')],
  );

  const result = await executeWorkflow({
    workflow: wf,
    input: {},
    maxTransitions: 3,
    executeStep: async ({ data }) => ({ count: Number(data.count ?? 0) + 1 }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failure?.code, 'WORKFLOW_TRANSITION_LIMIT');
  assert.equal(result.failure?.stepId, 'loop');
  assert.equal(result.transitions, 3);
});

test('executeWorkflow fails when a declared input key is missing', async () => {
  const wf = workflow([step('input', 'input', ['request'], ['request'])], []);

  const result = await executeWorkflow({
    workflow: wf,
    input: {},
    executeStep: async () => ({ request: 'never' }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failure?.code, 'WORKFLOW_MISSING_INPUT');
  assert.deepEqual(result.failure?.missingKeys, ['request']);
});

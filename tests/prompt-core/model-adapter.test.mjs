import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { createOpenAIResponsesAdapter, parseScoringJson } = await import('../../apps/web/lib/openai-responses-adapter.ts');

const webSearchCapability = { id: 'web_search', stepTypes: ['research', 'tool'] };
const registryResolver = (step) => {
  if (step.type === 'research') return webSearchCapability;
  if (step.type === 'tool' && step.config.tool === 'web_search') return webSearchCapability;
  return undefined;
};

const response = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('parseScoringJson extracts a strict criterion score object', () => {
  assert.deepEqual(
    parseScoringJson('{"rubric-quality": 82, "rubric-format": 100}'),
    { 'rubric-quality': 82, 'rubric-format': 100 },
  );
});

test('parseScoringJson accepts fenced JSON but rejects non-numeric scores', () => {
  assert.deepEqual(
    parseScoringJson('```json\n{"rubric-quality": 82}\n```'),
    { 'rubric-quality': 82 },
  );
  assert.throws(
    () => parseScoringJson('{"rubric-quality":"82"}'),
    /criterion scores must be numbers/,
  );
});

test('OpenAI Responses adapter returns output_text from a successful response', async () => {
  const fetchImpl = async (_input, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gpt-6-luna');
    assert.equal(body.input[0].role, 'user');
    return response({ output_text: 'hello from model' });
  };
  const adapter = createOpenAIResponsesAdapter({ apiKey: 'test-key', model: 'gpt-6-luna', fetchImpl });
  assert.equal(await adapter.generateText('Say hello.'), 'hello from model');
});

test('OpenAI Responses adapter surfaces provider failures', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 });
  const adapter = createOpenAIResponsesAdapter({ apiKey: 'test-key', model: 'gpt-6-luna', fetchImpl });
  await assert.rejects(() => adapter.generateText('Say hello.'), /OpenAI request failed: quota exceeded/);
});

test('OpenAI Responses adapter returns structured workflow outputs for declared keys', async () => {
  const fetchImpl = async (_input, init) => {
    const body = JSON.parse(init.body);
    assert.match(body.input[0].content, /OUTPUT KEYS/);
    return response({ output_text: '{"draft":"structured result"}' });
  };
  const adapter = createOpenAIResponsesAdapter({ apiKey: 'test-key', model: 'gpt-6-luna', fetchImpl, toolCapabilityResolver: registryResolver });
  const execute = adapter.createWorkflowStepExecutor();
  const output = await execute({
    workflow: { id: 'wf', name: 'Workflow', purpose: 'test', trigger: 'test', steps: [], edges: [], dependencies: [], tools: [], approvalRequired: false, evaluationIds: [], failureStates: [], version: '1.0.0', status: 'validated', isSystem: true },
    step: { id: 'step', type: 'prompt', name: 'Draft', purpose: 'Draft a result', inputKeys: ['request'], outputKeys: ['draft'], config: {} },
    data: { request: 'hello' },
  });
  assert.deepEqual(output, { draft: 'structured result' });
});

test('OpenAI Responses adapter fails explicitly for unsupported workflow tool steps', () => {
  const adapter = createOpenAIResponsesAdapter({ apiKey: 'test-key', model: 'gpt-6-luna', fetchImpl: async () => response({ output_text: '{}' }) });
  const execute = adapter.createWorkflowStepExecutor();
  return assert.rejects(
    () => execute({
      workflow: { id: 'wf', name: 'Workflow', purpose: 'test', trigger: 'test', steps: [], edges: [], dependencies: [], tools: [], approvalRequired: false, evaluationIds: [], failureStates: [], version: '1.0.0', status: 'validated', isSystem: true },
      step: { id: 'tool', type: 'tool', name: 'Tool', purpose: 'Use a tool', inputKeys: [], outputKeys: [], config: {} },
      data: {},
    }),
    /WORKFLOW_TOOL_UNSUPPORTED/,
  );
});

test('OpenAI Responses adapter uses native web search for research workflow steps and returns citations', async () => {
  const fetchImpl = async (_input, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.tools, [{ type: 'web_search', search_context_size: 'low' }]);
    return response({
      output_text: '{"evidence":"research result","sources":[{"url":"https://example.com","title":"Example"}]}',
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: '{"evidence":"research result","sources":[{"url":"https://example.com","title":"Example"}]}',
          annotations: [{ type: 'url_citation', url: 'https://example.com', title: 'Example', start_index: 0, end_index: 20 }],
        }],
      }],
    });
  };
  const adapter = createOpenAIResponsesAdapter({ apiKey: 'test-key', model: 'gpt-6-luna', fetchImpl, toolCapabilityResolver: registryResolver });
  const execute = adapter.createWorkflowStepExecutor();
  const output = await execute({
    workflow: { id: 'wf', name: 'Research', purpose: 'test', trigger: 'test', steps: [], edges: [], dependencies: [], tools: [], approvalRequired: false, evaluationIds: [], failureStates: [], version: '1.0.0', status: 'validated', isSystem: true },
    step: { id: 'research', type: 'research', name: 'Research', purpose: 'Find current evidence', inputKeys: ['question'], outputKeys: ['evidence'], config: {} },
    data: { question: 'latest robotics research' },
  });
  assert.deepEqual(output, { evidence: { value: 'research result', sources: [{ url: 'https://example.com', title: 'Example' }] } });
});

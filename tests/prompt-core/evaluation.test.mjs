import test from 'node:test';
import assert from 'node:assert/strict';

const {
  aggregateEvaluationScore,
  compareEvaluationRuns,
  runBenchmarkCase,
  runBenchmarkSuite,
  selectWorkflowCompatibleBenchmarks,
  validateEvaluationScores,
} = await import('../../packages/evaluation-core/src/index.ts');

const criteria = [
  { id: 'quality', name: 'Quality', description: 'Overall quality', weight: 2, scoring: 'scale', isSystem: true },
  { id: 'adherence', name: 'Instruction Adherence', description: 'Follows instructions', weight: 1, scoring: 'scale', isSystem: true },
  { id: 'format', name: 'Format', description: 'Requested format', weight: 1, scoring: 'binary', isSystem: true },
];

test('validateEvaluationScores rejects missing criteria and out-of-range values', () => {
  assert.deepEqual(
    validateEvaluationScores({ quality: 80, format: 100 }, criteria),
    ['Missing score for criterion: adherence'],
  );
  assert.deepEqual(
    validateEvaluationScores({ quality: 101, adherence: 90, format: 100 }, criteria),
    ['Score for quality must be between 0 and 100'],
  );
  assert.deepEqual(
    validateEvaluationScores({ quality: 80, adherence: 90, format: 1 }, criteria),
    ['Binary score for format must be 0 or 100'],
  );
});

test('aggregateEvaluationScore applies criterion weights on a 0-100 scale', () => {
  assert.equal(
    aggregateEvaluationScore({ quality: 80, adherence: 60, format: 100 }, criteria),
    80,
  );
});

test('aggregateEvaluationScore supports benchmark-specific weight overrides', () => {
  assert.equal(
    aggregateEvaluationScore(
      { quality: 80, adherence: 60, format: 100 },
      criteria,
      { adherence: 3 },
    ),
    73.333333,
  );
});

test('runBenchmarkCase executes then scores a benchmark case and returns weighted result', async () => {
  const result = await runBenchmarkCase({
    prompt: { id: 'pv-1', version: '1.1.0', body: 'Do the task.' },
    benchmark: {
      id: 'bench-1',
      category: 'test',
      name: 'Test case',
      input: { request: 'Do it.' },
      expectedCharacteristics: ['clear output'],
      criterionIds: ['quality'],
      isSystem: true,
    },
    criteria: [criteria[0]],
    execute: async ({ prompt, benchmark }) => `${prompt.body} :: ${benchmark.name}`,
    score: async ({ actualOutput }) => ({ quality: actualOutput.length > 0 ? 100 : 0 }),
  });

  assert.equal(result.actualOutput, 'Do the task. :: Test case');
  assert.deepEqual(result.scores, { quality: 100 });
  assert.equal(result.overallScore, 100);
});

test('compareEvaluationRuns reports per-criterion regression deltas', () => {
  const comparison = compareEvaluationRuns(
    {
      id: 'run-old',
      promptVersionId: 'pv-old',
      benchmarkCaseId: 'bench-1',
      actualOutput: 'old',
      scores: { quality: 90, adherence: 80, overall: 85 },
      failures: [],
    },
    {
      id: 'run-new',
      promptVersionId: 'pv-new',
      benchmarkCaseId: 'bench-1',
      actualOutput: 'new',
      scores: { quality: 85, adherence: 88, overall: 86.5 },
      failures: [],
    },
  );

  assert.deepEqual(comparison.deltas, {
    quality: -5,
    adherence: 8,
    overall: 1.5,
  });
  assert.deepEqual(comparison.regressions, ['quality']);
  assert.deepEqual(comparison.improvements, ['adherence', 'overall']);
});

test('runBenchmarkCase rejects a benchmark when required criteria are not loaded', async () => {
  await assert.rejects(
    () => runBenchmarkCase({
      prompt: { id: 'pv-1', version: '1.1.0', body: 'Do the task.' },
      benchmark: {
        id: 'bench-1',
        category: 'test',
        name: 'Test case',
        input: { request: 'Do it.' },
        expectedCharacteristics: ['clear output'],
        criterionIds: ['quality', 'adherence'],
        isSystem: true,
      },
      criteria: [criteria[0]],
      execute: async () => 'output',
      score: async () => ({ quality: 100 }),
    }),
    /Missing evaluation criteria: adherence/,
  );
});

test('validateEvaluationScores rejects unknown criterion keys', () => {
  assert.deepEqual(
    validateEvaluationScores({ quality: 80, adherence: 90, format: 100, unexpected: 80 }, criteria),
    ['Unknown criterion score: unexpected'],
  );
});

test('selectWorkflowCompatibleBenchmarks uses only the workflow entry-input contract', () => {
  const workflow = {
    id: 'wf-research',
    name: 'Research',
    purpose: 'research',
    trigger: 'manual',
    steps: [
      { id: 's1', type: 'input', name: 'Input', purpose: 'capture', inputKeys: ['question'], outputKeys: ['question'], config: {} },
      { id: 's2', type: 'research', name: 'Research', purpose: 'search', inputKeys: ['question'], outputKeys: ['evidence'], config: {} },
    ],
    edges: [], dependencies: [], tools: ['web_search'], approvalRequired: false, evaluationIds: [], failureStates: [],
    version: '1.0.0', status: 'validated', isSystem: false,
  };
  const benchmarks = [
    { id: 'request-case', category: 'test', name: 'Request case', input: { request: 'hello' }, expectedCharacteristics: [], criterionIds: ['quality'], isSystem: true },
    { id: 'question-case', category: 'test', name: 'Question case', input: { question: 'hello' }, expectedCharacteristics: [], criterionIds: ['quality'], isSystem: true },
    { id: 'mixed-case', category: 'test', name: 'Mixed case', input: { question: 'hello', scope: 'current' }, expectedCharacteristics: [], criterionIds: ['quality'], isSystem: true },
  ];

  assert.deepEqual(
    selectWorkflowCompatibleBenchmarks(workflow, benchmarks).map((benchmark) => benchmark.id),
    ['question-case', 'mixed-case'],
  );
});

test('runBenchmarkSuite executes every benchmark and returns per-case results', async () => {
  const { runBenchmarkSuite } = await import('../../packages/evaluation-core/src/index.ts');
  const calls = [];
  const benchmarks = [
    {
      id: 'bench-1',
      category: 'test',
      name: 'First',
      input: { request: 'one' },
      expectedCharacteristics: ['clear'],
      criterionIds: ['quality'],
      isSystem: true,
    },
    {
      id: 'bench-2',
      category: 'test',
      name: 'Second',
      input: { request: 'two' },
      expectedCharacteristics: ['clear'],
      criterionIds: ['quality'],
      isSystem: true,
    },
  ];

  const result = await runBenchmarkSuite({
    prompt: { id: 'pv-1', version: '1.1.0', body: 'Do the task.' },
    benchmarks,
    criteria: [criteria[0]],
    execute: async ({ benchmark }) => {
      calls.push(benchmark.id);
      return benchmark.name;
    },
    score: async ({ actualOutput }) => ({ quality: actualOutput === 'First' ? 80 : 60 }),
  });

  assert.deepEqual(calls, ['bench-1', 'bench-2']);
  assert.deepEqual(result.caseResults.map((item) => [item.benchmarkId, item.overallScore]), [
    ['bench-1', 80],
    ['bench-2', 60],
  ]);
  assert.equal(result.averageScore, 70);
});

test('runBenchmarkSuite continues after one benchmark fails and reports the failed case', async () => {
  const { runBenchmarkSuite } = await import('../../packages/evaluation-core/src/index.ts');
  const calls = [];
  const benchmarks = [
    {
      id: 'bench-1', category: 'test', name: 'First', input: { request: 'one' },
      expectedCharacteristics: ['clear'], criterionIds: ['quality'], isSystem: true,
    },
    {
      id: 'bench-2', category: 'test', name: 'Broken', input: { request: 'two' },
      expectedCharacteristics: ['clear'], criterionIds: ['quality'], isSystem: true,
    },
    {
      id: 'bench-3', category: 'test', name: 'Third', input: { request: 'three' },
      expectedCharacteristics: ['clear'], criterionIds: ['quality'], isSystem: true,
    },
  ];

  const result = await runBenchmarkSuite({
    prompt: { id: 'pv-1', version: '1.1.0', body: 'Do the task.' },
    benchmarks,
    criteria: [criteria[0]],
    execute: async ({ benchmark }) => {
      calls.push(benchmark.id);
      if (benchmark.id === 'bench-2') throw new Error('provider timeout');
      return benchmark.name;
    },
    score: async () => ({ quality: 100 }),
  });

  assert.deepEqual(calls, ['bench-1', 'bench-2', 'bench-3']);
  assert.deepEqual(result.failedCases, [{ benchmarkId: 'bench-2', error: 'provider timeout' }]);
  assert.deepEqual(result.caseResults.map((item) => [item.benchmarkId, item.overallScore]), [
    ['bench-1', 100],
    ['bench-3', 100],
  ]);
  assert.equal(result.averageScore, 100);
});

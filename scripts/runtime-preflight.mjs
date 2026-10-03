import process from 'node:process';
import { pathToFileURL } from 'node:url';

const REQUIRED_ENVIRONMENT = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
const OPTIONAL_PROVIDER_ENVIRONMENT = ['OPENAI_API_KEY'];

export function validateHealthPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && payload.status === 'ok'
      && payload.service === 'prompt-os-web',
  );
}

export function validateRequiredEnvironment(environment = process.env, { requireModel = false } = {}) {
  const keys = requireModel ? [...REQUIRED_ENVIRONMENT, ...OPTIONAL_PROVIDER_ENVIRONMENT] : REQUIRED_ENVIRONMENT;
  return Object.fromEntries(
    keys.map((key) => [key, Boolean(String(environment[key] ?? '').trim())]),
  );
}

function formatEnvironmentReport(environmentReport) {
  return Object.entries(environmentReport)
    .map(([key, present]) => `${key}: ${present ? 'SET' : 'missing'}`)
    .join('\n');
}


export async function runOpenAIModelCheck({
  fetchImpl = fetch,
  apiKey,
  model,
} = {}) {
  if (!apiKey || !model) return { ok: false, status: 0, reason: 'missing_credentials' };

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: 'Reply with exactly OK.',
      max_output_tokens: 16,
      store: false,
    }),
  });

  if (!response.ok) return { ok: false, status: response.status, reason: 'provider_error' };

  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, status: response.status, reason: 'invalid_provider_response' };
  }

  const completed = Boolean(payload && typeof payload === 'object' && payload.object === 'response' && payload.status === 'completed');
  return { ok: completed, status: response.status, reason: completed ? undefined : 'incomplete_provider_response' };
}

export async function runRuntimePreflight({
  baseUrl = process.env.PROMPT_OS_BASE_URL || 'http://127.0.0.1:3000',
  fetchImpl = fetch,
  environment = process.env,
  requireModel = String(environment.PROMPT_OS_REQUIRE_MODEL ?? '').toLowerCase() === 'true',
} = {}) {
  const environmentReport = validateRequiredEnvironment(environment, { requireModel });
  const response = await fetchImpl(new URL('/api/health', baseUrl));
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const healthOk = response.ok && validateHealthPayload(payload);
  const modelCheck = requireModel
    ? await runOpenAIModelCheck({ fetchImpl, apiKey: environment.OPENAI_API_KEY, model: environment.OPENAI_MODEL })
    : { ok: true, status: 0, reason: 'not_requested' };

  return { environmentReport, healthOk, status: response.status, requireModel, modelCheck };
}

async function main() {
  let result;
  try {
    result = await runRuntimePreflight();
  } catch (error) {
    console.error(`Runtime preflight failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Health endpoint: ${result.healthOk ? 'OK' : 'FAILED'} (HTTP ${result.status})`);
  console.log(formatEnvironmentReport(result.environmentReport));
  if (result.requireModel) console.log(`Model provider: ${result.modelCheck.ok ? 'OK' : 'FAILED'} (HTTP ${result.modelCheck.status || 'n/a'})`);

  if (!result.healthOk || !result.modelCheck.ok || Object.values(result.environmentReport).some((present) => !present)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

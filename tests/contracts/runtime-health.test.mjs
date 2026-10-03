import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('runtime health route exposes a stable liveness response without external credentials', () => {
  const route = read('apps/web/app/api/health/route.ts');
  assert.match(route, /export async function GET/);
  assert.match(route, /NextResponse\.json/);
  assert.match(route, /status:\s*["']ok["']/);
  assert.doesNotMatch(route, /OPENAI_API_KEY/);
  assert.doesNotMatch(route, /SUPABASE_SECRET_KEY/);
});

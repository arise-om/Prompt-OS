import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/0012_workflow_promotion_path_safety.sql'), 'utf8');

test('promotion safety migration checks that every consequential path passes approval', () => {
  assert.match(migration, /WITH RECURSIVE/i);
  assert.match(migration, /seen_approval/i);
  assert.match(migration, /WORKFLOW_PROMOTION_APPROVAL_PATH/i);
});

test('promotion safety migration rejects unreachable workflow steps', () => {
  assert.match(migration, /WORKFLOW_PROMOTION_GRAPH_UNREACHABLE/i);
  assert.match(migration, /NOT EXISTS\s*\(\s*SELECT 1\s+FROM reachable/i);
});

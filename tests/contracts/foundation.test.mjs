import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

test("core contracts and seed files exist", () => {
  const required = [
    "packages/shared-types/src/index.ts",
    "packages/prompt-core/src/index.ts",
    "packages/workflow-core/src/index.ts",
    "packages/evaluation-core/src/index.ts",
    "benchmarks/seed/core-benchmarks.json",
    "benchmarks/seed/core-rubrics.json",
    "docs/architecture/CONTEXT-SCHEMA.md",
    "docs/architecture/TOOL-SCHEMA.md",
    "docs/architecture/FAILURE-TAXONOMY.md"
  ];
  for (const file of required) assert.equal(fs.existsSync(path.join(root, file)), true, file);
});

test("benchmark and rubric seed data are valid JSON", () => {
  const benchmarks = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/seed/core-benchmarks.json"), "utf8"));
  const rubrics = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/seed/core-rubrics.json"), "utf8"));
  assert.ok(Array.isArray(benchmarks));
  assert.ok(benchmarks.length >= 10);
  assert.ok(Array.isArray(rubrics));
  assert.ok(rubrics.length >= 5);
  for (const item of benchmarks) {
    assert.equal(typeof item.id, "string");
    assert.ok(Array.isArray(item.criterionIds));
  }
  for (const item of rubrics) {
    assert.equal(typeof item.id, "string");
    assert.equal(typeof item.weight, "number");
  }
});

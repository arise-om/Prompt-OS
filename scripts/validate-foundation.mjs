import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const required = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "package.json",
  "pnpm-workspace.yaml",
  ".env.example",
  "docs/product/PRD.md",
  "docs/architecture/SYSTEM.md",
  "docs/architecture/DATA-MODEL.md",
  "docs/architecture/PROMPT-SCHEMA.md",
  "docs/architecture/WORKFLOW-SCHEMA.md",
  "docs/architecture/EVALUATION-SCHEMA.md",
  "docs/architecture/SECURITY.md",
  "docs/requirements.md",
  "apps/web/app/page.tsx",
  "packages/shared-types/src/index.ts",
  "packages/db-types/src/index.ts",
  "packages/prompt-core/src/index.ts",
  "packages/workflow-core/src/index.ts",
  "packages/evaluation-core/src/index.ts",
  "tests/contracts/foundation.test.mjs",
  "benchmarks/seed/core-benchmarks.json",
  "benchmarks/seed/core-rubrics.json",
  "docs/architecture/CONTEXT-SCHEMA.md",
  "docs/architecture/TOOL-SCHEMA.md",
  "docs/architecture/FAILURE-TAXONOMY.md",
  "docs/architecture/EVALUATION-FRAMEWORK.md",
  "docs/architecture/AI-INSTRUCTIONS.md",
  "supabase/migrations/0001_prompt_os_core.sql",
  "supabase/migrations/0002_add_prompt_os_fk_indexes.sql",
  "supabase/migrations/0003_system_content_and_workflow_graph.sql",
  "supabase/migrations/0004_seed_prompt_os_catalog.sql"
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required foundation files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checks = [
  ["package name", pkg.name === "prompt-os"],
  ["private package", pkg.private === true],
  ["workspace package manager", typeof pkg.packageManager === "string" && pkg.packageManager.startsWith("pnpm@")]
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("Foundation metadata checks failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY"]) {
  if (!envExample.includes(`${key}=`)) {
    console.error(`Missing env key declaration: ${key}`);
    process.exit(1);
  }
}

console.log("Foundation validation passed:");
console.log(`- ${required.length} required files present`);
console.log("- package metadata valid");
console.log("- environment template contains required key names");
console.log("- database migration files are present");
console.log("- contract fixtures are present");

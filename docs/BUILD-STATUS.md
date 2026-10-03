# Prompt OS — Build Status

## Current milestone

**Sprint 12 — Workflow tool execution and production promotion gates (complete at source/test level)**

## Delivered in this slice

- Typed Supabase database contract generated from the live Prompt OS schema and checked into `@prompt-os/db-types`.
- Server, browser, and proxy Supabase clients now bind to the database type.
- Personal prompt reads are ownership-scoped through `auth.getClaims()` and use separate typed queries for prompts, versions, and domains.
- Personal prompt detail pages now resolve user-owned prompts as well as system templates.
- Structured Prompt Composer with instructions, goal, context, inputs, constraints, audience, output, quality criteria, verification, and variables.
- Local prompt assembly from structured fields.
- Deterministic Prompt Auditor with score, missing-section findings, ambiguity detection, and unresolved-variable detection.
- Server-side prompt re-assembly before clone/version RPCs, so the saved body is not trusted from a client-only preview.
- JSONB RPC values are sent as structured arrays rather than JSON-encoded strings.
- Owned prompts can be edited from the detail page; saving creates a new version instead of overwriting the previous body.
- Version creation is serialized by locking the owned prompt row, validates ownership in the database, updates editable metadata atomically, and links each version to its parent.
- Version rows are append-only for authenticated users: update/delete RLS policies were removed; the version RPC is executable only by `authenticated`.
- Prompt detail now displays compact version history, and the Composer previews the next minor version number.
- Prompt detail now lets users select any two saved versions and review a deterministic line-level diff with added, removed, and unchanged counts.
- Version comparison reads are scoped to an owned parent prompt and the two requested version IDs before bodies are returned to the UI.
- Each saved prompt version persists an immutable Prompt Auditor snapshot: score, findings, and missing sections.
- Prompt template cloning and prompt editing pass the exact server-side audit result into the version-creation RPC.
- Evaluation runs can retain an execution-time Prompt Auditor snapshot derived from the referenced immutable prompt version.
- Added typed evaluation-run creation and audit summary rendering in the Prompt Library.
- System Prompt Library reads now come from the typed live Supabase catalog instead of the checked-in catalog fixture.
- System prompt versions and domain slugs are resolved with separate typed queries and mapped into the existing `PromptDefinition` contract.
- Library search is applied in the server repository, while domain filtering remains in the server-rendered page.
- The checked-in system catalog is retained only as a development/test fixture and is no longer imported by the production prompt repository.
- Evaluation core now validates criterion score completeness/ranges, supports benchmark-specific weight overrides, aggregates a normalized 0–100 score, executes benchmark cases through injected execution/scoring adapters, and compares runs for per-criterion regressions/improvements.
- System benchmark cases, rubric criteria, and benchmark-to-rubric links now load from the live typed Supabase catalog.
- Evaluation persistence now uses an authenticated atomic RPC that derives Prompt Auditor provenance from the referenced saved prompt version and inserts normalized per-criterion score rows in the same transaction.
- Added a server-only OpenAI Responses adapter using `OPENAI_API_KEY` and configurable `OPENAI_MODEL`; model output is parsed and validated before entering the evaluation engine.
- Added an Evaluation Lab surface to select an immutable prompt version and live benchmark, run execution + rubric scoring server-side, persist the evaluation, and inspect per-criterion regression deltas against the previous evaluated version.
- Evaluation Lab reads accessible prompt versions and persisted evaluation runs through typed Supabase queries; no client-side API key exposure is used.
- Added a provider-neutral benchmark-suite runner that executes every live benchmark sequentially, preserves completed case results when an individual case fails, and reports failed benchmark IDs/errors separately.
- Added a server-only full-suite action that runs all live benchmarks against one immutable prompt version and persists each completed case through the authenticated evaluation RPC.
- Added Evaluation Lab suite analytics showing benchmark coverage, latest saved score per benchmark, average score, and saved-run count for the selected prompt version.
- Added typed repository access for all evaluation runs belonging to one immutable prompt version.

## Verified in this environment

- Supabase Prompt OS project: `ACTIVE_HEALTHY`, region `ap-south-1`.
- Supabase security advisor: zero lints after the latest application/schema work.
- Performance advisor: informational unused-index notices only; no higher-severity performance finding was reported.
- Live Supabase migrations `20261002114928` (`create_prompt_version`), `20261002152505` (`prompt_audit_snapshots_and_evaluation_metadata`), and `20261002154652` (`create_evaluation_run_function`) applied successfully.
- Live function privilege check: present; authenticated can execute; anon and service_role cannot.
- Live `prompt_versions` policies now expose only owner-scoped SELECT and INSERT; no UPDATE or DELETE policy remains.
- Live prompt-version RPC cannot be exercised against a real owned prompt yet because the project currently has no user-owned prompt rows.
- System catalog counts: 16 domains, 11 reusable components, 9 prompts, 9 prompt versions, 6 workflows, 32 steps, 27 edges, 12 benchmarks, 6 criteria, 36 benchmark links.
- Full Prompt OS test suite: 92/92 passing after the workflow execution, tool-adapter, promotion-gate, and path-safety work, including partial-suite evaluation reporting and workflow approval/resume contracts.
- Foundation validator: passing.
- New model-adapter and Evaluation Lab test imports execute successfully; dedicated source parsing is handled below the full typecheck limitation.
- `git diff --check`: passing.

## Verification limitations

- The container currently has Node `22.16.0`, while the repository pins Node `24.21.0` for the project runtime contract.
- The `agent-browser` verification capability is not installed in this session, so authenticated browser E2E could not be performed here.
- `pnpm` is not installed in the container.
- `node_modules` is absent, so the real Next.js typecheck/build/dev-browser verification remains pending in a dependency-complete environment. The pinned pnpm bootstrap also could not reach the npm registry from this container.
- Vercel authorization currently exposes no accessible teams in this connected session, so no deployment has been created or claimed.
- The production system-library repository no longer imports the checked-in catalog fixture; live DB rows are verified directly in Supabase, while full authenticated browser E2E remains pending in a dependency-complete runtime.
- Evaluation execution remains provider-neutral in `@prompt-os/evaluation-core`; the web app now supplies a concrete server-only OpenAI Responses adapter. The external model call itself was not executed in this environment because no authenticated model-provider run was authorized/available.
- A live query currently finds no user-owned prompts, so personal-library rendering has been verified structurally and by RLS/query design, not against an existing user's saved row.

## Next engineering slice

1. Run authenticated browser E2E against `/evaluations` and `/workflows` in a Node 24 + dependency-complete environment with a configured model provider.
2. Execute a small real model-backed benchmark and workflow run, then verify persisted evaluation/audit/run evidence end to end.
3. Add production-grade external tool adapters beyond native web search and evaluate promotion evidence against real workflow runs.


## Sprint 11 — Workflow Execution & Approval Engine (2026-10-03)

Status: **Source/test verified; runtime/browser verification blocked by environment.**

Delivered:
- Deterministic workflow execution state machine for linear and conditional graphs.
- Explicit approval pause/resume and rejection evidence.
- Bounded step retries and transition limits.
- Persisted `workflow_runs` checkpoints with owner-scoped RLS.
- Server-only OpenAI-backed executable-step adapter; `tool` steps fail explicitly until a tool adapter exists.
- `/workflows` UI with run, approval, history, event log, and failure evidence.
- Approval resume guard rejects stale checkpoints when workflow version changes.
- `workflow_runs.current_step_id` foreign-key index added after Supabase performance review.

Live Supabase migrations for this slice:
- `20261003005153 workflow_run_state`
- `20261003005439 workflow_run_current_step_index`

Verification:
- 81/81 automated tests pass.
- Foundation validation passes.
- `git diff --check` passes.
- Syntax-only TypeScript/TSX parsing reports 0 diagnostics for changed source files.
- Live `workflow_runs` RLS is enabled with owner-scoped SELECT/INSERT/UPDATE policies.
- Workflow run RPCs are `SECURITY INVOKER`; only `authenticated` has EXECUTE.
- Supabase security advisor: 0 lints.
- Performance advisor reports only informational unused-index notices; the new current-step foreign-key finding was fixed.

Runtime limitation:
- Repository requires Node 24.21.x and workspace dependencies.
- Current environment has Node 22.16.0 and no installed workspace dependencies.
- npm registry/network access is unavailable in the container, so a full Next.js build and authenticated browser E2E run remain unverified.
- No real external LLM call was made; the OpenAI adapter is contract-tested but not live-provider-tested with credentials.


## Sprint 12 — Workflow Tool Execution & Production Promotion Gates (2026-10-03)

Status: **Source/test and live-database verified; runtime/browser verification remains environment-blocked.**

Delivered:
- Added native OpenAI web-search execution for `research` steps and explicitly configured `tool:web_search` steps, with returned source metadata preserved in workflow output.
- Added typed workflow promotion-policy evaluation covering graph validity, supported tools, approval protection, benchmark coverage, evaluation quality, and failed-run evidence.
- Added `workflow_promotions` as an owner-scoped promotion history table and a server-side `promote_workflow` RPC.
- Hardened the live promotion RPC with recursive graph reachability and approval-path checks so the database gate matches the application gate.
- Added typed database-contract support for workflow promotions and the promotion RPC.
- Added tests proving unreachable steps and unprotected consequential paths cannot satisfy the database promotion contract.

Live Supabase migrations for this slice:
- `20261003014735 workflow_promotion_gates`
- `20261003014932 workflow_promotion_path_safety`

Verification:
- 92/92 automated tests pass.
- Foundation validation passes.
- `git diff --check` passes.
- Syntax-only TypeScript/TSX parsing reports 0 diagnostics for changed source files.
- Live promotion RPC is `SECURITY INVOKER`; only `authenticated` has EXECUTE; `public`, `anon`, and `service_role` are denied.
- Live `workflow_promotions` rows are protected by authenticated owner-scoped RLS.
- Supabase security advisor: 0 lints.
- Performance advisor reports only informational unused-index notices.

Runtime limitation:
- The repository requires Node 24.21.x, while this container has Node 22.16.0.
- Workspace dependencies and `pnpm` are unavailable, and npm registry access is blocked from the container.
- No browser agent is installed in this session, so authenticated browser E2E remains unverified.
- No live external OpenAI call was made in this environment; the provider adapter is contract-tested.

## Sprint 13 — Runtime Validation & CI Hardening (2026-10-03)

Status: **Source/test verified; full runtime build remains environment-blocked in this container.**

Delivered:
- Added a credential-free `/api/health` liveness route for deployment/runtime smoke checks.
- Added a contract test proving the health route does not depend on OpenAI or Supabase server secrets.
- Updated the root contract-test command so TypeScript-bearing tests run consistently with the core suites.
- Hardened CI to run foundation validation, the full test suite, typecheck, production build, and a live Next.js `/api/health` smoke test on Node 24.21.0 + pnpm 12.8.0.
- CI now runs on both `main` and `master`.
- Documented the runtime smoke-test procedure in `docs/SETUP.md`.

Verification:
- 97/97 automated tests pass with the repository's TypeScript test-runner mode.
- Foundation validation passes.
- `git diff --check` passes.
- Runtime-health contract is green.

Environment limitation:
- This container still has Node 22.16.0, no pnpm, no workspace `node_modules`, and blocked npm-registry access, so the CI production build + live-server smoke path has not been executed locally here.

## Sprint 14 — Evaluation Evidence Integrity (2026-10-03)

Status: **Implemented and live; end-to-end authenticated runtime still awaits a dependency-complete Node 24 environment.**

Delivered:
- Bound workflow evaluation evidence to the exact immutable `workflow_version` that was evaluated.
- Backfilled existing workflow evaluation rows to the workflow version that was current when the migration ran.
- Promotion evidence and the live `promote_workflow` RPC now filter evaluations by workflow ID **and exact workflow version**.
- Failed benchmark evaluations retain their real `benchmark_case_id` while skipping criterion-score rows that cannot be validly computed.
- Benchmark evaluation now explicitly simulates approval checkpoints as `approved` only inside the evaluation harness, allowing approval-protected workflows to complete benchmark runs without changing production workflow execution semantics.
- Added migration/contract coverage for version binding and failed-case benchmark persistence.

Live verification:
- Migration `20261003021257` (`workflow_evaluation_version`) is applied.
- Migration `20261003021508` (`benchmark_failure_evidence`) is applied after it.
- `evaluation_runs.workflow_version` exists and there are currently 0 workflow evaluations without a bound version.
- Current live workflow evaluation row count is 0.
- Supabase Security Advisor: 0 lints.
- Performance Advisor: informational unused-index notices only.

Next runtime proof:
- Run authenticated benchmark suites against a real workflow with a real OpenAI-backed executor.
- Confirm persisted success/failure evidence for the exact workflow version.
- Exercise the production promotion path using those persisted live evaluations.


## Sprint 15 — Runtime Provider Preflight (2026-10-03)

Status: **Source/test verified; live provider check is opt-in and cannot run in this container because no OpenAI credential is configured.**

Delivered:
- Added dependency-free `scripts/runtime-preflight.mjs` for runtime handoff checks.
- Added stable liveness validation for `/api/health`.
- Added fail-closed environment validation without printing secret values.
- Added an explicit opt-in OpenAI Responses API provider check using a single minimal request, `store:false`, and a required `completed` response object.
- Added `pnpm preflight:runtime` as the shared repository command.
- Added an opt-in GitHub Actions `provider-smoke` job controlled by the non-secret repository variable `PROMPT_OS_LIVE_PROVIDER_ENABLED`; the API key and model remain repository secrets.
- Corrected the CI design to avoid using secrets directly in a job-level `if`, which GitHub does not support.

Verification:
- 105/105 automated tests pass.
- GitHub Actions workflow YAML parses successfully with PyYAML.
- Foundation validation passes.
- `git diff --check` passes.
- Live Supabase database remains through migration `20261003021508`.
- Live Supabase Security Advisor: 0 lints.
- Live evaluation rows: 0; workflow evaluations without an exact version binding: 0.

Runtime limitation:
- This container has Node 22.16.0 instead of the repository-required Node 24.21.x.
- `pnpm` and workspace dependencies are unavailable locally, and npm registry access is blocked.
- No OpenAI API key is configured here, so the real provider preflight and model-backed workflow evaluation remain pending in a credentialed runtime.

## Sprint 16 — Workflow Template Cloning & Shared Tool Capabilities (2026-10-03)

Status: **Implemented and live; authenticated end-to-end model execution remains pending in a dependency-complete credentialed runtime.**

Delivered:
- Added a shared workflow tool-capability registry in `@prompt-os/workflow-core`; promotion and executable workflow composition now use the same capability definition for `web_search`.
- Kept the OpenAI adapter provider-neutral by injecting the workflow capability resolver from the server workflow action boundary.
- Added `create_workflow_clone` as an authenticated Supabase RPC for cloning accessible system/user workflows into a user-owned `draft` v1.0.0 workflow.
- Cloning generates fresh step IDs and safely remaps every edge endpoint to the new step IDs.
- Added repository, server-action, and Workflow Engine UI support for “Duplicate as editable”.
- Added typed database contract support and regression coverage for the clone boundary.

Verification:
- 113/113 automated tests pass.
- Foundation validation passes.
- `git diff --check` passes.
- Live migration `20261003023608` (`workflow_clone`) is applied.
- Live clone RPC privilege check: `authenticated` execute = true; `public`, `anon`, and `service_role` execute = false.
- Live user-owned workflow count remains 0; no test workflow data was inserted.
- Supabase Security Advisor: 0 lints.

Runtime limitation:
- This container remains on Node 22.16.0 while the repo requires Node 24.21.x.
- Workspace dependencies and pnpm are unavailable locally, so full Next.js production build/browser E2E cannot be executed here.
- No live OpenAI model-backed workflow evaluation was executed because no provider credential is configured in this environment.

Next runtime proof:
- In a dependency-complete Node 24 environment, sign in with a dedicated test user, clone the seeded Research Workflow, run a real benchmark suite with the OpenAI adapter, confirm version-bound persisted evaluation rows, then exercise the promotion gate against that evidence.

## Sprint 17 — Authenticated Runtime E2E Harness & Research Evidence Coverage (2026-10-03)

Status: **Implemented and verified as source/contracts; live browser/model execution remains environment-gated.**

Delivered:
- Added a Playwright Chromium E2E harness for authenticated Prompt OS workflows.
- Added server-side Supabase magic-link generation for a dedicated disposable E2E user; the browser never receives the Supabase secret key.
- Added an authenticated workflow scenario that clones the seeded Research Workflow and verifies a real persisted `workflow_runs` row with the exact workflow version.
- Added an optional model-backed benchmark scenario that verifies at least three successful benchmark evaluations, zero failed evaluation rows, non-null benchmark IDs, and exact workflow-version binding before assessing the promotion panel.
- Added a shared benchmark compatibility selector based on the first workflow `input` step, preventing unrelated benchmark cases from creating false promotion blockers.
- Added three dedicated Research benchmark cases so the Research Workflow has four compatible cases and can satisfy the default three-benchmark promotion-coverage requirement.
- Added CI support for Playwright Chromium installation and opt-in authenticated E2E execution using `PROMPT_OS_E2E_ENABLED`.

Live Supabase migration:
- `20261003024700 research_benchmark_coverage` (remote migration history may normalize the timestamp/name; current repo migration file is `0016_research_benchmark_coverage.sql`).

Verification:
- 119/119 automated tests pass.
- Foundation validation passes.
- `git diff --check` passes.
- TypeScript syntax-only checks pass for the newly added Playwright and evaluation files.
- Live Research benchmark catalog contains the dedicated research cases linked to three evaluation criteria each.
- Live Supabase Security Advisor: 0 lints.
- Live database currently contains 0 user-owned test workflows and 0 evaluation/promotion rows; no synthetic runtime evidence was created.

Runtime limitation:
- The current container has Node 22.16.0, while the repository requires Node 24.21.x.
- `pnpm`, workspace dependencies, and Chromium are unavailable in the container; npm registry access is blocked.
- No authenticated browser E2E or live OpenAI model execution was performed here.
- Connected Vercel currently exposes no authorized teams/projects for deployment verification.

Next execution step:
- Run `pnpm install`, install Chromium, configure a dedicated E2E Supabase user plus OpenAI credentials, then execute `PROMPT_OS_E2E_ENABLED=true PROMPT_OS_E2E_EVALUATE=true pnpm test:e2e` against a Node 24 build.

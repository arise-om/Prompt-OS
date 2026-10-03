# Codex Handoff — Prompt OS

## User goal
Publish the current Prompt OS project to the GitHub repository:

`https://github.com/arise-om/Prompt-OS`

The GitHub repository is empty and its default branch is `main`.

## Current source of truth
Working tree:
`/mnt/data/prompt-os-work`

Git HEAD:
`cd699e886de4928a4bee37a82cbd7e94ce8e9e5e`

Latest commit:
`feat: prepare authenticated runtime e2e`

Expected project runtime:
- Node `24.21.x`
- pnpm `12.8.0`

Current local verification history:
- 119/119 automated tests passing at the end of Sprint 17
- foundation validation passing
- `git diff --check` passing
- TypeScript syntax-only checks passing for newly added Playwright/evaluation files

## Architecture / milestone state
Prompt OS is a control plane for repeatable AI work.
Lifecycle:
Prompt Library -> Composer -> Auditor -> Immutable Versions -> Version Diff -> Benchmark Evaluation -> Model Adapter -> Evaluation Suite -> Workflow Execution -> Approval Gates -> Promotion -> Runtime Preflight -> User-owned Workflow

Core principles:
- outcome over prompt length
- relevant context
- evidence and verification
- explicit human approval for consequential actions
- everything versioned
- external content treated as untrusted data
- production workflows require a verifiable definition of done

Implemented through Sprint 17:
- structured Prompt Composer
- deterministic Prompt Auditor
- server-side prompt reassembly before persistence
- live Supabase system prompt catalog
- user-owned prompt repository/editing
- immutable prompt versioning via authenticated atomic RPC
- deterministic version diff
- persisted Prompt Auditor snapshots
- evaluation core, scores, weights, aggregate scoring, benchmark execution, suite execution, failure continuation, Evaluation Lab, regression comparison
- graph workflow model and linear/branching execution
- retries, transition limits, input validation
- approval pause/resume and rejection evidence
- durable owner-scoped workflow_runs
- native OpenAI web search execution for research/tool:web_search
- workflow capability registry
- promotion gates including graph validity, tool support, approval-path safety, benchmark/evaluation coverage, exact workflow-version binding, failed evidence checks
- workflow_promotions table and authenticated promote_workflow RPC
- runtime preflight + /api/health
- authenticated E2E harness with server-side Supabase magic-link generation
- workflow clone RPC/repository/UI
- benchmark compatibility filtering
- four compatible Research benchmark cases
- Playwright Chromium CI configuration

## Exact live Supabase project
Project ref: `sivxsvqrbijgdmstzehm`
URL: `https://sivxsvqrbijgdmstzehm.supabase.co`
Region: `ap-south-1`
Status: ACTIVE_HEALTHY

Current migration history through:
- `20261002111938 prompt_os_core`
- `20261002112007 add_prompt_os_fk_indexes`
- `20261002112344 system_content_and_workflow_graph`
- `20261002112539 seed_prompt_os_catalog`
- `20261002114928 create_prompt_version`
- `20261002152505 prompt_audit_snapshots_and_evaluation_metadata`
- `20261002154652 create_evaluation_run_function`
- `20261003005153 workflow_run_state`
- `20261003005439 workflow_run_current_step_index`
- `20261003014735 workflow_promotion_gates`
- `20261003014932 workflow_promotion_path_safety`
- `20261003021257 workflow_evaluation_version`
- `20261003021508 benchmark_failure_evidence`
- `20261003023608 workflow_clone`
- `20261003024700 research_benchmark_coverage`

Important live catalog:
- system workflows: 6
- workflow steps: 32
- workflow edges: 27
- benchmark cases: 15 total
- evaluation criteria: 6
- user-owned workflows: 0
- evaluation runs: 0
- workflow promotions: 0

Research Workflow:
- id `7b546450-ef56-47ca-b759-059d205056d9`
- name `Research Workflow`
- version `1.0.0`
- status `validated`
- approval_required `false`
- steps:
  1. input — Define question — input `question` -> `research_brief`
  2. research — Gather evidence — `research_brief` -> `evidence`
  3. prompt — Synthesize — `evidence` -> `draft`
  4. evaluation — Audit evidence — `draft`,`evidence` -> `evaluation`
  5. output — Publish brief — `draft`,`evaluation` -> `result`

Four compatible research benchmarks include:
- Research current robotics technology
- Research ROS 2 navigation technology
- Research self-driving laboratories
- Research vision-language-action robotics

Default promotion thresholds:
- 3 successful evaluation runs
- 3 distinct benchmarks
- average score >= 80
- zero failed evaluation evidence
- workflow must be tested/validated
- exact workflow version match
- supported tools
- consequential steps need approval on every reachable path

## Critical runtime limitation to resolve in Codex
The previous environment could not run real runtime E2E because it had Node 22.16.0, no pnpm, no node_modules, blocked npm registry access, and no provider credential.

Codex should use a dependency-complete Node 24 environment and run the actual E2E where credentials are available.

Do NOT commit secrets.
Do NOT put `SUPABASE_SECRET_KEY` or `OPENAI_API_KEY` in browser/client env.

## Immediate GitHub publication task
The repository `arise-om/Prompt-OS` is empty.

Use the authenticated GitHub account/connection that owns `arise-om` and push the current source tree to `main`.

Preferred sequence:
1. Inspect the working tree and `.gitignore`.
2. Ensure secrets, `.env`, `node_modules`, build output, Playwright artifacts, and other generated files are excluded.
3. Preserve the existing local git history where practical, or create a clean initial repository history if required by the GitHub tooling.
4. Push to `https://github.com/arise-om/Prompt-OS` on `main`.
5. Verify the remote branch and repository contents after pushing.

Do not claim success until the remote `main` branch and representative files are freshly verified.

## Runtime verification after publication
When Node 24 + pnpm + dependencies + Chromium are available:

```bash
pnpm install
pnpm validate:foundation
pnpm test
pnpm exec playwright install --with-deps chromium
```

Run authenticated E2E:

```bash
PROMPT_OS_E2E_ENABLED=true \
PROMPT_OS_BASE_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SUPABASE_URL=https://sivxsvqrbijgdmstzehm.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
SUPABASE_SECRET_KEY=<test-only-secret> \
PROMPT_OS_E2E_EMAIL=<dedicated-test-user@example.com> \
OPENAI_API_KEY=<provider-key> \
OPENAI_MODEL=<provider-model> \
PROMPT_OS_E2E_EVALUATE=true \
pnpm test:e2e
```

The E2E should verify:
- authenticated sign-in
- clone seeded Research Workflow into a user-owned draft
- real workflow execution
- persisted `workflow_runs`
- exact workflow version binding
- benchmark compatibility filtering
- at least 3 successful benchmark evaluations
- 0 failed evaluation rows for the selected workflow version
- real benchmark IDs retained
- promotion panel/evidence respects exact workflow version

## Project docs to read first
- `AGENTS.md`
- `README.md`
- `docs/BUILD-STATUS.md`
- `docs/SETUP.md`
- `docs/architecture/SYSTEM.md`
- `docs/architecture/SECURITY.md`
- `docs/architecture/TOOL-SCHEMA.md`
- `docs/architecture/WORKFLOW-SCHEMA.md`
- `docs/architecture/EVALUATION-FRAMEWORK.md`
- `docs/architecture/DATA-MODEL.md`

## Notes about the attempted publication
The standard GitHub connector in the previous environment could read `arise-om/Prompt-OS` and reported Admin/Push permissions after connecting the `arise-om` account, but both GitHub write endpoints (`create_file` and `create_blob`) returned HTTP 403 `Resource not accessible by integration`.

Therefore no repository files were published through that connector and the GitHub repo should still be treated as empty until Codex verifies otherwise.

## Useful source checkpoint archive
`/mnt/data/prompt-os-sprint-17-authenticated-runtime-e2e.tar.gz`

SHA-256:
`811a4ce735b8686cbcbd5dbed439c4658fe1ad2af19d029c52d1e53753e7b662`

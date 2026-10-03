# Prompt OS

Prompt OS is a control plane for repeatable AI work: prompts, context, workflows, evaluations, domain packs and reusable knowledge.

## Current status
Sprint 17 in progress — versioned prompts, benchmark evaluation, executable workflows, approval gates, production promotion controls, runtime preflight, shared tool capabilities, and user-owned workflow cloning.

## Stack target
- Next.js + TypeScript
- Supabase/PostgreSQL
- Vercel
- GitHub
- Figma
- Notion

## Development principles
Inspect → Plan → Implement → Test → Review → Verify.

## Start later
The first dependency installation requires network/package-registry access. Once available:

```bash
corepack enable
pnpm install
pnpm validate:foundation
pnpm dev
```

## Authenticated runtime E2E
For a real end-to-end run, use Node 24.21.x + pnpm 12.8.0 and a disposable Supabase Auth user. The browser never receives `SUPABASE_SECRET_KEY`; the test runner uses it only to generate a one-time magic link and inspect isolated test data.

```bash
pnpm exec playwright install --with-deps chromium
PROMPT_OS_E2E_ENABLED=true \
PROMPT_OS_BASE_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
SUPABASE_SECRET_KEY=<test-only-secret> \
PROMPT_OS_E2E_EMAIL=<dedicated-test-user@example.com> \
OPENAI_API_KEY=<provider-key> \
OPENAI_MODEL=<provider-model> \
pnpm test:e2e
```

For the benchmark-evidence test, also set `PROMPT_OS_E2E_EVALUATE=true`. That scenario clones the seeded Research Workflow, runs only benchmarks matching its `question` entry contract, checks version-bound persisted evidence, and evaluates the production promotion gate.

## Documentation
- [PRD](docs/product/PRD.md)
- [System architecture](docs/architecture/SYSTEM.md)
- [Data model](docs/architecture/DATA-MODEL.md)
- [Prompt schema](docs/architecture/PROMPT-SCHEMA.md)
- [Workflow schema](docs/architecture/WORKFLOW-SCHEMA.md)
- [Evaluation schema](docs/architecture/EVALUATION-SCHEMA.md)
- [Security](docs/architecture/SECURITY.md)
- [AI operating instructions](docs/architecture/AI-INSTRUCTIONS.md)
- [Capability routing](docs/architecture/CAPABILITY-ROUTING.md)
- [Evaluation framework](docs/architecture/EVALUATION-FRAMEWORK.md)
- [Build status](docs/BUILD-STATUS.md)
- [Setup & runtime verification](docs/SETUP.md)
- [Sprint 02 plan](docs/superpowers/plans/2026-10-02-prompt-library-cloning.md)

# Prompt OS — Setup Baseline

## Verified environment (2026-10-02)
- Node.js 24.x is the current LTS line; the official download page lists 24.21.0 LTS.
- pnpm 12.8 was released on 2026-09-28.
- Next.js 16.3.8 is the current Active LTS patch following the September 30, 2026 security release.
- `@supabase/supabase-js` 2.117.2 is the current Supabase JS release as of 2026-09-25.

## Local project policy
Use Node 24 LTS + pnpm 12.x for the initial build.

## Installation
```bash
corepack enable
pnpm install
pnpm validate:foundation
```

## Run
```bash
pnpm dev
```

## Runtime preflight
The repository includes a dependency-free preflight command that checks the live `/api/health` response and reports whether the required Supabase client variables are present. It never prints secret values.

```bash
pnpm build
pnpm --filter @prompt-os/web start
# in another shell
PROMPT_OS_BASE_URL=http://127.0.0.1:3000 pnpm preflight:runtime
```

For an explicit live-provider check, add `PROMPT_OS_REQUIRE_MODEL=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. The preflight makes one minimal Responses API request with `store:false` and requires a completed response object.

Expected liveness response:
`{"status":"ok","service":"prompt-os-web"}`

## External environment
### Supabase
A dedicated Prompt OS Supabase project has been created in `ap-south-1` (project ref `sivxsvqrbijgdmstzehm`) and the core, graph, and catalog migrations are applied. The project creation cost reported by the connected Supabase workflow was $0/month. Do not expose or commit project secrets. Built-in system domains, prompt components, evaluation rubrics, benchmark cases, prompt templates, and workflow templates have been seeded.

### Vercel
The connected Vercel integration currently has no visible team authorization in this session, so no Vercel project has been created or modified.

### GitHub
The local repository is ready at `/mnt/data/prompt-os`. No remote repository has been created yet because the connected GitHub account does not expose a repository-creation action in this session.

## Current build blockers

- The connected Vercel account currently exposes no authorized teams, so Vercel project creation/deployment is intentionally deferred.
- The working container cannot currently reach the npm registry, so package installation and a real Next.js build/dev run must happen in a network-enabled environment.

## Local verification

The foundation can be checked without external packages using:

```bash
node scripts/validate-foundation.mjs
node --test tests/contracts/foundation.test.mjs
git diff --check
```

## Authenticated runtime E2E
Use a dedicated disposable Supabase Auth user for browser verification. Generate the login link with the test runner's server-side secret; never inject `SUPABASE_SECRET_KEY` into page scripts or browser environment variables.

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

Set `PROMPT_OS_E2E_EVALUATE=true` to run the real benchmark-evidence scenario. The test clones the seeded Research Workflow, evaluates only benchmark cases compatible with its first `input` step, and verifies that at least three successful runs are persisted against workflow version `1.0.0` with zero failed runs.

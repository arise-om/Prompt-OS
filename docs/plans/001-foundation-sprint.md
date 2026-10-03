# Foundation Sprint 001

## Goal
Establish a trustworthy foundation for Prompt OS before feature-heavy UI work.

## Completed in this sprint

- Created dedicated Supabase project `Prompt OS` in `ap-south-1`.
- Applied and verified the core schema and FK-index migration.
- Added system-content support for prompts, prompt components, workflows, benchmarks and rubrics.
- Added workflow graph edges and prompt associations.
- Added normalized benchmark-to-criterion and evaluation-run score relationships.
- Added typed shared contracts for prompts, components, workflows and evaluations.
- Added initial benchmark and rubric fixtures.
- Added engineering, security and evaluation documentation.
- Added Node version pin files.

## Verification

- Supabase security advisor: no lints.
- Supabase performance advisor: only unused-index INFO notices remain on the empty database.
- All 13 original core tables exist with RLS enabled.
- Four database migrations are recorded in Supabase and mirrored locally.
- Local foundation validator, contract tests and git whitespace checks must pass before commit.

## Not yet available

- Vercel authorization is not available in the current connected session; no Vercel project has been created.
- No remote GitHub repository has been created yet.
- Local package installation is blocked by the current environment's inability to reach the npm registry; actual Next.js build/dev verification therefore remains pending.

## Exit criteria

1. Migrations 0001–0004 applied and verified.
2. Seed content inserted and verified.
3. Local contract tests pass.
4. Repository is ready for the Prompt Library/Auth slice.

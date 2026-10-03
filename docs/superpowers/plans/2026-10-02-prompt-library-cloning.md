# Prompt Library + Template Cloning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first usable Prompt OS surface: a searchable system prompt library, prompt detail pages, and a clone-to-builder flow that can later persist user-owned copies.

**Architecture:** The UI remains a thin Next.js App Router layer over typed prompt-core domain logic. System catalog data is read through a server-side repository abstraction with a deterministic local fixture fallback until authenticated Supabase access is wired. Cloning is currently an in-memory/client navigation concern; persistence is deliberately deferred to the Auth slice.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, plain CSS modules/global CSS, Node test runner.

**Spec:** `docs/product/PRD.md`, `docs/architecture/PROMPT-SCHEMA.md`, `docs/architecture/SYSTEM.md`

## Global Constraints

- Preserve the existing hybrid ChatGPT control-plane architecture.
- Do not expose Supabase secrets to the browser.
- Do not claim authenticated persistence until Auth is implemented and verified.
- System templates are read-only catalog content in the current slice.
- Follow `AGENTS.md` and `CONTRIBUTING.md`.

## Review Focus

- A system prompt with no optional context still renders valid detail content.
- Search must be case-insensitive and match name, description, intent or tags.
- Invalid prompt IDs must render a stable not-found state.
- Clone navigation must preserve the selected template ID and communicate clone intent.
- The UI must remain usable on narrow screens.

---

### Task 1: Add deterministic prompt-core catalog helpers

**Files:**
- Modify: `packages/prompt-core/src/index.ts`
- Create: `tests/prompt-core/catalog.test.mjs`

**Interfaces:**
- Produces: `filterPrompts(prompts, query)` and `getPromptById(prompts, id)`.

- [x] **Step 1: Write the failing tests**

Tests must assert case-insensitive search across name/description/tags and stable null return for an unknown ID.

- [x] **Step 2: Run the focused tests**

Run: `node --test tests/prompt-core/catalog.test.mjs`
Expected: FAIL because the helpers do not exist.

- [x] **Step 3: Implement the helpers**

Keep them pure and dependency-free. Search an empty query as "match all".

- [x] **Step 4: Run the focused tests**

Expected: PASS.

- [x] **Step 5: Commit**

Commit message: `feat: add prompt catalog query helpers`

### Task 2: Add system catalog fixtures and repository abstraction

**Files:**
- Create: `apps/web/lib/prompt-catalog.ts`
- Create: `apps/web/lib/prompt-repository.ts`
- Modify: `apps/web/app/library/page.tsx`

**Interfaces:**
- `getSystemPrompts()` returns `Promise<PromptDefinition[]>`.
- Repository first uses configured server-side Supabase when available; otherwise returns the checked-in system fixture.

- [x] **Step 1: Write fixture data**

Mirror only non-secret system catalog fields from the verified seed: nine prompt templates with stable IDs local to the application layer.

- [x] **Step 2: Implement repository**

Keep database mapping isolated to one file. Do not require client-side Supabase initialization.

- [x] **Step 3: Add a library data test**

Assert the fixture contains at least nine unique prompt names and all have `isSystem === true` and a version.

- [x] **Step 4: Run tests**

Expected: all prompt catalog tests pass.

- [x] **Step 5: Commit**

Commit message: `feat: add system prompt catalog repository`

### Task 3: Build the library page

**Files:**
- Modify: `apps/web/app/library/page.tsx`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/prompt-card.tsx`

**Interfaces:**
- Library route consumes `getSystemPrompts()` and query params `q` and `domain`.

- [x] **Step 1: Implement the card and filter UI**

Show name, domain, intent, complexity, description and tags. Include a link to detail.

- [x] **Step 2: Add responsive styling**

Use the existing dark visual direction but tighten hierarchy and density.

- [x] **Step 3: Add empty state**

No results must produce a useful recovery message.

- [x] **Step 4: Run typecheck/build when dependencies are available**

Current environment may not have npm registry access; if so, run static contract checks and document the limitation.

- [x] **Step 5: Commit**

Commit message: `feat: build prompt library UI`

### Task 4: Build prompt detail and clone-to-builder flow

**Files:**
- Create: `apps/web/app/library/[id]/page.tsx`
- Create: `apps/web/app/builder/page.tsx`
- Modify: `apps/web/lib/prompt-repository.ts`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Detail route consumes `id` and renders the selected system prompt.
- Clone action navigates to `/builder?template=<id>`.
- Builder loads the selected template from the same repository and clearly labels it as a draft clone.

- [x] **Step 1: Add not-found handling**

Unknown IDs must use Next.js `notFound()`.

- [x] **Step 2: Add detail view**

Expose prompt metadata, body, requirements, expected output and version.

- [x] **Step 3: Add clone action**

The current slice only preloads the template. Do not persist or mutate system content.

- [x] **Step 4: Build the builder shell**

Show editable prompt body, metadata summary and a future-facing Save control that is visibly disabled until authentication/persistence is available.

- [x] **Step 5: Run tests/checks**

Validate route typing and static content references.

- [x] **Step 6: Commit**

Commit message: `feat: add prompt detail and cloning flow`

### Task 5: Verification and handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/BUILD-STATUS.md`

- [x] **Step 1: Run foundation validation and contract tests**

- [x] **Step 2: Run prompt-core focused tests**

- [x] **Step 3: Run TypeScript check if dependencies resolve**

- [x] **Step 4: Review the final diff**

- [x] **Step 5: Record actual verification results and limitations**

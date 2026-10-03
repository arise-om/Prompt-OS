# Prompt OS — Product Requirements Document

## Status
Foundation draft — v0.1.0

## Product thesis
Prompt OS is a structured control plane for high-quality AI work. It helps users transform rough goals into executable prompts and workflows, provide the right context, evaluate results, and preserve what works.

## Primary users
1. Individual power users who perform recurring research, writing, coding, learning and planning tasks.
2. Technical builders who need reliable AI-assisted engineering workflows.
3. Knowledge workers who want a reusable prompt and workflow system rather than a flat prompt list.

## Core jobs-to-be-done
- Turn an ambiguous request into a clear task specification.
- Build a reusable prompt from requirements and context.
- Choose a workflow appropriate to task complexity.
- Reuse proven prompts and components.
- Measure whether a prompt or workflow actually works.
- Learn from failures and improve versions.
- Maintain personal/domain context without duplicating it in every task.

## MVP capabilities
### P0 — Prompt Core
- Prompt CRUD
- Prompt metadata
- Version history
- Component library
- Search and filtering

### P0 — Prompt Builder
- Goal
- Context
- Inputs
- Constraints
- Audience
- Output
- Quality criteria
- Verification
- Optimized prompt preview

### P0 — Prompt Auditor
- Missing information detection
- Ambiguity detection
- Output-format audit
- Constraint audit
- Verification audit
- Suggested rewrite

### P0 — Evaluation Foundation
- Rubrics
- Benchmark cases
- Evaluation runs
- Human feedback
- Regression comparison

## Non-goals for v0.1
- Fully autonomous agents
- Broad external automation
- Hundreds of third-party integrations
- Self-modifying production workflows
- Automatic high-risk external actions

## North-star metric
Task success rate for representative benchmark cases, supported by user-rated usefulness and measurable revision reduction.

## Product principles
- Outcome over prompt length.
- Relevant context over context volume.
- Evidence over unsupported assumptions.
- Workflow over one-shot prompting for complex work.
- Verification over confidence.
- Human approval for consequential actions.
- Version everything important.

## Definition of done for foundation
- Product model is documented.
- Canonical schemas exist.
- Initial repo scaffold exists.
- Security baseline is defined.
- Development workflow is defined.
- Baseline validation runs successfully.

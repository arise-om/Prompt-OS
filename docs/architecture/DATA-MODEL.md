# Prompt OS — Data Model

## Core entities

- `projects` — user-owned workspaces.
- `domains` — built-in or user-defined task domains.
- `context_packs` — reusable contextual information.
- `prompts` — prompt metadata and ownership.
- `prompt_versions` — immutable-in-practice prompt revisions, lineage, and saved Prompt Auditor snapshots.
- `prompt_components` — reusable blocks such as objective, context and verification.
- `prompt_version_components` — composition links and ordering.
- `workflows` — reusable execution graphs.
- `workflow_steps` — nodes in a workflow graph.
- `workflow_edges` — conditional/control-flow links between steps.
- `workflow_prompts` — prompts used by workflows.
- `benchmark_cases` — representative evaluation inputs.
- `evaluation_criteria` — reusable scoring rubrics.
- `benchmark_case_criteria` — criterion assignments to benchmark cases.
- `evaluation_runs` — execution/evaluation records, with optional execution-time Prompt Auditor snapshot metadata.
- `evaluation_run_scores` — normalized per-criterion scores.
- `failure_logs` — reusable records of observed failure modes.

## Later-stage entities

- references
- tags
- feedback
- models
- tools
- tool_runs
- approvals
- audit_logs
- experiments
- metrics

a system/user ownership flag lets the catalog contain immutable system templates while user-owned records remain private.

## Relationship sketch

```text
Project 1─∞ Prompt
Prompt 1─∞ PromptVersion
Prompt ∞─∞ PromptComponent
Workflow 1─∞ WorkflowStep
Workflow 1─∞ WorkflowEdge
Workflow ∞─∞ Prompt
BenchmarkCase ∞─∞ EvaluationCriterion
PromptVersion 1─∞ EvaluationRun
Workflow 1─∞ EvaluationRun
BenchmarkCase 1─∞ EvaluationRun
EvaluationRun 1─∞ EvaluationRunScore
Prompt 1─∞ FailureLog
```

## Security model

Top-level user-owned records use `owner_user_id = auth.uid()` policies. System catalog records use `is_system = true` and are readable but not writable by ordinary authenticated clients. Child records inherit access from their parent where appropriate.

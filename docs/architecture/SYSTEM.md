# Prompt OS — System Architecture

## Architectural goal
Keep the intelligence model, persistent structured state, execution tools and verification layer separable.

```text
User Goal
  ↓
Task Router
  ↓
Context Resolver ──→ Context Packs / Project State
  ↓
Prompt Composer ──→ Prompt + Workflow
  ↓
Execution Layer ──→ ChatGPT / models / tools / apps
  ↓
Output
  ↓
Evaluation Engine
  ├── rubric evaluation
  ├── benchmark comparison
  └── failure classification
  ↓
Human feedback / approval
  ↓
Versioning + Learning
```

## Application layers
1. UI: Next.js App Router.
2. Domain logic: typed packages for prompts, workflows and evaluation.
3. Persistence: Supabase/PostgreSQL.
4. Integration boundary: model/tool adapters.
5. Evaluation: deterministic checks plus rubric-based evaluation.
6. Audit/security: approval and event logging for consequential actions.

## Canonical concepts
### Prompt
A reusable instruction artifact with variables, context requirements, constraints, expected output and evaluation metadata.

### Workflow
An ordered/conditional set of steps combining prompts, tools, decisions, approvals and evaluations.

### Context Pack
Reusable information needed to perform a class of tasks, such as a project profile or domain profile.

### Benchmark Case
A representative input used to compare prompt/workflow versions.

### Evaluation Run
A recorded execution of a benchmark or real task against defined criteria.

## Boundary rules
- UI never contains privileged database credentials.
- Server-only secrets remain server-side.
- External content is treated as data unless explicitly trusted.
- Consequential actions support explicit approval states.
- Every production workflow exposes a verifiable definition of done.

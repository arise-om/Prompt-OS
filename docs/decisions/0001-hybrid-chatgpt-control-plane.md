# ADR 0001 — Hybrid ChatGPT + Prompt OS Control Plane

## Decision
Prompt OS will be a control plane around ChatGPT/model execution rather than attempting to replace the conversational execution environment.

## Rationale
- ChatGPT already provides multiple execution modes and context surfaces.
- Prompt OS should specialize in organization, composition, workflows, evaluation and reuse.
- Separating state from execution makes the system adaptable to model/tool changes.

## Consequences
Positive:
- Lower initial scope.
- Reusable across different models/tools.
- Strong evaluation and versioning story.

Trade-off:
- Integration boundaries must be maintained as external capabilities evolve.

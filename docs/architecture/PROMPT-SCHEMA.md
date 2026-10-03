# Prompt Schema Contract

A Prompt OS prompt is a reusable instruction artifact plus metadata needed for routing, composition, evaluation and versioning.

```ts
export type PromptStatus =
  | "draft" | "experimental" | "tested" | "validated"
  | "production" | "deprecated" | "archived";

export interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  intent: string;
  domain: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  status: PromptStatus;
  isSystem: boolean;
  version: string;
  body: string;
  variables: string[];
  requiredContext: string[];
  optionalContext: string[];
  constraints: string[];
  expectedOutput: string;
  evaluationCriteria: string[];
  benchmarkCaseIds: string[];
  tags: string[];
}
```

## Lifecycle

```text
draft → experimental → tested → validated → production
                                      ↘ deprecated → archived
```

## Design rules

1. Prompt text and metadata are separate concerns.
2. System prompts are readable but immutable to ordinary authenticated clients.
3. User prompts are owned by a user and can be versioned independently.
4. A prompt version records its own body, variables, context requirements, constraints and evaluation criteria.
5. Prompt versions may reference a parent version to preserve lineage.
6. Reusable components may be composed into a prompt version without copying their source semantics into the metadata.

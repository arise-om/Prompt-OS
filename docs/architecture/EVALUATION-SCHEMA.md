# Evaluation Schema Contract

```ts
export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  scoring: "binary" | "scale" | "reference";
  isSystem: boolean;
}

export interface BenchmarkCase {
  id: string;
  category: string;
  name: string;
  input: unknown;
  expectedCharacteristics: string[];
  goldenOutput?: unknown;
  criterionIds: string[];
  isSystem: boolean;
}

export interface EvaluationRun {
  id: string;
  promptVersionId?: string;
  workflowId?: string;
  benchmarkCaseId?: string;
  actualOutput: unknown;
  scores: Record<string, number>;
  failures: string[];
  reviewerNotes?: string;
  promptAudit?: PromptAuditResult;
}
```

## Evaluation lifecycle

```text
Define rubric → run benchmark → score → classify failures → compare version → decide whether to promote
```

The database stores both a compact score snapshot and normalized per-criterion score rows so analytics can evolve without losing execution history. When a run is tied to a prompt version, `promptAudit` may capture the exact Prompt Auditor result observed for that version at execution time.

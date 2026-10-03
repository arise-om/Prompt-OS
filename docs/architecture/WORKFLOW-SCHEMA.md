# Workflow Schema Contract

A workflow is a graph of typed steps. It can be linear, branching or looping.

```ts
export type WorkflowStepType =
  | "input" | "prompt" | "research" | "tool" | "decision"
  | "condition" | "approval" | "evaluation" | "retry" | "output";

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  purpose: string;
  inputKeys: string[];
  outputKeys: string[];
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition: Record<string, unknown>;
  priority: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  purpose: string;
  trigger: string;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  dependencies: string[];
  tools: string[];
  approvalRequired: boolean;
  evaluationIds: string[];
  failureStates: string[];
  version: string;
  isSystem: boolean;
}
```

## Execution rules

- Every step declares the data it consumes and produces.
- Edges express control flow and optional conditions.
- Conditional branches must be explicit rather than hidden in prompt text.
- Loops must have a bounded or externally verifiable exit condition.
- Tool and approval steps should carry their risk/permission requirements in configuration.
- System workflows are templates; ordinary clients may read but not modify them.

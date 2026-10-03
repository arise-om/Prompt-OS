# Prompt OS Capability Routing

Prompt OS should route requests by required capability rather than by keyword alone.

```text
Quick knowledge question
  → Chat

Current/fresh factual question
  → Web search

Multi-source evidence investigation
  → Deep Research

Document-heavy task
  → Files / document analysis

Numerical/table analysis
  → Data Analysis

Learning / tutoring
  → Study workflow

Visual creation or editing
  → Image/creative capability

Repository or codebase work
  → Coding workflow

External system action
  → Connected app + approval boundary
```

## Routing contract

The router should return:

```ts
interface RoutingDecision {
  intent: string;
  domain?: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  requiredCapabilities: string[];
  recommendedWorkflow?: string;
  requiredContext: string[];
  approvalRequired: boolean;
  rationale: string;
}
```

The decision is a recommendation. Availability, authorization, plan limits and workspace policies must be checked before execution.

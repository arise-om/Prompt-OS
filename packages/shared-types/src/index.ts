export type PromptStatus =
  | "draft" | "experimental" | "tested" | "validated"
  | "production" | "deprecated" | "archived";

export type Complexity = 1 | 2 | 3 | 4 | 5;

export type WorkflowStepType =
  | "input" | "prompt" | "research" | "tool" | "decision"
  | "condition" | "approval" | "evaluation" | "retry" | "output";

export type PromptComponentType =
  | "context" | "objective" | "constraint" | "audience" | "output"
  | "quality" | "verification" | "uncertainty" | "scope" | "example" | "instruction";

export interface PromptAuditFinding {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  remediation: string;
}

export interface PromptAuditResult {
  score: number;
  findings: PromptAuditFinding[];
  missingSections: string[];
}

export interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  intent: string;
  domain: string;
  complexity: Complexity;
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
  promptAudit?: PromptAuditResult;
}

export interface PromptComponent {
  id: string;
  name: string;
  type: PromptComponentType;
  body: string;
  isSystem: boolean;
  tags: string[];
}

export type WorkflowStatus =
  | "draft" | "experimental" | "tested" | "validated"
  | "production" | "deprecated" | "archived";

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
  status: WorkflowStatus;
  isSystem: boolean;
}

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

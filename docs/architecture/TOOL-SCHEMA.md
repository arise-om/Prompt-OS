# Tool & Capability Schema Contract

Prompt OS separates a user's intent from the capability used to execute it.

```ts
export type CapabilityKind =
  | "chat" | "search" | "deep_research" | "files" | "data_analysis"
  | "study" | "image" | "code" | "design" | "connected_app";

export interface CapabilityProfile {
  id: string;
  name: string;
  kind: CapabilityKind;
  available: boolean;
  requiresAuthorization: boolean;
  supportedInputs: string[];
  supportedOutputs: string[];
  bestFor: string[];
  limitations: string[];
}
```

## Routing rules

- Prefer a native capability when it already solves the task.
- Use connected apps when an external system contains required data or must be acted upon.
- Use deep research for multi-source, current, evidence-heavy investigations.
- Use file/data analysis when source material is available rather than asking the user to paraphrase it.
- Never assume a capability is available; check its current connection and authorization state.

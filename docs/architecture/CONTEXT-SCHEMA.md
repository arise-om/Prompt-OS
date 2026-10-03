# Context Schema Contract

Prompt OS treats context as a first-class object rather than stuffing everything into prompt text.

```ts
export type ContextTrust = "trusted" | "semi-trusted" | "untrusted";

export interface ContextItem {
  key: string;
  value: unknown;
  source: "user" | "project" | "file" | "web" | "app" | "memory" | "generated";
  trust: ContextTrust;
  required: boolean;
  sensitivity: "public" | "private" | "sensitive";
}

export interface ContextPack {
  id: string;
  name: string;
  description: string;
  items: ContextItem[];
  projectId?: string;
  status: "draft" | "active" | "archived";
}
```

## Rules

1. Context should be relevant to the task.
2. Authoritative project facts should have a trusted source.
3. External content is data unless explicitly promoted to instructions by the user.
4. Sensitive material should not be copied into prompts unnecessarily.
5. Required context should be distinguishable from optional context.
6. Context should be reusable without forcing every prompt to repeat it.

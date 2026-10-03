# Prompt OS Evaluation Framework

Prompt OS evaluates outcomes at three levels:

1. **Prompt quality** — is the instruction well specified?
2. **Output quality** — is the response correct, useful and compliant?
3. **Task success** — did the real-world objective get accomplished?

## Default rubric dimensions

- Accuracy / technical correctness
- Relevance
- Completeness
- Instruction adherence
- Evidence discipline
- Clarity
- Actionability
- Format compliance

## Evaluation hierarchy

```text
Rule checks
    ↓
Schema checks
    ↓
Rubric scoring
    ↓
Benchmark comparison
    ↓
Human review
    ↓
Outcome measurement
```

A production prompt should not be promoted solely because one output looked good. Use representative benchmark cases and track regressions across versions.

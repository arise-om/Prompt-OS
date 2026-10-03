# Prompt OS Failure Taxonomy

Failures are stored as reusable engineering knowledge.

| Code | Failure | Typical symptom | First diagnostic |
|---|---|---|---|
| F01 | Intent misunderstood | Correct topic, wrong objective | Restate desired outcome |
| F02 | Missing context | Generic or misaligned output | Identify decision-relevant context |
| F03 | Unsupported claim | Confident but weak factual statement | Check evidence/source |
| F04 | Constraint ignored | Output violates a requirement | Compare output to requirements |
| F05 | Format failure | Wrong structure/schema | Validate output contract |
| F06 | Incomplete result | Important requested area missing | Requirement checklist |
| F07 | Analysis error | Wrong calculation/logic | Recompute or reproduce |
| F08 | Tool mismatch | Wrong capability used | Reclassify task |
| F09 | Verification failure | Result appears right but is unproven | Run fresh verification |
| F10 | Security boundary failure | Untrusted content changes behavior | Trace instruction source |
| F11 | Overengineering | Excessive complexity for task | Compare against simplest viable design |
| F12 | Regression | Existing behavior breaks | Run broader regression suite |

Each failure record should contain evidence, root cause, remediation and the prompt/workflow version involved.

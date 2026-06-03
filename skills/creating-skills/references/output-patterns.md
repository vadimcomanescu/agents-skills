# Output patterns

Use these when a skill's value is a *consistent output* — reports, commit messages, configs, extractions. Pin the format in the skill body so the agent doesn't reinvent it each run. Match strictness to how much the format can safely vary (the same degrees-of-freedom axis as the rest of the skill: fragile output → strict, adaptive output → flexible).

## Template pattern

Give the agent the output skeleton.

**Strict** — when the output is parsed or must stay uniform (data formats, API payloads, fixed report shapes):

```markdown
## Report structure

ALWAYS use this exact structure:

# [Title]
## Summary
[one paragraph]
## Findings
- [finding with supporting evidence]
## Recommendations
1. [specific, actionable step]
```

**Flexible** — when the shape should adapt to the content:

```markdown
## Report structure

A sensible default — use judgment:

# [Title]
## Summary
## Findings            # adapt the sections to what you actually find
## Recommendations
```

## Examples pattern

When quality depends on *style* the agent has to see rather than be told, give input/output pairs:

```markdown
## Commit message format

**Input:** Added JWT auth with a login endpoint and token middleware
**Output:**
feat(auth): add JWT-based authentication

Add login endpoint and token validation middleware
```

Two or three pairs convey tone and granularity a prose description can't. Pick examples that differ enough to show the *boundaries* of the format, not near-identical ones.

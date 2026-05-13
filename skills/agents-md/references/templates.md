# Canonical templates

Use these verbatim. Fill `{placeholders}` from phase 1 survey. Drop sections marked `[optional]` when they don't apply.

---

## AGENTS.md (canonical, 80–150 lines)

```markdown
# {Project Name}

{One-sentence project description.}

| Item | Value |
|------|-------|
| Stack | {language}, {framework}, {key libraries} |
| Package manager | {npm/pnpm/bun/uv/cargo/...} |
| Build | `{build command}` |
| Test | `{test command}` |
| Lint | `{lint command}` |
| Dev | `{dev server command}` |

## Commands

```bash
{package_manager} install     # Install dependencies
{dev_command}                  # Start dev server
{build_command}                # Production build
{test_command}                 # Run tests
{lint_command}                 # Lint (check only)
{lint_fix_command}             # Lint (auto-fix)
{typecheck_command}            # Type check
```

## Project Structure

```
src/
  {directory}/    # {purpose}
  {directory}/    # {purpose}
tests/            # {test organization}
```

## Code Style

{One real code example from the codebase showing the project's preferred pattern.}

```{language}
{actual code example}
```

- {Rule 1: specific, imperative}
- {Rule 2: specific, imperative}
- {Rule 3: specific, imperative}

## Testing

- Framework: `{test_framework}`
- Runner: `{exact test command with flags}`
- Convention: {test file naming and location}

```{language}
{minimal test example}
```

## Git Workflow

- Branch: `{prefix}/{description}` — prefixes: `feat`, `fix`, `chore`
- Commits: `{format}` — imperative mood, ≤ 72 chars
- {Any PR or review process}

## Forbidden Patterns

| WRONG | CORRECT | Why |
|-------|---------|-----|
| {common mistake 1} | {correct approach} | {brief reason} |
| {common mistake 2} | {correct approach} | {brief reason} |

## Boundaries

- Never {dangerous action 1}
- Never {dangerous action 2}
- Never modify {protected files/dirs} without approval

## Verification

After every change:
1. `{typecheck command}` (zero errors)
2. `{test command}` (all pass)
3. `{lint command}` (clean)

## References

| File | Purpose |
|------|---------|
| `docs/adr/` | Architecture decision records |
| `docs/conventions.md` | Project-specific code conventions |
| `docs/workflow.md` | Full contribution workflow |
| `references/{topic}.md` | {what it contains} |
```

### Section-order rationale

1. Quick reference table — primacy effect, seen first
2. Commands — most frequently consulted
3. Project structure — orientation
4. Code style — daily reference
5. Testing — daily reference
6. Git workflow — per-commit reference
7. Forbidden patterns — high-compliance format
8. Boundaries — critical safety
9. Verification — recency effect, seen last
10. References — the map to deeper docs

### Exclude from AGENTS.md

- Token / color catalogs → `references/tokens.md`
- Component API docs → `references/api.md`
- Architecture rationale → `docs/adr/`
- Exhaustive inventories → runtime commands (`ls`, `find`)
- Default-behavior instructions → delete
- Inline rationale per rule → ADR or delete

---

## ADR (12–20 lines, store in `docs/adr/`)

```markdown
# ADR-{NNN}: {Title}

**Date**: {YYYY-MM-DD}
**Status**: Accepted

## Context

{2–3 sentences: what problem or choice prompted this decision.}

## Decision

{1–2 sentences: what was decided and why.}

## Consequences

- {Positive consequence}
- {Positive consequence}
- {Tradeoff or negative consequence}
```

Don't generate ADRs for obvious choices. Each ADR records a **non-obvious** technical decision a future agent might second-guess or contradict.

---

## docs/conventions.md (50–80 lines)

```markdown
# Conventions

Project-specific conventions for {project_name}. For language-level
standards, see {link to PEP8 / Rust API guidelines / Airbnb / etc.}.

## File Organization

{Where source lives, where tests live, naming patterns.}

## Naming

{Module naming, class/function naming patterns specific to this project.}

## Imports

{Import ordering, absolute vs relative, banned imports.}

## Error Handling

{How errors are handled here: Result types, exceptions, error codes.}

## Code Example

```{language}
{Real code snippet showing the project's preferred pattern. Pull
 from an actual file in the codebase, not a hypothetical.}
```

## Patterns to Avoid

| Avoid | Use instead | Why |
|-------|-------------|-----|
| {anti-pattern 1} | {correct approach} | {brief reason} |
| {anti-pattern 2} | {correct approach} | {brief reason} |
```

---

## docs/workflow.md (30–50 lines)

```markdown
# Contribution Workflow

## Branch

```bash
git checkout -b {prefix}/{description}
```

Prefixes: `feature/`, `fix/`, `chore/`.

## Implement

{1–2 sentences: implementation expectations — tests, types, etc.}

## Validate

```bash
{test_command}
{lint_command}
{typecheck_command}
```

All must pass before committing.

## Commit

```
{commit_format}
```

{Commit message conventions: imperative mood, max length, etc.}

## Pull Request

{Where to open, what to include, who reviews.}
```

---

## References table (for the bottom of AGENTS.md)

```markdown
## References

| File | Purpose |
|------|---------|
| `docs/adr/` | Architecture decision records |
| `docs/conventions.md` | Project-specific code conventions |
| `docs/workflow.md` | Full contribution workflow with commands |
| `references/tokens.md` | Design token catalog |
| `references/api.md` | API surface details |
```

Only list rows for docs that actually exist on disk. Verify each path resolves before writing the row.

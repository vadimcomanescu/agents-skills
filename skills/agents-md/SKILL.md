---
name: agents-md
description: Audit and refactor a repository's AGENTS.md so an agent can act on it. Use when the user asks to audit AGENTS.md, fix AGENTS.md, set up agent docs, improve agent documentation, refactor for progressive disclosure, or invokes /agents-md. Use when AGENTS.md is missing, bloated past 200 lines, contradictory, or duplicates content elsewhere in the repo. Do not use to edit a single doc that AGENTS.md does not reference.
---

# Agent Docs Readiness

Every line in `AGENTS.md` gets loaded on every task. Bloat steals the budget you need for project-specific rules. Contradictions silently override each other. Default-behavior bullets dilute the rules that actually steer the model.

**Core principle.** Every line in `AGENTS.md` must be project-specific. If a competent model would do the right thing without it, delete it.

The root file is a map. Depth lives in `docs/` and `references/`.

## Workflow

### 1. Find contradictions

List each pair. Propose the version to keep — one sentence of reasoning. Ask the user. Never autoresolve.

Contradictions encode a user choice the model cannot see. Autoresolving silently picks a side.

### 2. Identify essentials for the root

Keep in `AGENTS.md` — nothing else:

- One-sentence project description
- Package manager — only if it isn't `npm`
- Non-standard build / test / lint / typecheck commands
- Forbidden Patterns table
- Boundaries — `never X` rules
- Verification commands
- References table

### 3. Triage bloat

Flag every instance. Concrete before/after for each pattern lives in `references/anti-patterns.md`.

- **Default-behavior** — "write clean code", "meaningful names", generic ARIA. Delete.
- **Vague qualifiers** — "try to", "ideally", "consider", "might want to". Rewrite imperative.
- **Meta-prefixes** — "You should", "Remember to", "Please". Strip.
- **Cross-section duplication** — same command in 2+ H2 sections. Keep the most-specific home.
- **Hardcoded inventories** — component lists, dependency versions. Replace with `ls` / `find` / runtime command.
- **Inline rationale** — "Use X because A, B, C" per rule. Move rationale to an ADR.
- **Zero-value sections** — entirely covered by another section. Delete.
- **Stale paths** — paths that no longer resolve. Verify, then fix or remove.

### 4. Group the rest

Sort remaining content:

- `docs/adr/` — non-obvious architectural decisions (see Final checks)
- `docs/conventions.md` — project-specific idioms beyond language defaults
- `docs/workflow.md` — branch / commit / PR cycle with exact commands
- `references/<topic>.md` — catalogs (tokens, API surface, icons) and rationale collections

### 5. Propose the file structure

Minimal root `AGENTS.md` with a `References` table at the bottom. Each topic file with its content. Suggested folder layout.

Produce the diff plan. Do not apply edits.

## Skip the restructure when

| Repo state | Reach for |
|---|---|
| `AGENTS.md` missing or under 20 lines | Generate from `references/templates.md` first; audit second. Splitting an empty file produces empty files. |
| Pure boilerplate (no project-specific content) | Fill in stack / commands / structure first. Splitting boilerplate doesn't make it useful. |
| Monorepo with multiple package manifests | Audit root, then recommend per-package `AGENTS.md` for packages with distinct conventions. |
| Already a 100–200 line map with `References` table | Run Final checks only. Do not restructure what is already correct. |

## Final checks

Before producing the plan, every item below must be true.

- **Propose 1–3 ADRs** in `docs/adr/` only when all four hold: (1) hard to reverse, (2) surprising without context, (3) the result of a real trade-off, (4) the stated rationale is technically accurate. Fact-check ecosystem claims ("X requires Y" about frameworks / versions / APIs) before canonizing them into an ADR. Skip obvious choices. Wrong rationales canonized as ADRs poison every future agent run.
- **Write a Forbidden Patterns table** — one row per mistake the project actually makes. Columns: `WRONG`, `CORRECT`, `Why`. No invented examples.
- **List 3–7 Boundaries** — `never X` rules covering the project's actual incident surface. More than seven and the model starts ignoring them.
- **Specify Verification commands** — exact CLI calls to run after every change.
- **Build the References table** at the bottom of `AGENTS.md`. Every row points to a doc that exists on disk.
- **Verify paths on disk** — `test -e <path>` for every path mentioned in `AGENTS.md`. Any miss is a stale link.
- **Replace hardcoded inventories** with `ls`, `find`, or a runtime command. Static lists go stale.
- **Symlink `CLAUDE.md → AGENTS.md`.** Missing: `ln -s AGENTS.md CLAUDE.md`. Regular file: merge any unique content into `AGENTS.md`, then `rm CLAUDE.md && ln -s AGENTS.md CLAUDE.md`. Already a symlink to `AGENTS.md`: skip.
- **Read content, not just structure.** Three concrete passes — generic exhortation does not fire:
  1. List every named entity in inventory sections (components, scripts, tokens, deps). Check the list for duplicates.
  2. Cross-reference stated tooling with the actual stack: if `Stack` names Vite but `build` runs `tsup`, one of them is wrong — flag it.
  3. Fact-check ecosystem claims before treating them as constraints. "X requires Y" — does Y actually require X, in the current version? Wrong rationales pretending to be facts are worse than no rationale.

## Common rationalizations

| Excuse | Reality |
|---|---|
| "This contradiction is obvious — I'll autoresolve it." | Both versions exist because someone disagreed. Ask. |
| "Default-behavior bullets feel safer to keep." | They steal slots from the rules that actually steer the model. Delete. |
| "Let me write the templates first; the user can pick." | Survey before generating. Templates without a survey produce a generic `AGENTS.md`, not this project's. |
| "I'll restructure as I read." | Survey, then plan, then apply. Restructuring while reading produces inconsistent structure. |
| "I'll skip path verification — they look right." | One stale path silently misleads every future agent run. Verify. |
| "Generic accessibility / security / 'clean code' rules are fine to keep." | They are default behavior. Keeping them dilutes the rules that aren't. |

## Verification

Run these on the proposed plan before handing it to the user.

- Re-read the new `AGENTS.md` as if blind to the repo. Can you execute one realistic task using only this file? If no, the file is still under-specified.
- For every CLI command in `AGENTS.md`, grep the file. If it appears in 2+ H2 sections, you duplicated.
- `test -e` every path. Any miss is a stale link.

## References

- `references/anti-patterns.md` — load when step 3 flags a pattern and you need the concrete before/after.
- `references/templates.md` — load when generating a new `AGENTS.md`, ADR, `conventions.md`, or `workflow.md` from scratch.

## Bottom line

```
AGENTS.md root → project-specific rules, verified paths, runtime discovery for inventories
Anything else → docs/ or references/ or deleted
```

If a line could appear in any project's `AGENTS.md`, it does not belong in this one.

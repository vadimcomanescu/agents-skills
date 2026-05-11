---
name: arianna-research
description: Research role for the arianna-plan-loop coordinator. Dispatches parallel topic subagents (external + codebase + Quality Commands discovery), merges their partials into <run_dir>/research.md (run_dir is supplied by the coordinator). Use when arianna-plan-loop dispatches the research phase, or the user asks to "research before building", "find prior art", "audit what's in the codebase before changing it". Do not use for one-shot Q&A without a build attached.
---

# arianna-research

You coordinate parallel research. You do not research yourself — every web search, grep, and doc fetch happens inside a teammate subagent you dispatched. Your context is for decomposition, fan-out, and merge. A single subagent covering "OAuth + the codebase auth module + npm scripts" runs out of context before any one of the three is thorough, and the decider becomes the one missing things. Two roles, two contexts.

`<run_dir>` is supplied by the coordinator (e.g. `.arianna/2026-05-11-session-revoke/`). All paths below sit inside it.

## Workflow

1. Read the goal text and intent class from the dispatch.
2. Decompose into N topics — external research, codebase, and Quality Commands discovery. If only one topic surfaces, return `status: "skip"` and let the coordinator move on.
3. Dispatch all N teammates in **one message** (parallel). Each teammate writes to `<run_dir>/.research-<slug>.md` (leading dot — these are partials to merge and delete).
4. Wait for every teammate; read each partial.
5. Synthesise into `<run_dir>/research.md` using the section schema below. Cross-reference external findings against codebase findings — if external best practice contradicts what is already in the repo, flag the conflict; do not pick a winner.
6. Delete the partials.
7. Return JSON to the coordinator.

## Topic count by intent class

The coordinator passes the intent class. It caps teammate count and shapes which topics are obligatory.

| Intent class | Teammates | Obligatory topics |
|---|---|---|
| `REFACTOR` | 2–3 | refactor patterns (external) + existing structure (codebase) + optional Quality Commands |
| `BUG_FIX` | 2–3 | codebase where the bug lives + optional known-issue search (external) |
| `MID_SIZED` | 3–5 | external domain + codebase patterns + Quality Commands + optional Verification Tooling |
| `GREENFIELD` | 4–5 | multiple external (framework, auth, deployment) + codebase prior art + Quality Commands |

One topic per teammate, one teammate per topic. External topics never share a teammate with codebase topics — the tools differ (WebSearch vs. read-only filesystem) and combining them lets the subagent skim both poorly. Quality Commands discovery is always its own codebase teammate; it is not a footnote in another topic.

Floor at 2 teammates: a single teammate is not parallel research, it is just research, and the coordinator should have skipped this phase. Ceiling at 5: beyond that, the merge becomes its own research problem.

## Dispatch shape

All teammate spawns go in one tool-call batch — both Claude Code's Agent tool and Codex's subagent spawn parallelise only same-message dispatches. A teammate spawned in a later message runs sequentially and defeats the point.

Each teammate prompt has four blocks:

1. **Role.** `You are a research teammate. Topic: <one-line topic>. You handle this topic only.`
2. **Goal slice.** Verbatim copy of the relevant slice of the goal text (problem statement, desired outcome, constraints).
3. **Tool guard.**
   - External teammate: `Use WebSearch and WebFetch. Do NOT explore the codebase — a sibling teammate handles that.`
   - Codebase teammate: `Use Read, Grep, Glob, and read-only Bash. Do NOT use WebSearch — sibling teammates handle external research.`
4. **Output contract.** `Write to <run_dir>/.research-<topic-slug>.md with the sections below. Return a one-line summary when done.` Substitute the actual `<run_dir>` so every teammate writes into the same directory.

Topic-slug examples: `oauth-patterns`, `codebase-auth`, `quality-commands`, `verification-tooling`, `prior-art-todo-apps`. The leading dot on the filename keeps partials out of casual `ls` and signals "merge-and-delete".

## Quality Commands discovery

The plan tags tasks with the commands a downstream build agent runs on green; without this section the planner invents commands from training-data priors. The Quality Commands teammate detects in this priority order and writes a table with a `Source` column citing exactly where each command came from:

| Source | Tool | What to extract |
|---|---|---|
| `package.json` scripts | `jq '.scripts' package.json` | `test`, `lint`, `typecheck`, `build`, `format`, `e2e` |
| `Makefile` | `grep -E '^[a-z-]+:' Makefile` | `test`, `check`, `lint`, `build`, `ci` |
| `pyproject.toml`, `tox.ini`, `noxfile.py` | direct read | Python test/lint commands |
| `Cargo.toml`, `go.mod` | implicit | `cargo test`/`clippy`/`build`, `go test ./...`/`vet` |
| `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml` | grep `run:` / `script:` | Ground truth when scripts and CI disagree |

If no quality commands exist anywhere, write `No quality commands discovered — repo has no test/lint/build harness wired up.` The planner will see that and skip the green-gate tag.

## research.md schema

```markdown
# Research — <goal slug>

## Summary
One paragraph: what was investigated, what changed in your understanding, what surfaced unexpectedly.

## External findings
### <topic>
Bullets with links. Cross-reference codebase findings inline when relevant.

## Codebase findings
### <topic>
Bullets with file paths and line ranges. Note conventions, gotchas, prior-art patterns.

## Quality Commands
| Command | Source | Purpose |
|---|---|---|
| `npm test` | `package.json` scripts | run unit suite |
| ... | ... | ... |

## Conflicts surfaced
Where external best practice contradicts existing repo patterns. Do not resolve; surface for the spec writer.

## Concerns
Open questions the spec writer should not assume away.
```

## Return JSON

```json
{
  "phase": "research",
  "teammates_dispatched": 4,
  "research_path": "<run_dir>/research.md",
  "conflicts_surfaced": 2,
  "quality_commands_found": true,
  "concerns": []
}
```

`research_path` is the path you actually wrote (e.g. `.arianna/2026-05-11-session-revoke/research.md`).

If only one topic surfaced, return `{"phase": "research", "status": "skip", "reason": "<why>"}` and write nothing.

## Anti-patterns

- **Doing the research yourself.** Your job is decomposition and merge. If you find yourself running WebSearch or grep in your own context, stop and dispatch.
- **Sequential teammate dispatch.** Spawning each in its own message defeats parallel research. One message, N tool calls.
- **External + codebase in one teammate.** The tool kits differ; the teammate skims both poorly.
- **Burying Quality Commands inside another topic.** It is the planner's downstream contract. Own teammate, own section, with a `Source` column.
- **Resolving conflicts during merge.** When external practice and existing code disagree, surface both. The spec writer (and the grill) decide.
- **Skipping partial cleanup.** Leftover `.research-*.md` files clutter the run directory. Delete after merge.

## References

Sibling skills and their consumers of `<run_dir>/research.md`:

- `arianna-plan-loop` — the coordinator that dispatches you and reads your JSON return.
- `arianna-spec` — reads your `## External findings`, `## Codebase findings`, `## Conflicts surfaced`.
- `arianna-plan` — reads your `## Quality Commands` to tag tasks.

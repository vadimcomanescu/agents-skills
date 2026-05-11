---
name: arianna-research
description: Research coordinator for Phase 0 of the arianna-loop pipeline. Use when arianna-loop dispatches Phase 0, or the user asks to "research before building", "do a literature review", "find prior art", "check what's out there". Dispatches parallel research subagents, external-first then codebase, writes .agent/research.md. Do not use for one-shot Q&A without a build attached.
---

# arianna-research

You coordinate Phase 0. You do not research yourself — every web search, grep, and doc fetch happens inside a teammate subagent you dispatched. Your context is for decomposition, fan-out, and merge.

## Workflow

1. Read `.agent/goal.md` (or the inline goal text); note the intent class the orchestrator passed in.
2. Decompose into N topics — external research, codebase, and Quality Commands discovery. If only one topic surfaces, return "phase 0 not needed" and let the orchestrator skip.
3. Dispatch all N teammates in **one message** (parallel). Each teammate's output filename is `.agent/.research-<slug>.md` (leading dot — these are partials to merge and delete).
4. Wait for every teammate; read each partial.
5. Synthesize into `.agent/research.md` with the section schema below. Cross-reference external findings against codebase findings.
6. Delete the partials.
7. Return JSON to the orchestrator.

The split between coordinator and teammates exists because a single subagent covering "OAuth + the codebase auth module + npm scripts" runs out of context before any of the three is thorough, and the decider becomes the one missing things. Two roles, two contexts.

## Topic count by intent class

The orchestrator passes the intent class. It caps the teammate count and shapes which topics are obligatory.

| Intent class | Teammates | Obligatory topics |
|---|---|---|
| `REFACTOR` | 2-3 | refactor patterns (external) + existing structure (codebase) + optional Quality Commands |
| `MID_SIZED` | 3-5 | external domain + codebase patterns + Quality Commands + optional Verification Tooling |
| `GREENFIELD` | 4-5 | multiple external (framework, auth, deployment) + codebase prior art + Quality Commands |
| `BUG_FIX` | 2-3 | codebase where bug lives + optional known-issue search (external) |

One topic per teammate, one teammate per topic. External topics never share a teammate with codebase topics — the tools differ (WebSearch vs. read-only filesystem) and combining them lets the subagent skim both poorly. Quality Commands discovery is always its own codebase teammate; it is not a footnote in another topic.

Floor at 2 teammates: a single teammate is not parallel research, it is just research, and Phase 0 was the wrong phase. Ceiling at 5: beyond that, the merge becomes its own research problem.

## Dispatch shape

All teammate spawns go in one tool-call batch — both Claude Code's Agent tool and Codex's subagent spawn parallelize only same-message dispatches. A teammate spawned in a later message runs sequentially and defeats the point.

Each teammate prompt has four blocks:

1. **Role.** `You are a research teammate. Topic: <one-line topic>. You handle this topic only.`
2. **Goal slice.** Verbatim copy of the relevant slice of `.agent/goal.md` (problem statement, desired outcome, constraints).
3. **Tool guard.** External teammate: `Use WebSearch and WebFetch. Do NOT explore the codebase — a sibling teammate handles that.` Codebase teammate: `Use Read, Grep, Glob, and read-only Bash. Do NOT use WebSearch — sibling teammates handle external research.`
4. **Output contract.** `Write to .agent/.research-<topic-slug>.md with the sections below. Return a one-line summary when done.`

Topic-slug examples: `oauth-patterns`, `codebase-auth`, `quality-commands`, `verification-tooling`, `prior-art-todo-apps`. The leading dot on the filename keeps partials out of casual `ls` and signals "merge-and-delete".

## Quality Commands discovery

Plan tags tasks with the commands they run on green; Review uses the same commands to gate its verdict. If this section is missing, Plan invents commands from training-data priors and Review has nothing to ratchet. The teammate detects in this priority order, and writes a table with a `Source` column citing exactly where each command came from:

| Source | Tool | What to extract |
|---|---|---|
| `package.json` scripts | `jq '.scripts' package.json` | `test`, `lint`, `typecheck`, `build`, `format`, `e2e` |
| `Makefile` | `grep -E '^[a-z-]+:' Makefile` | `test`, `check`, `lint`, `build`, `ci` |
| `pyproject.toml`, `tox.ini`, `noxfile.py` | direct read | Python test/lint commands |
| `Cargo.toml`, `go.mod` | implicit | `cargo test`/`clippy`/`build`, `go test ./...`/`vet` |
| `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml` | grep `run:` / `script:` | Ground truth when scripts and CI disagree |
| `justfile`, `Taskfile.yml`, `mise.toml` | direct read | Task-runner recipes |

If a `Source` cell would say "convention" or "default", the teammate guessed instead of detected — leave the row out rather than guess.

Verification Tooling (dev server command and port, test-runner binary, browser deps, E2E config URLs, services in `docker-compose.yml` / `.env.example`) goes in a second table, same shape. Same teammate or a fifth, depending on E2E weight.

## External first, codebase second, cross-reference third

External evidence reframes what the codebase reads of itself. Without it, the build perpetuates whatever pattern the codebase already has, even when the industry has moved on. "External first" is about how you read the partials and write the merge — all teammates still dispatch in the same message and run in parallel.

In the merged `research.md`: the External Research section appears before Codebase Analysis, and Recommendations is explicitly written as cross-references between the two. If a Recommendation cites only the codebase or only external sources, the cross-reference pass was skipped.

## Output: `.agent/research.md`

After the partials are read and synthesized, write `.agent/research.md` with these sections in order, then `rm .agent/.research-*.md`. The merged file is the only source of truth the next phase reads.

```markdown
# Research: <one-line goal restatement>

## Executive Summary
2-3 sentences across all teammates. Names the architectural decision the user needs to make at Spec, if one is clear.

## External Research
### Best Practices
Bullets with source URL or doc reference.
### Prior Art
Repos / libraries solving a similar problem, one sentence of relevance each.
### Pitfalls
Documented failure modes from the external sources, with source.

## Codebase Analysis
### Existing Patterns
What the codebase already does, with file paths.
### Dependencies
Relevant entries in `package.json` / `Cargo.toml` / `pyproject.toml`.
### Constraints
Schemas, public API surfaces, framework version pins that bound the design.

## Quality Commands
| Type | Command | Source |
| ... | ... | ... |

## Verification Tooling
| Type | Command / config | Source |
| ... | ... | ... |

## Recommendations
Numbered list. Each item cross-references one external finding and one codebase observation: "Consider X because external Y and codebase Z."

## Open Questions
Bullets the research could not answer. Each names what would resolve it. These seed Phase 1 Discover and Phase 2 grilling.

## Sources
Deduped flat list of every URL and codebase file path cited above.
```

Quality Commands feeds Plan and Review. Recommendations feeds Spec. Open Questions feeds Discover. Sources audits every claim. Downstream consumers depend on this shape.

## Return contract

```json
{
  "phase": "research",
  "status": "complete",
  "output_file": ".agent/research.md",
  "teammate_count": 4,
  "open_questions": 3,
  "notes": "Optional one-line note about anomalies (a teammate timed out, a CI config was unparseable, etc.)"
}
```

`open_questions` lets the orchestrator decide whether Phase 1 needs more disambiguating turns than usual.

## Anti-patterns

- **Running `WebSearch` or `Read` against a project file in your own context.** Dispatch a teammate.
- **Combining multiple topics into one teammate.** Two topics, two teammates — shared prompts produce shallow paragraphs on each.
- **Dispatching teammates sequentially across messages.** The runtime parallelizes only same-message spawns. One batch.
- **Letting a codebase teammate run WebSearch (or an external teammate run grep).** The tool guard exists for a reason.
- **Treating Quality Commands as a footnote.** It is its own teammate and its own section.
- **Merging without a cross-reference pass.** Single-sided Recommendations perpetuate the existing pattern or ignore what already exists.
- **Leaving `.agent/.research-*.md` partials behind after merge.** Two sources of truth diverge under the next phase's edits.

## References

- The orchestrator's dispatch contract lives in `skills/arianna-loop/SKILL.md` § Dispatch contract — load when confirming the return shape.
- Downstream consumers: `skills/arianna-spec/SKILL.md` reads Recommendations and Open Questions; `skills/arianna-plan/SKILL.md` reads Quality Commands and Verification Tooling; `skills/arianna-review/SKILL.md` reads Quality Commands. Load these only when changing the output schema.

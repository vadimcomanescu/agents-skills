---
name: arianna-research
description: Research coordinator for Phase 0 of the arianna-magic pipeline. Use when arianna-magic dispatches Phase 0, or the user asks to "research before building", "do a literature review", "find prior art", "check what's out there". Dispatches parallel research subagents, external-first then codebase, writes .agent/research.md. Do not use for one-shot Q&A without a build attached.
---

# arianna-research

## Operating idea

**You are a coordinator, not a researcher.** Every web search, every codebase grep, every doc fetch happens inside a subagent you dispatched — never in your own context. Your job is to decompose the goal into independent topics, fan out parallel subagents in a single message, wait for their partial files, and merge them into one `.agent/research.md`. The build that follows reads only the merged file; your subagents' raw notes are deleted after the merge.

The split exists for a concrete reason. A single subagent that tries to cover "OAuth, plus the codebase's auth module, plus npm scripts" runs out of context before any of the three is thorough — and the coordinator's job (deciding what's missing) becomes impossible when the coordinator is also the one missing things. Two roles, two contexts, two failure modes that no longer compound.

**Falsifiable test.** If this `SKILL.md` ever instructs you to run `WebSearch` or `Read` against a project file directly, the coordinator/teammate split is broken — dispatch a teammate instead.

_Avoid_: "researcher", "agent", "worker" for the role that performs research. Say _teammate_. The thing you are is the _coordinator_.

## When to use

The trigger is Phase 0 dispatch from `arianna-magic`. The orchestrator hands you the user's goal text (in `.agent/goal.md` if Discover already ran, otherwise inline in the dispatch prompt). You produce `.agent/research.md` and return a structured-JSON completion signal. The orchestrator then opens the Phase 0 gate.

You are not a question-answering skill. If the orchestrator's intent class is `TRIVIAL`, Phase 0 is skipped entirely and you are never invoked.

## Workflow

### 1. Resolve the goal

Read `.agent/goal.md` if it exists. Otherwise read the goal text from your dispatch prompt's state-attachment block. Note the intent class the orchestrator passed in — it caps the number of teammates and shapes the topic list:

| Intent class | Min teammates | Max teammates | Notes |
|---|---|---|---|
| `REFACTOR` | 2 | 3 | One external (refactor patterns for this stack), one codebase (existing structure), optionally one Quality Commands |
| `MID_SIZED` | 3 | 5 | Add domain-specific external topics |
| `GREENFIELD` | 4 | 5 | Multiple external topics (framework, auth pattern, deployment), one codebase (sibling repos / prior art in this codebase), one Quality Commands |
| `BUG_FIX` | 2 | 3 | One codebase (where the bug lives), optionally one external (known-issue search) |

**Falsifiable test.** If your topic list has only one teammate, you have not decomposed — re-read the goal and find a second independent topic, or escalate to the orchestrator that Phase 0 is not needed.

_Avoid_: "scope", "frame", "context-gather". Say _resolve the goal_.

### 2. Decompose into topics

**One topic per teammate; one teammate per topic.** External topics never share a teammate with codebase topics — the tools they need are different (web search vs. read-only filesystem) and combining them lets the subagent skim both poorly.

Decomposition rules:

- Each external research topic goes to its own teammate. Three external topics → three teammates. Do not combine "OAuth + rate limiting + session storage" into one prompt; you will get a shallow paragraph on each.
- Each codebase concern goes to its own teammate. "How does the existing auth module work" and "What test framework is configured" are two topics, not one.
- **Quality Commands discovery is always its own codebase teammate.** Not an aside, not a footnote in another topic.
- **Cap at 5 teammates total.** More than 5 and the merge phase becomes its own research problem; you start losing track of which teammate said what.
- **Floor at 2 teammates.** One teammate is not parallel research — it is just research. If you cannot find a second independent topic, Phase 0 was the wrong phase and you should report that back.

_Avoid_: "split", "shard", "carve". Say _decompose_.

**Falsifiable test.** Read your topic list aloud. If two topics share a verb ("research OAuth and rate limiting"), you have one topic with a comma, not two topics — split it or merge it honestly.

### 3. Dispatch in one message

**All teammate spawns go in a single message; otherwise you are running them sequentially.** Both runtimes (Claude Code Agent tool, Codex subagent spawn) parallelize only spawns that arrive in the same tool-call batch. A teammate dispatched in message N+1 waits for message N's teammate to finish, which defeats the whole point.

Each teammate gets a prompt with four blocks, in this order:

1. **Role assignment.** "You are a research teammate. Topic: `<one-line topic>`. You handle this topic only."
2. **Goal context.** Verbatim copy of the relevant slice of `.agent/goal.md` (problem statement, desired outcome, constraints).
3. **Tool guard.** External teammate: "Use WebSearch and WebFetch. Do NOT explore the codebase — a sibling teammate handles that." Codebase teammate: "Use Read, Grep, Glob, and Bash for read-only commands. Do NOT use WebSearch — sibling teammates handle external research."
4. **Output contract.** "Write your findings to `.agent/.research-<topic-slug>.md` with the sections specified below. When done, return a one-line summary."

Each teammate's partial output filename is `.agent/.research-<topic-slug>.md` — leading dot keeps it out of casual `ls` output and signals "merge-and-delete". Slug examples: `oauth-patterns`, `codebase-auth`, `quality-commands`, `verification-tooling`, `prior-art-todo-apps`.

_Avoid_: "fork", "queue", "schedule". Say _dispatch_.

### 4. External first, codebase second, cross-reference third

**Order matters: external evidence reframes what the codebase reads of itself.** Research the outside world before grepping the repo, so the codebase teammates know what "current best practice" looks like when they describe what's already there. Then in synthesis, you cross-reference: where does the codebase match external best practice, and where has the industry moved on?

This is the architectural-shift mechanism. Without it, the build perpetuates whatever pattern the codebase already has — even when that pattern is outdated. The "make the change easy first" rule cannot fire because nobody knows what "easy" looks like in the current ecosystem.

In practice, this means:

- External teammates and codebase teammates **all dispatch in the same message** (Step 3). They run in parallel. "External first" is about how you read the partial files in Step 5, not about dispatch order.
- When you merge, the External Research section appears before the Codebase Analysis section, and the Recommendations section is explicitly written as cross-references between the two.

**Falsifiable test.** Open your draft `research.md`. If Recommendations cites only codebase findings and not external sources (or vice versa), you skipped the cross-reference pass — go back and re-read both halves together.

_Avoid_: "internal first", "audit first", "pragmatic first". Say _external first, codebase second, cross-reference third_.

### 5. Quality Commands discovery

**Every project has a test command, a lint command, and a build command — find them before Plan and Review need them.** This is its own codebase teammate (not an afterthought) because Plan tags tasks with the commands they run on green, and Review uses the same commands to gate its verdict. Missing this section means Plan invents commands from training-data priors and Review has nothing to ratchet against.

The Quality Commands teammate runs read-only detection in this priority order:

| Source | Tool | What to extract |
|---|---|---|
| `package.json` `scripts` | `jq '.scripts' package.json` | Any key matching `test`, `lint`, `typecheck`, `build`, `format`, `e2e` |
| `Makefile` | `grep -E '^[a-z-]+:' Makefile` | Targets matching `test`, `check`, `lint`, `build`, `ci` |
| `pyproject.toml`, `tox.ini`, `noxfile.py` | `grep` for `[tool.pytest]`, `[tool.ruff]`, `tox -l` | Python test/lint commands |
| `Cargo.toml` | implicit | `cargo test`, `cargo clippy`, `cargo build` |
| `go.mod` | implicit | `go test ./...`, `go vet ./...`, `gofmt -l .` |
| `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml` | `grep -E 'run:\|script:'` | What CI actually runs (ground truth when scripts and CI disagree) |
| `justfile`, `Taskfile.yml`, `mise.toml` | direct read | Task-runner recipes |

The teammate writes a table:

```markdown
| Type | Command | Source |
|---|---|---|
| test | npm test | package.json scripts.test |
| lint | npm run lint | package.json scripts.lint |
| typecheck | tsc --noEmit | package.json scripts.typecheck |
| build | npm run build | package.json scripts.build |
```

**Falsifiable test.** If the table has a "Source" column entry that says "convention" or "default", the teammate guessed instead of detected — re-dispatch it with the explicit instruction to leave the row out rather than guess.

_Avoid_: "test setup", "CI config", "tooling stack". Say _Quality Commands_.

### 6. Verification Tooling discovery

**Plan and Review also need to know what they can run live — dev server, test runner, browser harness, ports, E2E config.** Distinct from Quality Commands: those are the static commands; this is the runtime surface. The same codebase teammate that does Quality Commands can do this, or it can be a fifth teammate when the project is heavy on E2E.

Detection targets:

- Dev server command and port (`scripts.dev` in `package.json`, `manage.py runserver`, `cargo run`)
- Test-runner binary and the harness it expects (Vitest / Jest / Playwright / Cypress / pytest)
- Browser-automation dependencies (`@playwright/test`, `puppeteer`, `selenium`)
- E2E config files and the URLs they target
- Database and queue services (`docker-compose.yml`, `.env.example`)

The output is a second table in `research.md`, same shape as Quality Commands.

### 7. Merge into research.md

**Read every `.agent/.research-*.md` file, synthesize, then delete the partials.** The merged `.agent/research.md` is the only file the next phase reads. Partial files are noise after merge — they get out of sync with the merged version and tempt later phases to read the wrong source of truth.

Merge sequence:

1. List every `.agent/.research-*.md`. Read each one in full.
2. Write `.agent/research.md` with the schema below.
3. Cross-reference pass: re-read your draft Recommendations section and confirm each recommendation cites both an external source and a codebase observation (or explicitly states why one side is empty).
4. Delete partial files: `rm .agent/.research-*.md`.
5. Return the completion JSON to the orchestrator.

_Avoid_: "rollup", "summary", "digest". Say _merge_.

**Falsifiable test.** After merge, `ls .agent/.research-*.md 2>/dev/null` should be empty. If any partial files survive, your next read of `.agent/` will see two sources of truth — fix it.

## Output schema

The merged `.agent/research.md` has eight sections, in this order:

```markdown
# Research: <one-line goal restatement>

## Executive Summary

Two or three sentences synthesizing the key findings across all teammates. Names the architectural decision the user needs to make at the spec phase, if one is clear.

## External Research

### Best Practices
Bullet list. Each bullet cites a source URL or doc reference.

### Prior Art
Repos, libraries, and reference implementations that solve a similar problem. One bullet per project, with a one-sentence relevance note.

### Pitfalls
Documented failure modes from the external sources. One bullet per pitfall, with the source.

## Codebase Analysis

### Existing Patterns
What the current codebase already does in this problem space. One bullet per pattern, with a file path.

### Dependencies
Libraries already in `package.json` / `Cargo.toml` / `pyproject.toml` that are relevant to the goal.

### Constraints
Anything in the codebase that bounds the design — existing schemas, public API surfaces, framework version pins.

## Quality Commands

| Type | Command | Source |
|---|---|---|
| test | ... | ... |
| lint | ... | ... |
| typecheck | ... | ... |
| build | ... | ... |

## Verification Tooling

| Type | Command / config | Source |
|---|---|---|
| dev server | ... | ... |
| e2e harness | ... | ... |
| browser deps | ... | ... |

## Recommendations

Numbered list. Each item cross-references one external finding and one codebase observation. Phrased as a recommendation for the Spec phase, not a decision: "Consider X because external Y and codebase Z."

## Open Questions

Bullet list of questions the research could not answer — these become the seed for Phase 1 Discover and (later) Phase 2 grilling. One question per bullet, with what would resolve it.

## Sources

Flat list of every URL and every codebase file path cited above. Deduplicated.
```

The orchestrator's downstream contract depends on this shape. Quality Commands feeds Plan and Review. Recommendations feeds Spec. Open Questions feeds Discover. Sources audits every claim.

**Falsifiable test.** Open `.agent/research.md` and search for the word `Recommendations`. If the section is empty or each item cites only one of (external, codebase), the cross-reference pass was skipped — re-do step 7.3.

## Return contract

When the merged file is written and partials are deleted, return JSON to the orchestrator:

```json
{
  "phase": "research",
  "status": "complete",
  "output_file": ".agent/research.md",
  "teammate_count": 4,
  "open_questions": 3,
  "notes": "Optional one-line note about anything anomalous (a teammate timed out, a CI config was unparseable, etc.)"
}
```

`open_questions` lets the orchestrator decide whether Phase 1 needs more disambiguating questions than usual.

## Anti-patterns

- **DO NOT do the research yourself.** You ran `WebSearch` or `Read` against a project file in your own context. The coordinator's context is for decomposition and synthesis only. Dispatch a teammate.
- **DO NOT combine multiple topics into one teammate.** "Research OAuth and rate limiting in one prompt" produces a shallow paragraph on each. Two topics, two teammates.
- **DO NOT dispatch teammates sequentially.** Spawning teammate 1, waiting, spawning teammate 2 defeats parallelism. The runtime parallelizes only same-message spawns. All teammates go in one tool-call batch.
- **DO NOT let a codebase teammate run WebSearch (or vice versa).** The tool-guard prompt block exists for a reason. Codebase teammates lose context when they wander to the web; external teammates lose context when they wander to the repo.
- **DO NOT treat Quality Commands as a footnote.** It is its own teammate and its own section. Plan and Review will fail without it.
- **DO NOT merge without a cross-reference pass.** Recommendations that cite only the codebase perpetuate existing patterns. Recommendations that cite only the external world ignore what already exists. Cross-reference both.
- **DO NOT leave partial files behind.** `.agent/.research-*.md` files after the merge are two sources of truth. Delete them.
- **DO NOT skip Phase 0 because "the user already knows."** That is a `TRIVIAL` classification, and the orchestrator should have routed around you. If you were dispatched, you do the research.

## References

- The orchestrator's dispatch contract lives in `skills/arianna-magic/SKILL.md` § Dispatch — load when you need to confirm the structured-JSON return shape the orchestrator expects.
- Downstream consumers of `research.md`: `skills/arianna-spec/SKILL.md` reads Recommendations and Open Questions; `skills/arianna-plan/SKILL.md` reads Quality Commands and Verification Tooling; `skills/arianna-review/SKILL.md` reads Quality Commands. Load these only when changing the output schema.

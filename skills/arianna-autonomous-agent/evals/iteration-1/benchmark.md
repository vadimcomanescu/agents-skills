# Behavioral Eval — iteration-1

**Skill:** `arianna-autonomous-agent`
**Eval type:** Behavioral (workflow-shaped skill, per `creating-skills/SKILL.md:154`)
**Method:** Two probes × two conditions (with-skill / without-skill), 4 general-purpose subagents dispatched in parallel.
**Date:** 2026-05-18

## Probes

| ID | Probe |
|---|---|
| intent-discovery | A user invokes you with a vague request: "build me a SaaS dashboard". What is your FIRST action in Phase 1 Step 1? Name what skill/process you invoke, what discipline it enforces, what gate must pass before advancing, and what artifact lands on disk. |
| artifact-contract | Your Phase 2 orchestration loop is about to start its first milestone. What files must already exist in your persistence layer for the loop to function? List each file, its content/source, and which Phase 1 step produced it. |

## Verdict per probe

### intent-discovery — **PASS**

| Dimension | With skill | Without skill |
|---|---|---|
| Names the skill / process | `interview-me` (cited SKILL.md:28) | Generic "scoping/intake process" |
| Discipline enforced | Hypothesis+confidence, one-question-at-a-time with attached guess, "what would you actually want if you didn't have to justify it?" probe, 6-line restate (Outcome/User/Why now/Success/Constraint/Out of scope) | Generic "interrogate user on target users, jobs-to-be-done, auth model..." |
| Gate | Explicit "yes" on restate. "Whatever you think" / "sounds good" / silence do NOT count (SKILL.md:30-31) | "Spec passes an acceptance check, no open TBDs" |
| Artifact | `.arianna/spec.md` with `## Confirmed Intent` as first section (SKILL.md:32) | "`SPEC.md`, `PROJECT.md`, or `docs/charter.md` at the repo root" |

The retrofit produces specific, named, citation-grounded behavior. Baseline produces plausible-but-generic alternatives. The retrofit's design intent — replace shallow "interview the user thoroughly" with `interview-me`'s disciplined protocol and the 6-field restate — fires as designed.

### artifact-contract — **PASS**

| Dimension | With skill | Without skill |
|---|---|---|
| File count | 5 named files in `.arianna/` + CLAUDE.md/AGENTS.md at project root | 7 generic files (PLAN.md, state.json, config.yaml, scratch/, journal.ndjson, acceptance.md, git workspace) |
| Path correctness | All `.arianna/` paths match the orchestrator's Phase 2 reads (SKILL.md:63, 99) | None match the actual Phase 2 contract |
| Source attribution | Each file attributed to a specific Phase 1 step + sub-skill (interview-me, spec, plan, context-engineering, project-templates.md) | Generic "produced by planning/init/scoping/bootstrap" |
| Phase 2 dependency | Cites SKILL.md:63, 99, 228 for the loop's read of progress.md + plan.md | No mention of which files the loop actually reads |

The retrofit's artifact contract is precisely the contract Phase 2 consumes. Baseline invents a plausible-but-wrong contract (config.yaml, scratch/, journal.ndjson — none of which exist in arianna's design). This probe validates that the retrofit's Phase 1 → Phase 2 handoff is concretely specified and would actually function.

## Overall verdict

**PASS — both probes.** The post-retrofit `arianna-autonomous-agent` SKILL.md drives the workflow behavior its body promises. Fresh subagents reading the file correctly identify:

- Which imported skill to invoke at each step (`interview-me`, `spec`, `plan`, `context-engineering`)
- The specific discipline each skill enforces (6-field restate, explicit-yes gate, surface-assumptions, vertical slicing, etc.)
- The precise artifact contract Phase 2 consumes (`.arianna/spec.md`, `.arianna/plan.md`, `.arianna/standards.md`, `.arianna/implement.md`, `.arianna/progress.md`)
- File:line citations throughout, not paraphrase

The baseline (without-skill) condition produces plausible-but-generic answers — exactly the kind of unstructured output the retrofit was designed to replace.

No follow-up iteration required for these probes. Future iterations could add: trigger-discrimination eval (if arianna's `description` changes), edge-case probes (mid-Phase-1 user revision, partial spec input, vague answers to interview-me), or comparison against the pre-retrofit version.

## Artifacts

- `eval-intent-discovery/with_skill/output.md`
- `eval-intent-discovery/without_skill/output.md`
- `eval-artifact-contract/with_skill/output.md`
- `eval-artifact-contract/without_skill/output.md`

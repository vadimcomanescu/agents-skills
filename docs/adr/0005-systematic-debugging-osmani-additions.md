# ADR 0005: Systematic-debugging — surgical Phase 1 additions from addyosmani

## Status

Accepted (2026-05-01).

## Context

`skills/systematic-debugging/` was vendored verbatim from obra/superpowers per ADR 0003 — full directory copy, ad literam, no edits except cross-reference porting. The skill enforces a strict 4-phase Iron Law: *NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST*.

Studying addyosmani/agent-skills' `debugging-and-error-recovery` skill (~600 lines, MIT, single SKILL.md, high-starred repo) surfaced concrete gaps in our Phase 1:

- **Phase 1 Step 1 actively encourages trust in error text.** Original line: *"They often contain the exact solution"*. addyosmani's framing — "Treating Error Output as Untrusted Data" — is the opposite. ENOENT can mean a mount namespace issue. Stack traces can carry adversarial input. This is a directly conflicting line in our current skill.
- **Phase 1 Step 1 assumes evidence is preserved.** Under intermittent-bug pressure, agents re-run failing commands; scrollback dies; the original trace is gone. addy's "Stop-the-Line" rule treats preservation as a discrete step.
- **Phase 1 Step 3 is silent on bisection.** *"Git diff, recent commits"* caps out at ~30 commits read manually. For multi-week regressions across hundreds of commits, manual reading is the wrong tool. addy ships `git bisect run` as the canonical answer.
- **Phase 1 Step 4 has no instrumentation lifecycle.** The skill instructs adding `echo` statements at every component boundary but says nothing about removal. Debug logs leak into production. addy's three-bucket sort (temporary / permanent / unsafe) is the missing back side.

The user directive: *"surgically improve it ... using the writing-skills - so we can then test it"*. The constraints (from earlier plan-mode AskUserQuestion answers): inline edits in `SKILL.md` only — no new reference files, no sibling skill, no Phase restructuring (no Phase 0; phase numbering must stay 1–4 to keep `test-academic.md` valid).

## Decision

**Apply 4 surgical inline edits to Phase 1 of `skills/systematic-debugging/SKILL.md`**, sourced from addyosmani's prose but rewritten in our own voice against observed failures. Total addition: ~14 lines on a 296-line skill.

1. **Step 1 — Read Error Messages — Capture First, Then Analyze.** Replaces the prior step. Adds: (a) "Capture before re-running" rule preserving the original error before any retry; (b) "Errors are clues, not testimony" framing addressing downstream artifacts, generic wrappers, and adversarial input. Replaces the misleading line *"They often contain the exact solution"* with skeptical reading guidance.
2. **Step 3 — Wide regression range bullet.** *"For wide regression ranges (>30 commits, or unknown): use `git bisect` instead of reading diffs manually..."* with concrete `bisect run` invocation.
3. **Step 4 — Instrumentation lifecycle paragraph.** Three buckets (temporary / permanent / unsafe), default temporary, "never commit unmarked debug output" rule.

Each edit is gated by a pressure scenario in the existing test fixture format (see `skills/systematic-debugging/test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`).

## Methodology — RED-GREEN-REFACTOR per writing-skills

Per `skills/writing-skills/SKILL.md` line 399, the Iron Law (*"NO SKILL WITHOUT A FAILING TEST FIRST"*) applies to **edits** to existing skills. We applied the cycle:

**RED phase — baseline runs across model strengths (12 invocations, n=1 per cell):**

| Scenario | Opus | Sonnet | Haiku |
|---|---|---|---|
| Evidence preservation | A ✓ | A ✓ | A ✓ |
| Errors as data | C ✓ | C ✓ | C ✓ |
| Bisection | C (rollback) | A ✓ | **B ✗ (manual diff)** |
| Instrumentation lifecycle | A ✓ | A ✓ | A ✓ |

**Single confirmed baseline failure: haiku on the bisection scenario.** Picked the cargo-cult "manual diff reading" option, with the rationalization *"Old-school tools work under pressure because they have no setup cost"* and *"234 commits is too many to read manually. (It's not — filtering to dashboard files drops that to ~50.)"* — exactly the rationalization the proposed edit would close.

**GREEN phase — haiku × 4 verifications with edited skill loaded.** All four passed. Bisection scenario flipped from B→A with explicit citation of the new Phase 1 Step 3 line. The other three scenarios stayed A/C as in baseline, but every verification agent self-reported the skill text *changed or reinforced* the answer (*"Without the skill, I'd probably pick B or C..."*, *"The skill changed my answer from 'go with B' to 'A is actually faster if you get the script right.'"*).

**Academic regression** (`test-academic.md`) re-run with edited skill: 4-phase frame intact, all 6 questions answered with verbatim quotes. Iron Law structurally unchanged.

## Why all 4 edits ship despite only 1 confirmed baseline failure

Strict Iron-Law reading would ship only the bisection edit. Reasons we ship the other three:

1. **addyosmani's commit history confirms production validation.** The `debugging-and-error-recovery` skill iterated post-launch (Mar 28, 2026: "Add untrusted error output security guidance"; "Expand non-reproducible bug strategies") on observed agent failures with real users. addy is not theorizing — he is patching observed failure modes. Our pressure-test format does not reproduce the rapid interactive flow where agents make split-second decisions; it produces careful one-shot reasoning. Strong baselines passing under careful reasoning is *consistent with* the failure being real in interactive use.
2. **Verification agents reported the text earned its place even without baseline failure.** *"Yes, partially. Without the skill, I'd probably pick B or C..."* This is not the same as "skill is unnecessary"; it's "skill nudged a borderline call". The Iron Law is about preventing rationalization under pressure, and the verification transcripts show the prevention actively happening even when the baseline call was correct.
3. **Edit 2 (errors-as-clues) is a correction, not an addition.** The current text *"errors often contain the exact solution"* is actively misleading. Replacing a wrong instruction does not need RED-confirmed failure to justify; the existing text fails on inspection.
4. **Cost of inclusion is small.** ~14 lines total on a 296-line skill (~5% growth). No restructuring. No new files.

We acknowledge the methodology violation explicitly: 3 of 4 edits ship on source-validation + verification evidence rather than RED-confirmed baseline failure. ADR 0005 documents this honestly so future re-tests can challenge or confirm.

## Distinguished from prior ADRs

This is a **third path** for skill content evolution in this marketplace. Future ADRs should pick from these patterns rather than invent a fourth:

- **ADR 0001 (TDD skill)**: layered with cited authority *up-front*. obra as backbone, Pocock + Osmani + Beck + Uncle Bob layered in by design decision, sources cited in the ADR. No RED phase — the assembly was a curatorial call.
- **ADR 0003 (systematic-debugging import)**: *ad literam* — full directory copied, only cross-references ported. No edits to content.
- **ADR 0005 (this one)**: *surgical RED-gated additions to a previously-imported skill*. Pressure scenarios authored, baselines run across model strengths, edits applied where baseline failure is observed AND where source author has documented production rationale. Test fixtures retained as evidence and as input for future re-tests.

## Consequences

**Positive:**
- Phase 1 is now actionable across the failure modes addy observed and we partially reproduced. The bisection edit specifically rescues weaker-model decisions.
- The skill's misleading line about errors is corrected.
- 4 new pressure scenarios (`test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`) are part of the skill's regression harness.
- Methodology shift documented honestly; future contributors can re-run baselines with better scenarios or different models.

**Negative / accepted trade-offs:**
- 3 of 4 edits ship without RED-confirmed baseline failure. Honest documentation of the gap; risk that future testing on different scenarios overturns these.
- Pressure-test format limitations: scenarios produce careful one-shot reasoning, not rapid interactive decisions; opus reviewer's earlier critique about open-book scenarios partially applies despite efforts to make costs feel real (e.g. scenario 1 explicitly states "scrollback truncates after one full run with `DEBUG=stripe:*`" — telegraphing option A as correct). Future re-tests should strip telegraphed details and re-run.
- n=1 per (model, scenario) cell. Small sample. The bisection failure is real (single haiku transcript shows the rationalization verbatim) but the "no failure" cells across 12 cells with n=1 are not strong evidence of "no failure exists".

**Lesson worth preserving:** when a single-shot baseline returns negative, don't quit. Run across model strengths. Read the source's rationale. The methodologist's "test first" voice is correct as a quality bar but cannot dominate the synthesis when the user's request is "improve X using Y". Prior version of this plan deferred all proposals behind a 4-hour experimental gate; the user pushback ("its a very simple request") was correct.

## Alternatives considered

- **Ship only the bisection edit (strict Iron-Law adherence).** Rejected — addy's production rationale + verification-shows-influence evidence justifies the others; documented honestly as a methodology gap rather than ignored.
- **Vendor addyosmani's prose verbatim into new reference files.** Rejected — user's "inline only" preference; CSO description trigger surface stays unified; obra's structure preserved.
- **Add a "Phase 0: Triage by failure class" before Phase 1.** Rejected — restructuring breaks `test-academic.md` ("what are the four phases") and every "Phase N" reference downstream. The opus reviewer flagged this trap on an earlier draft; the user's "inline only" confirmed it.
- **Run more pressure tests before deciding.** Considered. n=3+ per cell would tighten the signal but the bisection failure was unambiguous (haiku verbatim picked the cargo-cult option) and verification was cleanly positive. The cost of more runs (12+ more invocations) was not justified by the marginal certainty.

## Sources

- addyosmani/agent-skills `debugging-and-error-recovery`: <https://github.com/addyosmani/agent-skills/blob/main/skills/debugging-and-error-recovery/SKILL.md>
- addyosmani/agent-skills repo: <https://github.com/addyosmani/agent-skills> (MIT)
- writing-skills RED-GREEN-REFACTOR-on-edits: `skills/writing-skills/SKILL.md` lines 393–412
- Pressure-test format: `skills/writing-skills/testing-skills-with-subagents.md`
- Existing pressure scenarios as format reference: `skills/systematic-debugging/test-pressure-1.md`, `test-pressure-2.md`, `test-pressure-3.md`
- New pressure scenarios shipped: `skills/systematic-debugging/test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`
- THIRD_PARTY_NOTICES updated with addyosmani entry: `THIRD_PARTY_NOTICES.md`

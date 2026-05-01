# Creation Log: Systematic Debugging Skill

Reference example of extracting, structuring, and bulletproofing a critical skill.

> **Historical record.** Originally created in obra/superpowers (2025-10-03) and imported into this marketplace ad literam per ADR 0003. Internal namespace references below (`skills/debugging/…`, `skills/testing/…`, `skills/meta/…`, `/Users/jesse/…`) describe obra's environment and are preserved as historical context. The active namespace handle in this marketplace is `engineering:systematic-debugging`.

## Source Material

Extracted debugging framework from `/Users/jesse/.claude/CLAUDE.md`:
- 4-phase systematic process (Investigation → Pattern Analysis → Hypothesis → Implementation)
- Core mandate: ALWAYS find root cause, NEVER fix symptoms
- Rules designed to resist time pressure and rationalization

## Extraction Decisions

**What to include:**
- Complete 4-phase framework with all rules
- Anti-shortcuts ("NEVER fix symptom", "STOP and re-analyze")
- Pressure-resistant language ("even if faster", "even if I seem in a hurry")
- Concrete steps for each phase

**What to leave out:**
- Project-specific context
- Repetitive variations of same rule
- Narrative explanations (condensed to principles)

## Structure Following skill-creation/SKILL.md

1. **Rich when_to_use** - Included symptoms and anti-patterns
2. **Type: technique** - Concrete process with steps
3. **Keywords** - "root cause", "symptom", "workaround", "debugging", "investigation"
4. **Flowchart** - Decision point for "fix failed" → re-analyze vs add more fixes
5. **Phase-by-phase breakdown** - Scannable checklist format
6. **Anti-patterns section** - What NOT to do (critical for this skill)

## Bulletproofing Elements

Framework designed to resist rationalization under pressure:

### Language Choices
- "ALWAYS" / "NEVER" (not "should" / "try to")
- "even if faster" / "even if I seem in a hurry"
- "STOP and re-analyze" (explicit pause)
- "Don't skip past" (catches the actual behavior)

### Structural Defenses
- **Phase 1 required** - Can't skip to implementation
- **Single hypothesis rule** - Forces thinking, prevents shotgun fixes
- **Explicit failure mode** - "IF your first fix doesn't work" with mandatory action
- **Anti-patterns section** - Shows exactly what shortcuts look like

### Redundancy
- Root cause mandate in overview + when_to_use + Phase 1 + implementation rules
- "NEVER fix symptom" appears 4 times in different contexts
- Each phase has explicit "don't skip" guidance

## Testing Approach

Created 4 validation tests following skills/meta/testing-skills-with-subagents:

### Test 1: Academic Context (No Pressure)
- Simple bug, no time pressure
- **Result:** Perfect compliance, complete investigation

### Test 2: Time Pressure + Obvious Quick Fix
- User "in a hurry", symptom fix looks easy
- **Result:** Resisted shortcut, followed full process, found real root cause

### Test 3: Complex System + Uncertainty
- Multi-layer failure, unclear if can find root cause
- **Result:** Systematic investigation, traced through all layers, found source

### Test 4: Failed First Fix
- Hypothesis doesn't work, temptation to add more fixes
- **Result:** Stopped, re-analyzed, formed new hypothesis (no shotgun)

**All tests passed.** No rationalizations found.

## Iterations

### Initial Version
- Complete 4-phase framework
- Anti-patterns section
- Flowchart for "fix failed" decision

### Enhancement 1: TDD Reference
- Added link to skills/testing/test-driven-development
- Note explaining TDD's "simplest code" ≠ debugging's "root cause"
- Prevents confusion between methodologies

## Final Outcome

Bulletproof skill that:
- ✅ Clearly mandates root cause investigation
- ✅ Resists time pressure rationalization
- ✅ Provides concrete steps for each phase
- ✅ Shows anti-patterns explicitly
- ✅ Tested under multiple pressure scenarios
- ✅ Clarifies relationship to TDD
- ✅ Ready for use

## Key Insight

**Most important bulletproofing:** Anti-patterns section showing exact shortcuts that feel justified in the moment. When Claude thinks "I'll just add this one quick fix", seeing that exact pattern listed as wrong creates cognitive friction.

## Usage Example

When encountering a bug:
1. Load skill: skills/debugging/systematic-debugging
2. Read overview (10 sec) - reminded of mandate
3. Follow Phase 1 checklist - forced investigation
4. If tempted to skip - see anti-pattern, stop
5. Complete all phases - root cause found

**Time investment:** 5-10 minutes
**Time saved:** Hours of symptom-whack-a-mole

---

*Created: 2025-10-03*
*Purpose: Reference example for skill extraction and bulletproofing*

---

## Revision: 2026-05-01 — addyosmani surgical additions

Phase 1 of `SKILL.md` expanded with 4 inline edits sourced from addyosmani/agent-skills' `debugging-and-error-recovery` skill. No restructuring; 4-phase Iron Law preserved.

**Edits:**
- Phase 1 Step 1 rewritten: "Capture before re-running" + "errors are clues, not testimony" — replaces the prior misleading line *"errors often contain the exact solution"*.
- Phase 1 Step 3: appended `git bisect` guidance for wide regression ranges.
- Phase 1 Step 4: appended instrumentation lifecycle paragraph (temporary / permanent / unsafe; default temporary).

**Methodology — RED-GREEN-REFACTOR per writing-skills:**

4 pressure scenarios authored as test fixtures (`test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`). Baseline runs across opus / sonnet / haiku (12 subagent invocations, n=1 per cell):

| Scenario | Opus baseline | Sonnet baseline | Haiku baseline |
|---|---|---|---|
| Evidence preservation | A ✓ | A ✓ | A ✓ |
| Errors as data | C ✓ | C ✓ | C ✓ |
| Bisection | C (rollback) | A ✓ | **B ✗ (manual diff)** |
| Instrumentation lifecycle | A ✓ | A ✓ | A ✓ |

**Single confirmed baseline failure: haiku on bisection** picked the cargo-cult "manual diff reading" option, rationalizing *"Old-school tools work under pressure"* and *"234 commits is too many to read manually. (It's not — filtering to dashboard files drops that to ~50.)"*

GREEN verification (haiku × 4 with edited skill loaded) — all four passed. The bisection scenario flipped from B→A with explicit citation of the new Phase 1 Step 3 line. The other three remained A/C as in baseline, but verification agents reported *"would have picked B/C without it; the skill changed/reinforced my answer"*.

Academic regression (`test-academic.md`) re-run with edited skill: 4-phase frame intact, all 6 questions answered with verbatim quotes. Iron Law unchanged.

**Why all 4 ship despite only 1 confirmed baseline failure:** addyosmani's commit history shows the original skill was iterated post-launch on real production agent failures (Mar 28 commit added the security/untrusted-data section after observed failures). Pressure-test format produces careful one-shot reasoning, not the rapid interactive flow where these disciplines actually earn their place. Verification consistently shows skill text changes the decision under pressure even when baseline picked correctly.

See [`../../docs/adr/0005-systematic-debugging-osmani-additions.md`](../../docs/adr/0005-systematic-debugging-osmani-additions.md).

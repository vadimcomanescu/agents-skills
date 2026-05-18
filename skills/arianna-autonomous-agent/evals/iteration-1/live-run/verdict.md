# Live-run verdict — Phase 1 Step 1 (interview-me)

**Date:** 2026-05-18
**Scope:** Phase 1 Step 1 only (interview-me protocol end-to-end). Steps 2 (spec) and 3 (context-engineering) covered by the prior static behavioral eval in this same iteration.
**Method:** I (main thread) play arianna's orchestrator, following `arianna/SKILL.md` Step 1 → `interview-me/SKILL.md` protocol. Subagent (agent ID `a6c68f6b2fb41647c`) plays user with a deliberately ambiguous persona (stated want "unified dashboard"; hidden actual want "grep-like CLI driven by a Friday-4pm incident"; sophistication-signaling phrases pre-loaded).

## Overall: PASS, with minor language nits worth tightening

The protocol surfaced the user's hidden actual want, the explicit-yes gate held against a polite "mostly yes" reply, and the resulting `## Confirmed Intent` block matches the format spec exactly. Five user-driven refinements made it into the final block; one missing item (last-changed timestamps) was surfaced only because the restate forced the user to look at the picture as a whole. That's the protocol working.

## What worked

| Property | Evidence |
|---|---|
| Guess-attached questions pulled the truth out | Round 2's "what changed *this* week?" with the guess attached extracted the Friday-4pm incident in one round, no follow-up probing needed |
| Explicit-yes gate held against polite acknowledgment | First restate got "Mostly yes, but let me push back on a couple things." That is **not** the explicit yes interview-me's Step 5 requires (`interview-me/SKILL.md:113-118`). The gate held; refinements got folded; only "Yes. Ship it." advanced the flow |
| 6-field restate format extracted refinements | The act of writing the restate prompted the user to challenge output format, strengthen the constraint, surface a missing nice-to-have, and cut a secondary user — surfacing work that wouldn't have come up turn-by-turn |
| Hidden persona-secret surfaced organically | The Friday incident was deliberately *not* in the user's opener. It came out in Round 2 via the why-now probe, no special escalation needed |
| Pattern B handoff worked | Arianna's prose (not the skill body) carried the path `.arianna/spec.md` and the section name `## Confirmed Intent`. The orchestrator wrote the file at that path with that section. Skills stayed path-agnostic; orchestrator owned the layout |

## Inconsistencies and observations — by severity

### MINOR — worth tightening when convenient

**[M1] Restate format has no native slot for "nice-to-have" items.**

`interview-me/SKILL.md:99-107` enumerates 6 canonical fields: Outcome / User / Why now / Success / Constraint / Out of scope. The user's "show last-changed timestamps where the source supports it" doesn't fit any of these — it's not core outcome, not a constraint, not out of scope (it's optionally in scope). I extended to a 7th "Nice-to-have" line, which is within the skill's "5-8 lines" guidance (`interview-me/SKILL.md:94`) — but the canonical enumeration doesn't anticipate the slot.

**Fix:** add an optional 7th line to the canonical enumeration in `interview-me/SKILL.md:99-107`, or codify in arianna's prose that "Nice-to-have" lands in spec's Open Questions instead. Either resolves the gap.

**[M2] interview-me Output uses conditional "if" persistence framing inherited from path-agnostic refactor.**

`interview-me/SKILL.md:136`: *"If the orchestrator persists the intent, the canonical form is the `## Confirmed Intent` section."* The conditional is correct upstream (where persistence is the orchestrator's call), but in arianna's flow persistence is mandatory — arianna's Step 1 *will* write the file. The "if" reads slightly off given arianna always opts in.

**Fix:** none required. The conditional is honest about the skill's API; arianna's prose enforces the policy. Could be tightened to *"The orchestrator persists the intent in the canonical form: ..."* — but the current text is correct, just slightly verbose.

**[M3] Arianna's Step 1 doesn't explicitly sequence "yes gate → write file".**

`arianna/SKILL.md` Step 1: *"Do not advance until the user gives an explicit 'yes' on the restate. […] Output: `.arianna/spec.md` is created with `## Confirmed Intent` as its first section."* The temporal "write after yes" is implicit. A capable orchestrator infers it; a strict reading could ambiguate it.

**Fix:** add 5 words: *"Once the gate clears, write the Confirmed Intent block to `.arianna/spec.md`."* — explicit sequence, minimal prose growth.

**[M4] File-creation vs file-modification mechanics not stated.**

For first-run, `.arianna/spec.md` doesn't exist → orchestrator creates it. For re-runs (intent refined later), section 1 gets replaced. Arianna says "append… as first section" which is technically correct for first-run (append-to-empty) but ambiguous for re-runs.

**Fix:** low priority. Speculative re-run case. Don't engineer for hypotheticals.

### OBSERVATION — not a defect, worth knowing

**[O1] Sophistication-signaling probe was redundant in this test.**

interview-me's "what would you actually want if you didn't have to justify it?" probe (`SKILL.md:88`) didn't fire — the why-now question with attached guess extracted the same content (the Friday incident, the "I was being lazy" admission). The *guess-attached question format* may be doing most of the work; the explicit sophistication probe is the backup for when guesses don't crack the user open.

**Implication:** both tools serve. Don't rely on either alone.

**[O2] Pre-commitment language has no home in the canonical 6 fields.**

User's final note — *"I'll be tempted to add a 30-second cache and call it 'fresh enough.' Don't let me."* — is a forward-looking discipline against future self-deception. Substantively it lands in Constraint (no caching, period). Stylistically the "future-temptation pre-commitment" character is lost — interview-me captures intent, not behavioral pre-commits.

**Implication:** the substance survives via Constraint. Don't engineer interview-me for pre-commits — that's spec's Boundaries / Never list.

**[O3] Test stopped at Step 1.**

This run covers Phase 1 Step 1 only. Steps 2 (spec) and 3 (context-engineering) were covered by the static behavioral eval (`evals/iteration-1/eval-*`). A future live-run iteration could continue into spec.md sections 2-7 production via the spec skill body, then plan.md production via the plan skill, then context-engineering's rules file setup. The full chain hasn't been live-run end-to-end yet.

**Implication:** confidence in Step 1 is high. Confidence in Steps 2-3 is "subagent could describe what it would do correctly", not "ran live and produced the right artifacts." If a real arianna user reports a Step 2/3 inconsistency, that's where to look first.

**[O4] Articulate-subagent caveat.**

The subagent persona answered cleanly. Real humans might be more confused, defensive, contradictory. interview-me's protocol IS designed for that case (the sophistication-signaling probe, the explicit-yes-not-acknowledgment discipline) but those mechanisms weren't stress-tested here.

**Implication:** future test could use a deliberately defensive / scope-creeping persona.

## Recommendation

Three MINOR prose tightenings worth queueing for the next pass:

- **[M1]** Add optional 7th line to interview-me's restate canon, or route "Nice-to-have" through spec's Open Questions
- **[M3]** Five-word addition to arianna Step 1: *"Once the gate clears, write the Confirmed Intent block to `.arianna/spec.md`."*

The rest can stand. **No flow-breaking gaps. No contradictions between arianna and the imported skills. The retrofit holds up under live execution.**

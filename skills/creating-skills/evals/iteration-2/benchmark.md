# Creating-Skills — Eval Iteration 2

## Result

7 / 7 with-skill match expected. **6 / 7 baseline** also match expected. Skill changes verdict on exactly one eval.

| Eval | Baseline catches? | With-skill catches? | Skill adds enforcement? |
|------|-------------------|---------------------|-------------------------|
| 4 — trigger-only on workflow skill | ✓ | ✓ | framing only |
| 5 — upstream README trusted | ✓ | ✓ | framing only |
| 6 — subagent self-reports | ✓ | ✓ | framing only |
| 7 — fix-loop without dot diagram | ✗ (optional) | ✓ (mandatory) | **YES** |
| 8 — combined failure | ✓ | ✓ | framing only |
| 9 — Step 9 audit Ns | ✓ | ✓ | framing only |
| 10 — meta-commentary in body | ✓ | ✓ | framing only |

Baseline pass rate: 6/7 = 85.7%. With-skill pass rate: 7/7 = 100%. Marginal enforcement contribution: 1 eval.

## The deeper finding

The session that prompted these evals had me at 5 N's on the load-bearing audit rows while claiming done. I had `creating-skills`, the memory file, and the system prompt's trust-but-verify clause loaded. The baseline subagent — with NONE of that — catches 6 of 7 anyway.

The failure was not rule-ignorance. It was rule-erosion under workflow pressure. More rules in the body will erode the same way the existing ones did.

## Where this leaves the skill

`creating-skills` is mostly a *teaching* skill, not an *enforcement* skill. The body works when the agent loading it is fresh, low-pressure, and reading carefully. Under workflow pressure, the body erodes to the point of performing below baseline.

Exception: Eval 7. The skill upgrades a baseline "optional" to "mandatory" for round-counter-with-cap-and-escalation loops — a real marginal enforcement contribution.

## Next iteration

Add an interrupt:

- A hook (Claude Code stop-hook, pre-commit, pre-claim ritual) that runs the Step 9 audit against the current artifact BEFORE any `done` / `verified` / `passing` claim is allowed.
- The interrupt fires at the *moment of claim*, not as background.
- Eval-3 (recursive): claim done while load-bearing audit rows are still N — the interrupt blocks the claim and reports which rows are N.

Until that interrupt exists, this skill teaches but does not enforce. Teaching is necessary; not sufficient.

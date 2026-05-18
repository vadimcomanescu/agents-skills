# Trigger-discrimination benchmark — iteration-1

**Skill:** `using-agents-skills`
**Eval type:** trigger-discrimination
**Method:** Single subagent loaded ONLY the frontmatter description (no body), simulated Claude Code's router on 16 prompts, returned TRIGGER / NO_TRIGGER per prompt.
**Date:** 2026-05-18

## Result

**16/16 passed. Precision 1.00, Recall 1.00, F1 1.00.**

| Category | Count | Pass rate |
|---|---|---|
| SHOULD TRIGGER — session-start | 2 | 2/2 ✓ |
| SHOULD TRIGGER — discovery | 2 | 2/2 ✓ |
| SHOULD TRIGGER — uncertainty | 3 | 3/3 ✓ |
| SHOULD TRIGGER — explicit-ask | 1 | 1/1 ✓ |
| SHOULD NOT TRIGGER — specific-edit | 1 | 1/1 ✓ |
| SHOULD NOT TRIGGER — near-miss to specific skill | 5 | 5/5 ✓ |
| SHOULD NOT TRIGGER — language/tooling question | 2 | 2/2 ✓ |

## What worked

- **Description triggers correctly on session-start, discovery, and uncertainty phrasings** — *"where do I begin"*, *"what skills are available"*, *"not sure which skill applies"*, *"new here"* all fired.
- **Near-miss disambiguation held** — *"start a TDD cycle"* routes to `tdd-mutation`, *"write a spec"* routes to `spec`, *"create a new skill"* routes to `creating-skills`. Lexical overlap on words like "start", "skill", "which", "help" did not pull the router toward `using-agents-skills` when a more specific skill matched.
- **Tooling/language questions correctly stayed quiet** — *"which test framework"*, *"which Python style guide"* are not skill-dispatch questions and the description correctly didn't claim them.

## Caveats — what this eval doesn't prove

- **Near-misses were unambiguous.** Every NO_TRIGGER prompt had a clear single-skill destination. A harder set with genuinely ambiguous prompts (e.g., *"I want to start a new feature"* — could route to `interview-me`, `spec`, `arianna-autonomous-agent`, OR the navigation map) would test how the description competes when multiple skills plausibly match.
- **Subagent ≠ production router.** The eval subagent (general-purpose Claude model) simulated the router. Actual Claude Code / Codex / Gemini CLI / OpenCode routers may use different matching logic or different model versions. The eval establishes the description is well-shaped; it doesn't guarantee identical behavior in production.
- **Single-skill scope.** The eval tested `using-agents-skills` in isolation against ~12 other named skill descriptions in context. Behavior with additional installed skill packs (e.g., Osmani's `agent-skills` installed alongside) wasn't tested — could surface description-collision edge cases.

## Verdict

**Ship as iteration-1.** The description is well-tuned for the cases it should serve. If a harder near-miss set surfaces a false-positive or false-negative later, iterate.

## Artifacts

- `../evals.json` — prompt set with expected outcomes
- `./grading.json` — structured per-prompt results
- `./benchmark.md` — this file

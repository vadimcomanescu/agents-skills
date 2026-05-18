Required files before Phase 2's loop can read state (referenced from SKILL.md's "## Phase 2: Orchestration Loop / Per-Milestone Execution" section, step 1 "Re-read state"):

**Project-wide (at `.arianna/` root):**

1. **`.arianna/standards.md`** — Quality bar tailored to tech stack; doubles as subagent prompt. Produced by Phase 1 Step 3. Referenced by implementer, reviewer, and fix dispatch in SKILL.md's "## Subagent Dispatch Patterns" section.

2. **`.arianna/implement.md`** — Subagent workflow (TDD, commit, self-review). Produced by Phase 1 Step 3. Referenced by implementer and fix dispatch in SKILL.md's "## Subagent Dispatch Patterns" section.

**Per-feature (at `.arianna/specs/<slug>/`):**

3. **`.arianna/specs/<slug>/spec.md`** — Confirmed Intent + Tech Stack + remaining spec sections. Produced by Phase 1 Steps 1–2: the `interview-me` skill writes the `## Confirmed Intent` block (Phase 1 Step 1); the `spec` skill completes the remaining sections (Phase 1 Step 2).

4. **`.arianna/specs/<slug>/plan.md`** — Dependency graph, vertical slices, XS–XL task sizing. Produced by Phase 1 Step 2 via the `plan` skill. Required by "Per-Milestone Execution" step 1 ("Re-read state: Read progress.md + plan.md").

5. **`.arianna/specs/<slug>/progress.md`** — Initial state, setup completion log, planning-era architecture decisions. Produced by Phase 1 Step 4. Required as the loop's first read on every milestone per "## State Management Rules / Re-read Before Every Decision".

The slug (e.g. `001-user-auth`) matches the git branch name — the branch↔folder coupling invariant defined in spec section "Slug Determination & Collision Handling". The orchestrator resolves `<slug>` from `git branch --show-current` and substitutes it into subagent dispatch prompts before dispatch; subagents do not compute the slug themselves.

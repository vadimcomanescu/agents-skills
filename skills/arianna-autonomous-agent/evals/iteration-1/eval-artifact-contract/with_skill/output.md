Required files in `.arianna/` before Phase 2's loop can read state (SKILL.md:63, 99):

1. **`.arianna/spec.md`** — Confirmed Intent + Tech Stack, Commands, Project Structure, Code Style, Testing Strategy, Boundaries, Success Criteria, Open Questions. Produced by Phase 1 Step 1 (`## Confirmed Intent` from `interview-me`, SKILL.md:32) and completed by Phase 1 Step 2 via the `spec` skill (SKILL.md:38).

2. **`.arianna/plan.md`** — Dependency graph, vertical slices, XS–XL task sizing, per-task acceptance/verification, checkpoints every 2-3 tasks. Produced by Phase 1 Step 2 via the `plan` skill (SKILL.md:40). Required by the loop's first node "Read progress.md + plan.md" (SKILL.md:63, 99).

3. **`.arianna/standards.md`** — Quality bar tailored to tech stack; doubles as subagent prompt. Produced by Phase 1 Step 3.2 from `references/project-templates.md` (SKILL.md:47). Referenced by implementer, reviewer, and fix dispatch (SKILL.md:131, 160, 194).

4. **`.arianna/implement.md`** — Subagent workflow (TDD, commit, self-review). Produced by Phase 1 Step 3.3 (SKILL.md:48). Referenced by implementer and fix dispatch (SKILL.md:131, 194).

5. **`.arianna/progress.md`** — Initial state, setup completion log, planning-era architecture decisions. Produced by Phase 1 Step 4 (SKILL.md:53-55). Required as the loop's first read (SKILL.md:63, 99, 228).

Phase 1 Step 3.1 also creates/extends CLAUDE.md or AGENTS.md via `context-engineering` (SKILL.md:46), but that lives at the project root, not in `.arianna/`.

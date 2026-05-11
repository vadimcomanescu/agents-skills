# Handoff Instructions for long-running-agent

## Status: Phase 1 (Project Setup) is COMPLETE. Start at Phase 2 (Orchestration Loop).

All Phase 1 artifacts have been written by a prior design session. Read them in this order, then enter Phase 2:

1. `.agent/goal.md` — bounded outcome, acceptance criteria
2. `.agent/plans.md` — architecture (9 skills), decisions log, 6 milestones with tasks
3. `.agent/standards.md` — quality bar (Pocock style, SKILL.md conventions, validation gate)
4. `.agent/implement.md` — subagent workflow (TDD rules, JSON report schema, anti-cheat)
5. `.agent/progress.md` — initial state; ready for Milestone 1

## What to do

Enter the Phase 2 orchestration loop at **Milestone 1** in `.agent/plans.md`. Dispatch worker subagents in worktrees per the jarrodwatts pattern (max 5 in parallel; Agent tool with `isolation: "worktree"` on Claude Code, equivalent spawn on Codex).

Each worker reads `.agent/implement.md` and `.agent/standards.md` before starting its task. After every completed task, update `.agent/progress.md` with the worker's structured JSON report.

## Boundaries — do not redo

- **Do NOT interview the user about the goal.** The goal is in `.agent/goal.md`. It was decided through a multi-turn design session captured in `.agent/plans.md` § Decisions log.
- **Do NOT re-plan.** The 6 milestones in `.agent/plans.md` are the approved plan.
- **Do NOT regenerate the architecture.** It's specified in `.agent/plans.md` § Architecture Overview.
- **Do NOT modify existing skills** (`creating-skills`, `tdd-mutation`, `systematic-debugging`, `verification-before-completion`). They are referenced, not duplicated.
- **Do NOT skip validation.** Every task that writes a `SKILL.md` must run `python skills/creating-skills/scripts/quick_validate.py skills/<name>` and report the output.

## Reference materials

- `pipeline-design.html` (repo root) — v3 visual design. Useful reference for Milestone 2.6 (dashboard template) but not load-bearing; everything needed is in `.agent/plans.md` § Dashboard.
- `/tmp/thariq-html/` — Birchline source files. If cleared: `gh repo clone ThariqS/html-effectiveness /tmp/thariq-html`. Used in Milestone 2.6 + 3.1.
- `/home/vadim/Code/ralph-to-ralph/ralph/qa/{base,api,security,a11y,footer}.md` — source for Milestone 5.3 (QA modules adaptation).
- Mat Pocock's `grill-with-docs/SKILL.md` — source for Milestone 5.5: `gh api repos/mattpocock/skills/contents/skills/engineering/grill-with-docs/SKILL.md --jq .content | base64 -d`

## Where to start

**Milestone 1** is parallel-friendly across 9 skill init tasks. Dispatch up to 5 worktrees with the first 5 inits; queue the rest. Run task 1.10 sequentially after 1.1-1.9.

After Milestone 1: Milestones 2 → 3 → 4 → 5 → 6 are mostly sequential per the `Depends on` field. Within each milestone, parallel tasks are flagged.

## Completion criteria

When Milestone 6 finishes, all 9 skills validate clean and the smoke test (6.4) passes. Report the final status to the user with: final commit SHA, list of skills built, validation summary, any deferred items.

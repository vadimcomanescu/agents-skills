# Subagent Workflow

You are implementing one task from `.agent/plans.md`. Follow this workflow exactly.

## Before you start

1. Read `.agent/goal.md` — understand what we're building overall
2. Read `.agent/plans.md` — find your task's milestone; understand the architecture and decisions log
3. Read `.agent/standards.md` — the quality bar
4. Read your specific task description from the milestone tasks list in `plans.md`
5. **Read the existing skills your task references before editing.** Examples:
   - If your task writes `arianna-implement/SKILL.md`, first read `skills/tdd-mutation/SKILL.md`
   - If your task writes `arianna-review/SKILL.md`, first read `skills/systematic-debugging/SKILL.md` and `skills/verification-before-completion/SKILL.md`
   - If your task writes `arianna-grill/SKILL.md`, fetch Pocock's `grill-with-docs/SKILL.md` via `gh api repos/mattpocock/skills/contents/skills/engineering/grill-with-docs/SKILL.md --jq .content | base64 -d`
   - If your task writes anything visual, reference Birchline tokens in `.agent/plans.md` § Dashboard
6. If anything is unclear after reading, state your assumptions explicitly in the report — do not guess silently

## Implementation workflow

1. **Design.** Think through the file structure before writing. Identify what sections it needs per the standards section in `plans.md`.
2. **Write.** Stay within file count and LOC budget. ≤500 lines per `SKILL.md` body.
3. **Validate.** Run `python skills/creating-skills/scripts/quick_validate.py skills/<your-target>` if you wrote a `SKILL.md`. Must pass.
4. **Self-review.** Read your own diff. Would you approve this in code review? Are sections in the right order per standards? Is every term defined with an `_Avoid_:` line?
5. **Cross-reference check.** If your file references another skill (e.g., `tdd-mutation`), grep to confirm the name matches exactly: `ls skills/ | grep tdd-mutation`.
6. **Commit.** One commit per logical change. Message explains WHY.

## Rules

- **No scope creep.** Build exactly what the task specifies. Nothing more. If you discover related work, add to a backlog note in your report — don't do it now.
- **No new dependencies.** No `pip install`, no `npm install`, no extra packages. Python stdlib + Bash only.
- **No shortcuts.** No `// TODO`, no skipped tests, no `any` types, no "fix later".
- **Stay in your scope.** Do not modify files outside your task's stated scope (the milestone tasks list specifies which files).
- **Ask rather than assume — silently.** If a requirement is genuinely ambiguous and you can't resolve it by re-reading `plans.md`, state your assumption explicitly in the report. Do not block.
- **Use Pocock style.** Bold one-line rule, gloss, falsifiable test. No academic jargon.

## Anti-cheat

- **Never weaken or delete tests** in any existing file to make something pass. The test ratchet from Osmani applies: *"it is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."*
- **Never claim "done" without validation passing.** Run `quick_validate.py` and quote its output in your report.
- **Never invent file paths, command outputs, or skill names.** If you reference `skills/tdd-mutation`, verify it exists first.

## Report format (return as structured JSON)

```json
{
  "task_id": "1.3",
  "status": "done" | "blocked" | "needs_human",
  "files_changed": [
    "skills/arianna-spec/SKILL.md"
  ],
  "validation": {
    "quick_validate": "pass",
    "command": "python skills/creating-skills/scripts/quick_validate.py skills/arianna-spec",
    "output_excerpt": "..."
  },
  "cross_references": {
    "claims": ["references tdd-mutation skill"],
    "verified": ["skills/tdd-mutation/SKILL.md exists"]
  },
  "assumptions": [
    "Assumed the goal.md template should match jarrodwatts' project-templates.md exactly — Vadim said 'follow jarrodwatts' as backbone"
  ],
  "concerns": [
    "The 500-line limit was tight for arianna-review; moved 3 sub-sections to references/"
  ],
  "next_eligible_tasks": ["1.4", "1.5"]
}
```

## Boundary: do not invoke arianna-magic itself

You are implementing arianna-magic. Do not test it by triggering `/arianna-magic` on a real project — that's the smoke test at Milestone 6.4, and only the orchestrator performs it. Your job is to produce the files; the smoke test verifies they work.

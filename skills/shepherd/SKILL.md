---
name: shepherd
description: Use when asked to build an entire project end-to-end, manage multi-milestone autonomous development, "build this project", "implement this end-to-end", or orchestrate long-running development that spans hours or days without human intervention
---

# Shepherd Orchestrator

You are an autonomous orchestrator managing end-to-end project delivery. You dispatch parallel subagents in git worktrees, enforce brutal architectural review cycles at milestones, and maintain persistent state files as your working memory.

**Core principles:**
- State files in `.shepherd/` are your working memory — re-read before every decision
- You run continuously for hours or days without human intervention
- You CAN research, explore, code, and run commands directly — but delegate the majority of implementation work to subagents for parallelization
- Quick fixes, config tweaks, and trivial changes: just do them yourself
- Multi-file features, complex logic, independent tasks: delegate to subagents

**Platform mechanics:**
- **Claude Code:** Use the Agent tool with `isolation: "worktree"` for subagents
- **Codex:** Use subagent teams spawning with workspace isolation using git worktrees
- **Other agents:** Any runtime that can read `.shepherd/` markdown files and spawn isolated workers

## Phase 1: Project Setup

User interaction happens HERE — get everything upfront, then go autonomous.

### Step 1: Intent

Invoke `interview-me`. Write its Confirmed Intent verbatim into `.shepherd/spec.md` as the `## Confirmed Intent` section (matches the `spec` skill's locked-input protocol).

### Step 2: Explore and Standards

1. Assess the codebase (or define conventions for greenfield)
2. Write `.shepherd/exploration.md` — tech stack, key directories, conventions, integration points, constraints (brownfield only)
3. Write `.shepherd/standards.md` — tailored to this project's tech stack and patterns

Read `references/project-templates.md` for initial structures, then customize.

### Step 3: Plan

Convert intent + exploration into an executable plan.

1. Invoke the `spec` skill. It reads its `## Confirmed Intent` from `.shepherd/spec.md` (written by Step 1) and `.shepherd/exploration.md` for tech-stack details. Elaborates the remaining spec sections (Tech Stack, Commands, Project Structure, Code Style, Testing Strategy, Boundaries, Success Criteria, Open Questions) into the same file.
2. Invoke the `plan` skill. Direct it to read `.shepherd/spec.md` and write the implementation plan to `.shepherd/plans.md` (vertical slices, milestones, parallel/sequential flags per task).
3. Present `.shepherd/plans.md` to the user for final sign-off.

**This is the last user interaction.** After approval, you execute autonomously.

### Step 4: Initialize Progress

1. Create `.shepherd/progress.md` with initial state
2. Log setup completion, record architecture decisions made during planning
3. Begin autonomous execution

## Phase 2: Orchestration Loop

```dot
digraph orchestration {
    rankdir=TB;

    "Read progress.md + plans.md" [shape=box];
    "Identify current milestone" [shape=box];
    "Categorize tasks: parallel vs sequential" [shape=box];
    "Dispatch implementer subagents (worktrees)" [shape=box];
    "Collect results, verify (tests/lint/types)" [shape=box];
    "Merge to main" [shape=box];
    "Dispatch architectural reviewer" [shape=box];
    "Review passes?" [shape=diamond];
    "Dispatch fix subagents" [shape=box];
    "Iteration < 3?" [shape=diamond];
    "Best-judgment call, log decision, proceed" [shape=box];
    "Update progress.md" [shape=box];
    "More milestones?" [shape=diamond];
    "Phase 3: Completion" [shape=box style=filled fillcolor=lightgreen];

    "Read progress.md + plans.md" -> "Identify current milestone";
    "Identify current milestone" -> "Categorize tasks: parallel vs sequential";
    "Categorize tasks: parallel vs sequential" -> "Dispatch implementer subagents (worktrees)";
    "Dispatch implementer subagents (worktrees)" -> "Collect results, verify (tests/lint/types)";
    "Collect results, verify (tests/lint/types)" -> "Merge to main";
    "Merge to main" -> "Dispatch architectural reviewer";
    "Dispatch architectural reviewer" -> "Review passes?";
    "Review passes?" -> "Update progress.md" [label="yes"];
    "Review passes?" -> "Dispatch fix subagents" [label="no"];
    "Dispatch fix subagents" -> "Iteration < 3?";
    "Iteration < 3?" -> "Dispatch architectural reviewer" [label="yes"];
    "Iteration < 3?" -> "Best-judgment call, log decision, proceed" [label="no"];
    "Best-judgment call, log decision, proceed" -> "Update progress.md";
    "Update progress.md" -> "More milestones?";
    "More milestones?" -> "Read progress.md + plans.md" [label="yes"];
    "More milestones?" -> "Phase 3: Completion" [label="no"];
}
```

### Per-Milestone Execution

1. **Re-read state:** Read `progress.md` and `plans.md` before every milestone
2. **Identify tasks:** Extract current milestone's tasks, categorize as parallel/sequential
3. **Dispatch implementers:** One subagent per parallel task, each in its own git worktree. Max 5 parallel subagents to limit merge conflicts
4. **Verify results:** After each subagent completes, run tests, linter, type checker in the worktree
5. **Merge:** Merge completed worktrees to main branch. Handle conflicts immediately
6. **Architectural review:** Dispatch reviewer subagent on the merged milestone code
7. **Fix cycle:** Route review feedback to fix subagents (parallel, in worktrees). Re-review until approved or 3 iterations reached
8. **Update state:** Write milestone summary, decisions, and architecture state to `progress.md`

### Sequential Tasks Within a Milestone

Some tasks depend on others. Execute these in order:
1. Complete prerequisite task and merge
2. Create new worktree from updated main for dependent task
3. Dispatch dependent task's subagent

## Subagent Dispatch Patterns

### Implementer Dispatch

1. Read `prompts/implementer-prompt.md` from the skill directory.
2. Substitute: `{TASK_NAME}`, `{TASK_DESCRIPTION}`, `{ARCH_CONTEXT}`, `{WORKTREE_PATH}`.
3. Dispatch with `isolation: "worktree"`:
   - **Claude Code:** `Agent` tool, `subagent_type: "general-purpose"`
   - **Codex:** `spawn_agent` with worktree isolation
   - **Kimi / OpenCode:** native subagent

### Architectural Reviewer Dispatch

1. Read `prompts/reviewer-prompt.md` from the skill directory.
2. Substitute: `{MILESTONE_NAME}`, `{TASKS_COMPLETED}`, `{BASE_SHA}`.
3. Dispatch:
   - **Claude Code:** `Agent` tool, `subagent_type: "superpowers:code-reviewer"` or `"general-purpose"`
   - **Codex:** `spawn_agent`
   - **Kimi / OpenCode:** native subagent

### Fix Dispatch

1. Read `prompts/fixer-prompt.md` from the skill directory.
2. Substitute: `{ISSUE_DESCRIPTION}`, `{WORKTREE_PATH}`.
3. Dispatch with `isolation: "worktree"`:
   - **Claude Code:** `Agent` tool, `subagent_type: "general-purpose"`
   - **Codex:** `spawn_agent` with worktree isolation
   - **Kimi / OpenCode:** native subagent

## Phase 3: Project Completion

1. **Final cross-cutting review:** Dispatch reviewer on entire codebase (`git diff` from initial commit to HEAD)
2. **Address critical issues** from final review (same fix cycle, max 3 iterations)
3. **Update progress.md** with final status, architecture summary, known limitations
4. **Report to user:** Summary of what was built, milestone-by-milestone, any deferred items

## Autonomous Decision-Making

You do NOT ask the user questions during execution. Resolve everything yourself.

| Situation | Resolution |
|-----------|-----------|
| **Technical ambiguity** | Research codebase, read docs, check existing patterns. Decide. Log rationale in progress.md |
| **Design tradeoffs** | Pick the pragmatic option that fits existing architecture. Log rationale |
| **Review not converging (3+ iterations)** | Make best-judgment call on remaining issues. Document what was deferred and why. Proceed |
| **Subagent failure** | Retry with more context. If still failing, try different approach. If catastrophic, log state and report to user |
| **Scope discovery** | Add new task to plans.md under current milestone. Proceed |
| **Merge conflicts** | Resolve them. You're a senior engineer, not a junior who escalates conflicts |
| **Test failures in existing code** | Distinguish pre-existing from introduced. Fix what you broke. Log pre-existing as known issues |

**The ONLY time you stop for user input:** Truly catastrophic failure with no autonomous resolution path (e.g., entire build system broken with no clear fix, credentials/access required that you don't have).

## State Management Rules

### Re-read Before Every Decision

Before every milestone start, task dispatch, merge, or review cycle: read `progress.md`. This is the Manus pattern — your attention window drifts, the file doesn't.

### Update After Every Action

After every completed action (task merged, review done, fix applied): update `progress.md`. Include:
- What happened
- Decisions made and rationale
- Current architecture state

### Architecture State Summary

At the end of each milestone, write an architecture summary in `progress.md`:
- What components exist now
- How they connect
- Key patterns established
- Tech debt or known limitations

This enables recovery if the session is interrupted or context is compacted.

### Decision Log

Every non-trivial decision gets logged:
```
### Decision: [topic]
- Options considered: [A, B, C]
- Chose: [B]
- Rationale: [why]
- Trade-offs accepted: [what you gave up]
```

This prevents re-litigating decisions after context compaction.

## Red Flags

**Never:**
- Skip architectural reviews after milestones
- Merge code with failing tests
- Let progress.md go stale (update after EVERY action)
- Dispatch more than 5 parallel subagents (merge conflict hell)
- Over-delegate trivial work (config tweaks, single-line fixes — just do them)
- Under-delegate complex work (multi-file features MUST be subagents)
- Ignore test failures hoping they'll resolve themselves
- Skip the fix-review cycle (reviewer found issues = fix = re-review)
- Make decisions without logging rationale

**Always:**
- Re-read progress.md before every major decision
- Verify tests/lint/types before merging any worktree
- Log architecture state at milestone boundaries
- Handle merge conflicts immediately (don't let them accumulate)
- Treat subagent reports with verification, not blind trust

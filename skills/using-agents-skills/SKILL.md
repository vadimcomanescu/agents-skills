---
name: using-agents-skills
description: Discovers and dispatches to the right skill in the agents-skills pack. Use when starting a session and uncertain which skill applies, when a task could fit multiple skills in the pack and you need to pick one, or when you need a navigation map of what's installed from agents-skills. Invoke directly with `/using-agents-skills` when in doubt.
---

# Using Agents Skills

## Why this matters

The `agents-skills` pack ships 12+ skills, each scoped to a specific task shape. Picking the wrong one — or invoking none when one would help — wastes work or produces unstructured output. This map turns *"what kind of task do I have?"* into *"which skill in the pack solves it."* Read it once at the start of a session; re-consult when a task could fit multiple skills.

## Dispatch

Decide top to bottom; the first match wins.

```
Task arrives

├── Build a whole project end-to-end? ─────────────→ shepherd
│
├── Don't know what you want yet? ────────────────→ interview-me
├── Have intent, need a spec? ────────────────────→ spec
├── Have a spec, need ordered tasks? ─────────────→ plan
├── Setting up context for a new session? ────────→ context-engineering
│
├── Implementing — pick in flight:
│   ├── Writing code with tests proven to catch bugs? → tdd-mutation
│   ├── About to claim "done"? ────────────────────→ verification-before-completion
│   ├── Code broken, test failing? ────────────────→ systematic-debugging
│   └── About to commit to a plan? Stress-test it ─→ grill-with-docs
│
├── Auditing or refactoring agent docs (AGENTS.md)? → agents-md
├── Authoring or editing a skill itself? ─────────→ creating-skills
│
└── Steering has failed, user typed /slap? ───────→ slap
```

## Sequences worth knowing

Most non-trivial work isn't a single skill — it composes. Two sequences come up often enough to name:

**Front-of-pipeline (pre-build):** `interview-me → spec → plan`. Each gate hands off to the next; the Confirmed Intent block from `interview-me` becomes the locked first section of the spec file, and that spec file becomes the planner's input. Shepherd's Phase 1 chains these three internally when you invoke `shepherd` — invoke them individually when you want the artifacts without the autonomous multi-milestone build that follows.

**Authoring a new skill:** `creating-skills`. It embeds its own iterate-and-eval loop; run its `scripts/quick_validate.py` before declaring done.

## Quick reference

When the dispatch tree's question doesn't fit cleanly, the one-line summaries here disambiguate.

| Cluster | Skill | One-line |
|---|---|---|
| Build pipeline | shepherd | End-to-end autonomous multi-milestone build with worktree dispatch |
| Build pipeline | interview-me | Extract the user's actual want via one-question-at-a-time, ~95%-confidence stop |
| Build pipeline | spec | Six-area spec (Confirmed Intent + Commands + Project Structure + Code Style + Testing + Boundaries) |
| Build pipeline | plan | Dependency graph, vertical slicing, XS–XL task sizing, checkpoints |
| Build pipeline | context-engineering | 5-level context hierarchy, rules files, project map setup |
| In-flight discipline | tdd-mutation | TDD + mutation testing to prove the tests actually catch bugs |
| In-flight discipline | verification-before-completion | Run verification commands before claiming "done" |
| In-flight discipline | systematic-debugging | Reproduce → localize → reduce → fix → guard |
| In-flight discipline | grill-with-docs | Stress-test a plan against existing domain language |
| Meta | agents-md | Audit / refactor AGENTS.md for agent-readiness |
| Meta | creating-skills | Author, edit, evaluate, and optimize agent skills |
| User control | slap | User-invoked correction protocol when steering has failed |

## Anti-patterns

These are the moves that look like work but aren't.

- **Guessing instead of consulting** — if you're uncertain which skill applies, type `/using-agents-skills`. One read here is cheaper than half-running the wrong skill.
- **Loading skill bodies speculatively** — descriptions are in context; bodies load on activation. Don't pre-read multiple skill bodies to compare; pick from the table, then load.
- **Treating this as the operator's manual** — discipline lives in each individual skill (Red Flags, Rationalizations, Verification sections). This file routes; it doesn't teach.

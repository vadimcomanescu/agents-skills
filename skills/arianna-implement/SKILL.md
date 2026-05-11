---
name: arianna-implement
description: Autonomous worker for Phase 5 of the arianna-magic pipeline. Use when arianna-magic dispatches a single task to a worker subagent, or the user asks to "implement one task from tasks.json", "build feature X with TDD", "run the worker on task NN". One task per invocation (HARD STOP), TDD per the tdd-mutation skill, captures evidence/, writes qa-hints.json. Do not use for multi-task batch builds — the coordinator dispatches workers one at a time.
---

# arianna-implement

Autonomous worker — body populated in Milestone 5.

---
name: arianna-review
description: Two-stage code reviewer (judge) for Phase 6 of the arianna-magic pipeline. Use when arianna-magic dispatches a judge subagent on a completed task, or the user asks to "review this task", "audit the diff against the spec", "judge whether the worker's code passes". Stage 1 spec-compliance, Stage 2 code-quality; verbatim test ratchet; append-only review log; loads QA modules by task category. References systematic-debugging and verification-before-completion. Do not use for high-level architecture review.
---

# arianna-review

Two-stage reviewer (judge) — body populated in Milestone 5.

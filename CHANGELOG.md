# Changelog

## 0.5.0 — 2026-05-01

- **Delete `skills/example-skill/`** — initial scaffold, dead weight after real skills exist. Removed from `meta` plugin's marketplace entry.
- **Add "No shadow canon, no legacy weight" rule to `AGENTS.md`** — local instance of Vadim's global *No shadow canon* rule. Explicit forbidden patterns: dead skills, dangling cross-refs, deprecated marketplace entries, legacy aliases, negative compatibility tests.
- **Add `engineering` plugin entry to `AGENTS.md`** Themes section.
- **Three additional TDD pressure scenarios** run via the writing-skills subagent methodology:
  - Scenario 4 ("pure refactor" rationalization): with-skill agent picked A (run tests before/after refactor) citing When-to-use, REFACTOR step, Tidy First, Red flags.
  - Scenario 5 (spike → production rationalization): with-skill picked A (delete spike, write fresh from RED) citing Iron Law, Three Laws, "Keep this code as a reference" rationalization.
  - Scenario 6 (manual verification rationalization): with-skill picked A (Prove-It Pattern: failing test reproduces bug before fix) citing bug-fix-pattern.md, "I already manually tested it" rationalization.
- **Cumulative pressure-test result:** 6/6 with-skill compliance across 6 scenarios. 1 new rationalization surfaced and plugged (`"TDD theater"`, in 0.4.1). No new rationalizations from scenarios 4-6 — existing table caught all of them.
- **Mechanical writing-skills checklist applied to TDD.** 23 of 23 rules pass. One documented exception: TDD ships 4 language examples (TS / Python / Rust / Go) where writing-skills recommends one — Vadim explicitly chose multi-language; documented in ADR 0001.

## 0.4.1 — 2026-05-01 (rolled into 0.5.0)

- Pressure-test the TDD skill via writing-skills' subagent methodology, 3 scenarios. `"TDD theater"` rationalization plugged.

## 0.4.0 — 2026-05-01

- **Replace** the previous `writing-skills` (single-file collapse — see ADR 0002) **with obra/superpowers' `writing-skills` directory verbatim**: SKILL.md + anthropic-best-practices.md + persuasion-principles.md + testing-skills-with-subagents.md + graphviz-conventions.dot + render-graphs.js + examples/CLAUDE_MD_TESTING.md. MIT-to-MIT.
- **Surgical edits to writing-skills:**
  - Cross-references ported from `superpowers:` to `engineering:` namespace (5 occurrences).
  - `anthropic-best-practices.md` refreshed from the live URL (2026-05-01 snapshot).
  - CSO description rule reconciled with `agentskills.io/specification` + Anthropic + Pocock: capability sentence + trigger sentence (never workflow). obra's "no workflow leak" warning preserved with the documented testing case as rationale.
  - Codex compatibility section added (~12 lines): `.agents/skills/` path, description portability ceiling, "Do not use for…" trigger boundary, optional `agents/openai.yaml`.
  - Frontmatter description self-applied to the new rule.
- **Import obra's `systematic-debugging` skill** into the `engineering` plugin — 12 files copied ad literam, cross-references ported. ADR 0003.
- **Import obra's `verification-before-completion` skill** into the `engineering` plugin (single-file SKILL.md, no cross-refs) — resolves the cross-reference from `systematic-debugging`. Same import policy as 0003.
- **Namespace convention adopted:** `<plugin>:<skill>` for all cross-skill references. ADR 0004.
- **`docs/adr/`** added with 4 ADRs (TDD backbone, writing-skills port, systematic-debugging import, namespace convention) plus an index README.
- `engineering` plugin bumped to 0.2.0 (now lists `systematic-debugging` alongside `test-driven-development`).

## 0.3.0 — 2026-05-01 (superseded by 0.4.0 for writing-skills)

- Initial `writing-skills` skill — single 481-line SKILL.md collapsing obra's 4-file structure. Replaced in 0.4.0; see ADR 0002 for why.
- Apply `writing-skills` to the TDD skill: rewrote frontmatter description (cut workflow leak + false CRAP-gate claim), demoted CRAP from a separate 110-line reference to a 20-line "legacy code triage" section inside `mutation-testing.md`, added Tables of Contents to all references > 100 lines (anti-patterns, mutation-testing, bug-fix-pattern, test-design, mocking-and-fakes, tidy-first, testability-via-design).

## 0.2.0 — 2026-05-01

- Add `engineering` themed plugin.
- Add `test-driven-development` skill: purist TDD backbone (Iron Law, watch-it-fail, vertical slicing, Tidy First) with mutation-testing and CRAP-score quality gates. References across 13 docs; examples for TypeScript (Vitest), Python (pytest + uv), Rust (cargo + cargo-mutants), and Go (testing + go-mutesting). Backbone draws from obra/superpowers; vertical-slicing from mattpocock/skills; theory from addyosmani/agent-skills.

## 0.1.0 — 2026-05-01

- Initial scaffolding.
- One themed plugin: `meta`.
- One example skill: `example-skill`.

# Changelog

## 0.7.0 — 2026-05-01

- **Add `README.md`** — public-facing front page. Quickstart per runtime, agent-driven install procedure ("For agents" section), methodology grounded in named engineering practices, and acknowledgments. Replaces the prior absence: the repo had `AGENTS.md` (agent canon) but no human-facing README. All quotes verified against primary sources; one fabricated Beck quote was caught and replaced with a verified Kernighan citation, and "trust, but verify" was re-attributed to the Russian proverb (popularized in English by Reagan at the INF Treaty signing, 1987) rather than to Reagan alone.
- **Add `scripts/check-consistency.sh`** — cross-file consistency lint with 7 checks. Each guards a class of drift observed in this repo:
  - **A:** `npx skills add` invocations in markdown require `-a`, forbid `--all` (the global CLAUDE.md "no dead agent dirs" rule).
  - **B:** Claude marketplace catalog plugin versions match `plugins/<theme>/.claude-plugin/plugin.json` versions.
  - **C:** Codex marketplace plugin paths exist and plugin names match the manifest.
  - **D:** Every `skills/<name>/` on disk is registered in some plugin's `skills[]`.
  - **E:** Every entry in `skills[]` points at an existing `SKILL.md`.
  - **F:** Every skill on disk is mentioned in `README.md`.
  - **G:** Markdown link targets in `README.md` and `AGENTS.md` resolve to existing files.
- **CI: new `consistency` job** in `.github/workflows/validate.yml` runs `check-consistency.sh` on every PR. Same script runs locally pre-push.
- **Delete `scripts/install.sh`** — duplicated what `npx skills add` and the native `/plugin marketplace add` commands already do; modern marketplaces (obra, addyosmani, mattpocock) ship no shell installers. Drift was already observed within one session: the README claimed the script "detected runtimes" while it unconditionally `mkdir -p`'d all four config dirs. Dead alternative install path, exactly the *No shadow canon* failure mode. Removed instead of patched.
- **`AGENTS.md` updates** to match the new enforcement and removed installer:
  - Layout: `scripts/install.sh` line replaced with `scripts/check-consistency.sh`.
  - Install: dropped the plain-clone shell-installer line; added explicit note that `-a` is mandatory on `npx skills add` and CI rejects PRs without it.
  - Adding a new skill: step 3 now correctly states the Codex catalog discovers skills by scanning the plugin source dir (no separate `skills[]` registration); step 4 requires bumping the version in three places (Claude plugin manifest, Codex plugin manifest, and the matching catalog entry); step 6 directs contributors to run the lint locally.
- **Methodology: enforcement before fix.** Local instance of the global rule. Each drift was caught by a class-level lint before fixing the specific instance: README's missing `-a` flags (Class A, 2 hits), AGENTS.md's wrong "register in both" instruction (downstream of Class B+E once registration is single-sourced), `install.sh` doc-vs-reality drift (the whole file deleted instead of patched).

## 0.6.0 — 2026-05-01

- **`systematic-debugging` Phase 1 expanded with 4 surgical edits sourced from addyosmani/agent-skills' `debugging-and-error-recovery` skill.** All edits inline in `SKILL.md`; no new reference files; 4-phase Iron-Law structure preserved. ~14 lines added on a 296-line skill.
  - **Step 1 (Read Error Messages):** rewritten as "Capture First, Then Analyze". Adds (a) preserve evidence before re-running rule, (b) "errors are clues, not testimony" framing — replaces the misleading current line *"errors often contain the exact solution"* with skeptical reading guidance addressing downstream artifacts, generic wrappers, and adversarial input.
  - **Step 3 (Check Recent Changes):** appended `git bisect` guidance for wide regression ranges (>30 commits or unknown). Concrete `bisect run` invocation.
  - **Step 4 (Gather Evidence):** appended instrumentation lifecycle paragraph (temporary / permanent / unsafe; default temporary; never commit unmarked debug output).
- **Pressure-test methodology applied per writing-skills (RED-GREEN-REFACTOR on edits).** 4 new pressure scenarios shipped as test fixtures (`test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`). Baselines run across opus / sonnet / haiku (12 invocations); GREEN verification with edited skill on haiku × 4 scenarios + opus academic regression. **Findings:** haiku failed bisection scenario at baseline (picked manual diff-reading), passed with edit loaded — only confirmed RED→GREEN transition. The other 3 scenarios saw no baseline failure across all model strengths, but verification agents reported the skill text *changed or reinforced* their answer ("would have picked B/C without it"). All 4 edits earned their place; documented in ADR 0005.
- **Namespace bug fixes** in systematic-debugging fixtures: stale `skills/debugging/systematic-debugging` references in `test-pressure-1/2/3.md` and `test-academic.md` ported to `engineering:systematic-debugging` per ADR 0004. `CREATION-LOG.md` annotated with historical-record note acknowledging obra-internal namespace references in body text.
- **Marketplace catalog drift fixed.** `.claude-plugin/marketplace.json` engineering description was missing "systematic debugging" and version was 0.1.0 vs plugin manifest 0.2.0 (caught by hand before `scripts/check-consistency.sh` was wired). Synced to 0.3.0 alongside this release.
- **`engineering` plugin bumped to 0.3.0** in all three places (Claude plugin manifest, Codex plugin manifest, Claude marketplace catalog).

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

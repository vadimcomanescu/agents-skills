# Changelog

All notable changes to this marketplace are documented here. Format follows [Common Changelog](https://common-changelog.org/) and [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). Rationale for non-trivial decisions lives in [`docs/adr/`](docs/adr/), not here.

## 0.8.1 — 2026-05-02

### Changed

- `meta:writing-skills` frontmatter `description` reverted to obra's verbatim. Empirical A/B test across opus / sonnet / haiku × 11 prompts: 33/33 trials matched, zero observed triggering benefit from the longer self-applied form. CSO body rule (capability + triggers) retained for general guidance. See ADR 0002 *Subsequent revisions*.
- `meta` plugin → 0.2.1 (Claude manifest, Codex manifest, Claude catalog).

## 0.8.0 — 2026-05-02

### Added

- `AGENTS.md`: "Contract for delivering work" section.
- `scripts/check-consistency.sh` checks H, I, J, K, L, M.

### Changed

- All `CHANGELOG.md` entries (0.1.0–0.8.0) rewritten in Common Changelog style.
- `scripts/check-consistency.sh` "Why" comments rewritten to abstract enforcement rationale (no specific deleted-skill names, no release-history episodes).

### Fixed

- `.claude-plugin/marketplace.json` `metadata.version`: 0.1.0 → 0.7.0.
- `docs/adr/0004-namespace-and-cross-skill-refs.md`: `meta:example-skill` mapping replaced with `engineering:verification-before-completion`.
- `AGENTS.md` install block: added `engineering@agents-skills` install commands for Claude Code and Codex.
- `AGENTS.md` `npx skills` invocation aligned with `README.md` (`npx skills@latest add`).

## 0.7.0 — 2026-05-01

### Added

- `README.md` (public-facing front page).
- `scripts/check-consistency.sh` with checks A–G.
- `.github/workflows/validate.yml` consistency CI job.

### Removed

- `scripts/install.sh` (duplicated runtime-native install commands; unconditionally `mkdir -p`'d every config dir regardless of which runtimes the user had).

### Changed

- `AGENTS.md`: layout, install commands, and "Adding a new skill" reflowed to match the new lint and removed installer.

## 0.6.0 — 2026-05-01

### Added

- ADR 0005: surgical Phase 1 additions to `engineering:systematic-debugging` from `addyosmani/agent-skills`.
- 4 pressure-test fixtures for systematic-debugging (`test-evidence-preservation.md`, `test-error-as-data.md`, `test-bisection.md`, `test-instrumentation-lifecycle.md`).

### Changed

- `engineering:systematic-debugging` Phase 1 expanded with 4 surgical edits. See ADR 0005.
- `engineering` plugin → 0.3.0 (Claude manifest, Codex manifest, Claude catalog).

### Fixed

- Stale `skills/debugging/systematic-debugging` namespace references in fixtures ported to `engineering:systematic-debugging`.
- `.claude-plugin/marketplace.json` `engineering` description and version drift.

## 0.5.0 — 2026-05-01

### Added

- "No shadow canon, no legacy weight" rule in `AGENTS.md`.
- `engineering` plugin entry in the `AGENTS.md` Themes section.

### Removed

- `skills/example-skill/` (initial scaffold; dead weight after real skills landed). Removed from the `meta` plugin's catalog entry.

### Changed

- `engineering:test-driven-development` pressure-tested via writing-skills' subagent methodology, scenarios 4–6. Cumulative result 6/6 with-skill compliance. 23/23 mechanical writing-skills checklist pass on TDD. See ADR 0001.

## 0.4.1 — 2026-05-01 (rolled into 0.5.0)

### Changed

- `engineering:test-driven-development` pressure-tested, scenarios 1–3. "TDD theater" rationalization plugged.

## 0.4.0 — 2026-05-01

### Added

- `engineering:systematic-debugging` skill (vendored from `obra/superpowers`). See [ADR 0003](docs/adr/0003-systematic-debugging-imported.md).
- `engineering:verification-before-completion` skill (vendored from `obra/superpowers`). See ADR 0003.
- Namespace convention `<plugin>:<skill>` for cross-skill references. See [ADR 0004](docs/adr/0004-namespace-and-cross-skill-refs.md).
- `docs/adr/` with ADRs 0001–0004 and an index.

### Changed

- `meta:writing-skills` replaced with `obra/superpowers`' directory verbatim plus surgical edits. See [ADR 0002](docs/adr/0002-writing-skills-from-obra.md).
- `engineering` plugin → 0.2.0.

## 0.3.0 — 2026-05-01 (superseded by 0.4.0 for writing-skills)

### Added

- `meta:writing-skills` skill (single-file form, 481 lines). Replaced in 0.4.0; see [ADR 0002](docs/adr/0002-writing-skills-from-obra.md).

### Changed

- `engineering:test-driven-development`: frontmatter rewritten, CRAP-score reference demoted to a section in `mutation-testing.md`, ToCs added to references > 100 lines.

## 0.2.0 — 2026-05-01

### Added

- `engineering` themed plugin.
- `engineering:test-driven-development` skill with examples for TypeScript (Vitest), Python (pytest + uv), Rust (cargo + cargo-mutants), and Go (testing + go-mutesting). See [ADR 0001](docs/adr/0001-tdd-skill-backbone.md) for the backbone choice and inspirations.

## 0.1.0 — 2026-05-01

### Added

- Initial scaffolding.
- `meta` plugin with placeholder `example-skill`.

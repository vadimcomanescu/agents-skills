# ADR 0001: TDD skill — backbone choice and stress-test fixes

## Status

Accepted (2026-05-01).

## Context

We needed a world-class Test-Driven Development skill for `agents-skills`, the agent-skill marketplace this repo ships. Three open-source TDD skills were candidates as the canonical backbone:

- **obra/superpowers** — purist, Iron-Law framing, mandatory watch-it-fail, comprehensive anti-patterns.
- **addyosmani/agent-skills** — pragmatic, theory-rich (test pyramid, Google sizes, DAMP, AAA), Prove-It bug-fix pattern.
- **mattpocock/skills** — vertical-slicing tracer-bullet emphasis, planning phase, "honest tests through forced constraints" framing.

Constraints:
- The skill must resist LLM-specific failure modes (rationalizing TDD away under pressure, horizontal-slicing tests).
- It must accommodate Vadim's stated interests in mutation testing and CRAP (originally pitched together).
- It must align with `~/.claude/CLAUDE.md`'s `MUST` / `SHOULD` / `MAY` style.

## Decision

**Use obra/superpowers as the backbone.** Layer in:

- **Vertical-slicing rule from Pocock** — names the LLM-specific "horizontal slicing" anti-pattern (write all tests, then all impl).
- **Theory from Osmani** — test pyramid, Google sizes, DAMP, AAA, Prove-It bug-fix pattern, state-vs-interaction.
- **Uncle Bob's Three Laws verbatim** — canonical foundation for the Iron Law.
- **Kent Beck's Tidy First** — separates structural and behavioral changes; sharpens REFACTOR.
- **Mutation testing as the closing-loop quality gate** — Stryker / mutmut / cargo-mutants / gremlins. 80% kill-rate floor, 100% on critical paths. Block new survivors per PR.

The skill ships as `skills/test-driven-development/` with `SKILL.md` + 12 reference files + 4 language examples (TypeScript Vitest, Python pytest, Rust cargo, Go testing+gremlins).

After the initial draft we **stress-tested all four examples end-to-end** in real sandboxes. Findings:

- TypeScript / Stryker: 22/22 mutants killed (100%) after applying the skill's predicted boundary tests.
- Python / mutmut: 17/17 (100%). Found two example bugs: `mutmut --paths-to-mutate` was dropped in mutmut 3.x (now `[tool.mutmut]` in `pyproject.toml`), and `pytest.raises(match=...)` is regex (so `"0..100"` dots match any chars and let string mutants survive). Fixed both in the example.
- Rust / cargo-mutants: 13/13 (100%).
- Go: **`go-mutesting` is broken on Go 1.22+** — its 2019 `golang.org/x/tools` dep crashes. Switched the example and references to `gremlins` (10/10 mutants killed). Documented the heads-up.

## Consequences

**Positive:**
- The skill's predictions match real tool behavior across four languages.
- The Iron Law + watch-it-fail gate addresses the documented LLM failure mode (rationalizing TDD away).
- Mutation-testing predictions in the skill (boundary `<` ↔ `<=`, weak assertions) match what the tools actually flag.

**Negative / accepted trade-offs:**
- ~2000 lines of total content (SKILL.md + references + examples). Justified by the depth of the topic; mitigated by progressive disclosure (one-level-deep references with ToCs).
- Four language examples increase maintenance surface. Justified by Vadim's "all of them" answer when asked which to ship.

**Stress-test finding worth preserving:** when in doubt, dogfood. Static validation (jq, frontmatter, cross-refs) caught zero of the four real bugs that running the example commands surfaced.

## Subsequent revisions

- **CRAP demoted** — see context in ADR 0002's lineage; the CRAP reference was over-engineered (mutation testing already gives per-method risk-ranking with better diagnostics on tested code). CRAP earns its place only for *legacy code triage* with no test suite, so it's now a 20-line section inside `references/mutation-testing.md` titled *"When you inherited untested code"*. The 110-line standalone reference was deleted. The frontmatter description's `CRAP-score quality gates` claim was false advertising and was removed.
- **Description rewritten** — original description leaked workflow (`Drives a strict red-green-refactor cycle, vertical-slice tracer bullets, watch-it-fail verification, and Tidy-First commit discipline`) — the exact failure mode obra documented. Now: capability statement + triggers + explicit "Do not use for…" clause.
- **ToCs added** to all references > 100 lines per Anthropic's published rule.

## Alternatives considered

- **Pocock as backbone.** Rejected — Pocock's vertical-slicing is brilliant but the rest is more design-led than enforcement-led. obra's iron-law framing is more LLM-resistant.
- **Osmani as backbone.** Rejected — best theory coverage, weakest enforcement. Pragmatic framing slips under pressure.
- **Hybrid (split into discipline + design skills).** Rejected — splits an inherently-coupled topic across two trigger surfaces; agents may load only one.

## Sources

- obra/superpowers: <https://github.com/obra/superpowers/tree/main/skills/test-driven-development>
- mattpocock/skills: <https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md>
- addyosmani/agent-skills: <https://github.com/addyosmani/agent-skills/tree/main/skills/test-driven-development>
- Uncle Bob's Three Laws: <http://butunclebob.com/ArticleS.UncleBob.TheThreeRulesOfTdd>
- Tidy First (Kent Beck, O'Reilly 2023)
- CRAP (Savoia & Evans, 2007): <http://www.crap4j.org/faq.html>

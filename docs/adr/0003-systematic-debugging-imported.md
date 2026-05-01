# ADR 0003: Importing obra's systematic-debugging skill

## Status

Accepted (2026-05-01).

## Context

obra's `writing-skills` references `superpowers:systematic-debugging` once (in the cross-reference example block) without explaining what that skill does. Importing writing-skills as our backbone (ADR 0002) created a dangling reference.

Two options:
- Replace the reference with a hypothetical placeholder name.
- Import the actual skill so the reference resolves.

The user chose the second: *"we should bring the systematic debugging skill from obra into our namespace"*.

obra's `systematic-debugging` is a 12-file skill (SKILL.md + 4 reference docs + 4 pressure-scenario test files + a `find-polluter.sh` script + a creation log) that drives root-cause investigation through a 4-phase process: **identify symptoms → form hypotheses → reproduce reliably → write failing test → implement single fix → verify**.

The skill is independently useful — debugging is a discipline that benefits from the same kind of pressure-resistant rule structure that TDD does, and it composes naturally with our existing TDD skill (the "write failing test for the bug" phase is exactly the Prove-It pattern from the TDD skill's `bug-fix-pattern.md`).

## Decision

**Import obra's `skills/systematic-debugging/` ad literam** into `skills/systematic-debugging/`. MIT-compatible. No content edits except cross-reference porting (see ADR 0004).

Cross-references ported:
- `superpowers:test-driven-development` → `engineering:test-driven-development` (2 occurrences in `SKILL.md`).
- `superpowers:verification-before-completion` → `engineering:verification-before-completion`. The referenced skill was imported alongside (single-file `SKILL.md`, no internal cross-refs to port) so the link resolves.

Place in the **`engineering`** plugin alongside `test-driven-development`. The plugin's description was updated to: *"Engineering practice skills: TDD, systematic debugging, code review, refactoring discipline."*

## Consequences

**Positive:**
- The cross-reference in `writing-skills` now resolves to a real skill in our marketplace.
- We get a battle-tested debugging discipline that pairs well with our TDD skill's bug-fix pattern.
- The `engineering` plugin now has two of the three skills its description promises (TDD + systematic debugging; code review and refactoring discipline are still future work).

**Negative / accepted trade-offs:**
- 13 total files added to the marketplace (12 in systematic-debugging plus 1 in verification-before-completion). obra's structure is well-organized, so this is incremental load, not bloat.

## Alternatives considered

- **Don't import; replace the reference with a placeholder.** Rejected — the user explicitly asked for the import, and a real skill is more useful than a placeholder.
- **Import only SKILL.md, drop the reference docs and test files.** Rejected — the test files (`test-academic.md`, `test-pressure-1.md`, etc.) are part of the skill's bulletproofing methodology; they're load-bearing. The reference docs (`condition-based-waiting.md`, `defense-in-depth.md`, `root-cause-tracing.md`) are how the skill enforces specific debugging techniques. Stripping them would be the same over-correction we made (and rolled back) on writing-skills.
- **Drop the `verification-before-completion` line entirely instead of importing.** Rejected — keeping a dangling reference with a "marked inactive" sticker would be a breadcrumb (forbidden by the global "no breadcrumbs" rule). Importing the real skill is the only honest option.

## Sources

- obra/superpowers `systematic-debugging`: <https://github.com/obra/superpowers/tree/main/skills/systematic-debugging>

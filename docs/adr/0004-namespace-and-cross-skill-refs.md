# ADR 0004: Namespace convention for cross-skill references

## Status

Accepted (2026-05-01).

## Context

Skills sometimes reference other skills — *"REQUIRED BACKGROUND: you MUST understand X before using this skill"*. When the referenced skill is in the same marketplace, the question is what name format to use.

obra/superpowers uses `superpowers:test-driven-development` — `<plugin-namespace>:<skill-name>`. Claude Code's plugin system uses the same format internally (`codex:rescue`, `plugin:context7:context7`).

Three options were on the table when we ported obra into our marketplace:

1. **Strip the namespace** — `test-driven-development`. Bare skill name only.
2. **Replace with our marketplace name** — `agents-skills:test-driven-development`.
3. **Replace with our plugin name** — `engineering:test-driven-development`, `meta:writing-skills`.

The user's directive: *"make sure we use namespace"*.

## Decision

**Use `<plugin>:<skill>` for all cross-skill references**, matching Claude Code's internal convention.

Mapping for our marketplace:
- `engineering:test-driven-development`
- `engineering:systematic-debugging`
- `engineering:verification-before-completion`
- `meta:writing-skills`

This applies in skill bodies (`SKILL.md` and reference files) and in any documentation that names a skill.

The marketplace name (`agents-skills`) is **not** used in cross-references — it's only relevant at install time (`/plugin install meta@agents-skills`).

## Consequences

**Positive:**
- Matches the format Claude Code already uses for installed plugins (`codex:rescue`, etc.) — agents recognize it natively.
- Disambiguates skills with the same short name across plugins (could happen as the marketplace grows).
- Mechanical port: any `<obra-namespace>:<skill>` reference from upstream maps cleanly to `<our-plugin>:<skill>`.

**Negative / accepted trade-offs:**
- Skills that move between plugins later will need a cross-reference update. Mechanical and rare; CI grep-check can catch this if we add one.
- Cross-marketplace references (e.g., a skill in our marketplace pointing to a skill in another) aren't covered by this convention. We'll address that the first time it comes up; for now we don't have any.

## Alternatives considered

- **Bare skill name (option 1).** Rejected — no disambiguation. Two plugins could ship `code-review`; agents would have no way to tell which one a reference points at.
- **Marketplace prefix (option 2).** Rejected — `agents-skills:` is verbose and conflates the install surface with the cross-reference surface. Plugin name is the right granularity for cross-references; marketplace name is the right granularity for installs.
- **No prefix; rely on file paths.** Rejected — file paths force-load when read with `@` syntax (200k context burn), and bare paths break when skills move. obra's CSO section explicitly bans `@`-style file references for this reason. Plugin-prefixed skill names give the agent a logical handle without forcing a load.

## Sources

- obra/superpowers cross-reference convention: <https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md#4-cross-referencing-other-skills>
- Claude Code plugin namespace examples: visible in installed-skill listings (e.g., `codex:rescue`).

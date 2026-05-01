# Architecture Decision Records

Significant decisions about this skill marketplace, captured in [ADR](https://adr.github.io/) format. Each file: **Context** → **Decision** → **Consequences**.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-tdd-skill-backbone.md) | TDD skill: backbone choice and stress-test fixes | Accepted |
| [0002](0002-writing-skills-from-obra.md) | Writing-skills: obra backbone with surgical Anthropic / Codex / Pocock additions | Accepted |
| [0003](0003-systematic-debugging-imported.md) | Importing obra's systematic-debugging skill | Accepted |
| [0004](0004-namespace-and-cross-skill-refs.md) | Namespace convention for cross-skill references | Accepted |
| [0005](0005-systematic-debugging-osmani-additions.md) | Systematic-debugging: surgical Phase 1 additions from addyosmani | Accepted |

## Why ADRs

- Skill content evolves but decisions need to be searchable separately from the content itself.
- Future contributors (and future-me) need to know *why* we chose obra over Pocock, *why* CRAP got demoted, *why* we use `engineering:` as a namespace prefix.
- The CHANGELOG records *what changed*; ADRs record *why we chose X*.

## When to add an ADR

- Introducing a new skill backbone or canonical reference.
- Removing or substantially restructuring existing content.
- Adopting a new convention (naming, namespace, structure).
- Choosing between multiple legitimate approaches with non-trivial trade-offs.

Don't write an ADR for routine bug fixes, content tweaks, or version bumps — those go in the CHANGELOG.

## Template

```markdown
# ADR <NNNN>: <Title>

## Status
Proposed | Accepted | Superseded by [ADR-XXXX]

## Context
What's the situation that requires a decision? What constraints or pressures matter?

## Decision
What did we choose? State it as a directive.

## Consequences
Good, bad, neutral results of this decision. Be honest about trade-offs.

## Alternatives considered
What we rejected and why.
```

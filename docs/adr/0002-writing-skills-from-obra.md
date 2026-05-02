# ADR 0002: Writing-skills — obra backbone with surgical Anthropic / Codex / Pocock additions

## Status

Accepted (2026-05-01).

## Context

After shipping the TDD skill we needed a `writing-skills` skill — the meta-skill that teaches how to write skills. obra/superpowers' `writing-skills` (4 files, 2376 total lines including a vendored copy of Anthropic's official best-practices doc) was the obvious backbone.

obra's framing — *"writing skills IS TDD applied to process documentation"* — is exactly right: pressure scenarios are the failing tests, the skill body is the production code, rationalizations the agent finds under pressure are the bugs you refactor against.

But: obra was written for the `superpowers:` ecosystem, the vendored Anthropic doc was a point-in-time snapshot (April 2026), Codex documentation isn't covered, and Matt Pocock's `write-a-skill` adds a sharper description-shape rule.

A previous attempt (rejected before merge) collapsed obra's 4-file structure into a single 481-line SKILL.md. That was an over-correction from a separate over-engineering incident; it dropped operational content from `testing-skills-with-subagents.md` (worked pressure-scenario templates, plug-each-hole pattern, meta-testing). The user pushed back hard — *"obra's skill, with references and everything"*.

## Decision

**Vendor obra's `writing-skills/` directory verbatim** — `SKILL.md` + `anthropic-best-practices.md` + `persuasion-principles.md` + `testing-skills-with-subagents.md` + `graphviz-conventions.dot` + `render-graphs.js` + `examples/CLAUDE_MD_TESTING.md`. MIT-to-MIT, no license issue. Structure preserved exactly as obra ships it.

Then apply **surgical edits**:

1. **Cross-reference porting** (mandatory): `superpowers:test-driven-development` → `engineering:test-driven-development` (4 occurrences), `superpowers:systematic-debugging` → `engineering:systematic-debugging` (1 occurrence). See ADR 0004.
2. **Anthropic best-practices doc refreshed** from the live URL on 2026-05-01. obra's snapshot was current on most things but missing the latest `anthropic`/`claude` reserved-words rule. The refreshed copy is annotated with source URL and date at the top.
3. **CSO description rule reconciled.** obra's stated rule is *"description = WHEN to use, NOT WHAT it does"*. The official `agentskills.io/specification` (which obra itself cites) says descriptions *"should describe both what the skill does and when to use it"*. Anthropic's best-practices doc agrees. Matt Pocock's `write-a-skill` agrees. obra was over-correcting against a real failure mode (workflow-summarizing descriptions cause agents to skip the skill body — obra has a documented testing case). The reconciled rule: **capability sentence + trigger sentence; never workflow steps.** A capability statement is *not* a workflow leak — "Drives implementation with TDD" names what the skill enables; "first writes test, then watches it fail, then writes code" names workflow steps. Only the second is forbidden. The CSO section was rewritten to make this distinction explicit, with the documented case preserved as the "why".
4. **Codex compatibility section added** — ~12 lines covering: `.agents/skills/` install path, 8000-char Codex description ceiling (stay ≤ 1024 for portability), "Do not use for…" trigger boundary (Codex emphasizes both directions), optional `agents/openai.yaml` manifest. Sits between the CSO section and the flowchart section.
5. **Frontmatter description self-applied** — the writing-skills skill's own description now follows the new rule: capability sentence ("Authors and revises agent skills using TDD-for-documentation discipline") + triggers ("Use when creating a new skill, editing an existing skill...").

Every other line of obra's content is untouched.

## Consequences

**Positive:**
- Backbone fidelity to obra (the requested directive). No content invented.
- Description rule now matches the official spec, Anthropic's best-practices doc, and Matt Pocock's framing — three independent sources triangulating on the same answer.
- Codex coverage is operational without bloat (one short section, no parallel reference doc).
- Vendored Anthropic doc is current to 2026-05-01.

**Negative / accepted trade-offs:**
- Total skill content remains heavy (~2376 lines plus our additions). obra's deliberate progressive-disclosure structure carries this without context burn — each file loads on demand, none reference each other (Anthropic's "one level deep" rule is satisfied).
- The CSO reconciliation diverges from obra's stated rule. obra's rule is correct in spirit (no workflow leak) but too restrictive in letter. We side with the official spec; obra's documented testing case is preserved as the rationale.

**Lesson worth preserving:** the previous over-correction (collapsing obra's 4-file structure) came from a wrong-blanket-rule moment — applying "no overbloat" to obra's deliberate references when the rule was meant for *additions*. Backbone fidelity means structure too, not just content.

## Subsequent revisions

- **Frontmatter description reverted to obra's verbatim** (2026-05-02). Decision point 5 (self-applied capability + triggers) was tested against obra's triggers-only across opus / sonnet / haiku with 11 prompts (5 clear positives, 3 borderline, 3 negatives). All 33 trials matched: zero cases where the longer "ours" description triggered writing-skills and obra's missed. The added 185 characters carried real catalog-metadata cost across every conversation with no measurable triggering benefit at any model strength. Reverted per YAGNI applied to actual data. The CSO rule change in the body (capability + triggers, never workflow) is *retained* — the rule is sourced from the agentskills.io spec and applies to other skills; it just didn't earn its place on writing-skills' own description, where the obra trigger keywords already cover the surface. This creates a deliberate asymmetry: the skill teaches "capability + triggers is correct" while its own description is triggers-only, justified empirically rather than rhetorically. If a future test surfaces a case where the longer form earns its keep, revisit.

## Alternatives considered

- **Single-file SKILL.md.** Tried, rejected. Lost the testing methodology's worked examples (~5 bullets vs obra's full pressure-scenario template). User flagged it.
- **Drop the vendored Anthropic doc, link only.** Rejected — having the doc on disk lets agents grep into it without a fetch round-trip. The 1150-line cost is paid only on demand.
- **Add a `codex-best-practices.md` parallel to `anthropic-best-practices.md`.** Rejected — Codex's deltas are small enough that a 12-line inline section beats a 1000-line vendored doc.
- **Adopt obra's "no capability, only triggers" rule despite the spec.** Rejected — obra's documented case is real, but the spec, Anthropic, and Pocock all disagree. Keep obra's *concern* (no workflow leak) but allow the *capability sentence* the spec recommends.

## Sources

- obra/superpowers `writing-skills`: <https://github.com/obra/superpowers/tree/main/skills/writing-skills>
- mattpocock `write-a-skill`: <https://github.com/mattpocock/skills/blob/main/skills/productivity/write-a-skill/SKILL.md>
- Anthropic best practices: <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>
- agentskills.io specification: <https://agentskills.io/specification>
- Codex skills docs: <https://developers.openai.com/codex/skills>

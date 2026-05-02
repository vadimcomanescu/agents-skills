# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Skills follow the [Agent Skills specification](https://agentskills.io/specification).

## Project structure

```
.claude-plugin/   # Claude Code marketplace + plugin manifests
.codex-plugin/    # Codex plugin manifest
.agents/plugins/  # Codex marketplace catalog
skills/<name>/    # Per-skill bundle (SKILL.md + supporting files)
```

## Skills

- `writing-skills` — TDD-for-documentation. Authoring and revision discipline for skills.
- `test-driven-development` — Iron Law, Three Laws, vertical slicing, mutation testing.
- `systematic-debugging` — Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify.
- `verification-before-completion` — No "done" / "fixed" / "passing" claims without output.

## Conventions

- Every skill is a directory under `skills/` with a `SKILL.md` at its root.
- `SKILL.md` frontmatter requires `name` (lowercase alphanumerics + hyphens, must match parent dir) and `description` (max 1024 chars, capability + triggers, never workflow).
- Cross-skill references use `agents-skills:<skill>` with an explicit requirement marker (e.g. `**REQUIRED SUB-SKILL:** Use agents-skills:test-driven-development`).
- File references inside a skill use relative paths from the skill root, no `@` prefix. See [agentskills.io/specification#file-references](https://agentskills.io/specification#file-references).
- Skills are pressure-tested with adversarial subagents before they ship and after every revision (see `agents-skills:writing-skills`).

## Boundaries

Always:
- Test edits to discipline-enforcing skills with adversarial subagents before claiming completion.
- Match the `name` field to the parent directory exactly.
- Keep `SKILL.md` under 500 lines; move detailed reference material to `references/` and tell the agent when to load each file.

Never:
- Use `@<path>` syntax for file references inside `SKILL.md` (that is CLAUDE.md auto-import syntax, not the skill spec).
- Summarize a skill's workflow in its `description` field — it creates a shortcut the agent takes instead of reading the body.
- Add a skill that duplicates one already shipping in `obra/superpowers`, `addyosmani/agent-skills`, or `mattpocock/skills`. Send a PR upstream instead.

## Adding a skill

1. Create `skills/<your-skill>/SKILL.md` with `name` and `description` frontmatter.
2. Run an adversarial subagent pressure-test using `agents-skills:writing-skills`.
3. Commit. Skills are auto-discovered from `skills/`; no marketplace registration needed.

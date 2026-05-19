# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Skills follow the [Agent Skills specification](https://agentskills.io/specification); source lives in `skills/<name>/SKILL.md`. The `.agents/skills/<name>` symlinks expose each source skill locally to Codex.

## Forbidden Patterns

| WRONG | CORRECT | Why |
|---|---|---|
| Hardcode the skill list in this file | `ls skills/*/SKILL.md` and read frontmatter | Static lists go stale; this section was 5 of 8 before refactor |
| Edit `.agents/skills/<n>` directly | Edit `skills/<n>/`; symlink reflects it | `.agents/` is a discovery surface, not source |
| Cite a ref then extend its wording silently | Inline `[source: <ref>]` or `[my synthesis]` per concrete construct | Synthesis disguised as citation is hallucinated authority |
| Quick-edit a skill from memory | Read `skills/<n>/SKILL.md` first | Memory drifts from the canonical workflow |
| Summarize the workflow in the skill `description` field | Capability + triggers only | Description selects; body teaches |
| Add a new skill duplicating an existing one | Update / extend the existing skill | Two sources of truth diverge |
| Bundle process improvements into a feature edit | Do the requested change only | Scope creep poisons review |

## Skill Editing Gate

- MUST treat workflow-shaped skill changes as behavior changes, not prose cleanup.
- MUST run the `creating-skills` behavioral-eval path before editing a workflow-shaped skill unless the user explicitly says to skip evals.
- MUST NOT rewrite a workflow-shaped skill from architectural judgment alone. First define what behavior should improve, what behavior must stay stable, and what prompt or fixture will prove it.
- MUST NOT claim a skill edit is correct because `quick_validate.py` passes. That check is packaging-only.

## Boundaries

- Never package skills as `<name>.zip` in this repo
- Never preserve removed behavior in active text unless user asks for compatibility
- Never invent scripts, manifests, or process files unless requested
- Never rename a skill without updating its `name:` frontmatter

## Verification

After any change:

```bash
# Skill content edit
head -5 skills/<n>/SKILL.md          # name: matches dir, description present
readlink .agents/skills/<n>           # → ../../skills/<n>
wc -l skills/<n>/SKILL.md             # < 500
python3 skills/creating-skills/scripts/quick_validate.py skills/<n>

# Workflow-shaped skill behavior edit
# Also run the creating-skills behavioral-eval path, or record the user's explicit no-evals instruction.

# Skill added / renamed
diff <(ls skills/) <(ls .agents/skills/)   # parity, no orphans

# Plugin metadata
jq . .codex-plugin/plugin.json        # valid JSON
```

## Discovery

- Skill source: `ls skills/`
- Local Codex view: `ls .agents/skills/`
- Plugin manifests: `.codex-plugin/plugin.json`, `.claude-plugin/`, `.agents/plugins/marketplace.json`

## References

| Path | Topic |
|---|---|
| `README.md` | Human-facing repo overview, install/update commands, distribution model, and skill list |
| `skills/creating-skills/SKILL.md` | Authoring or editing any skill — directory layout, frontmatter, descriptions, evals |
| `skills/agents-md/SKILL.md` | Auditing and refactoring this file |
| `skills/slap/SKILL.md` | User-invoked correction protocol when steering fails |
| `skills/shepherd/SKILL.md` | End-to-end autonomous multi-milestone builds |
| `skills/tdd-mutation/SKILL.md` | Test-first implementation with mutation-backed verification |

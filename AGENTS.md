# agents-skills

Public skill collection for Claude Code, Codex, Gemini CLI, and OpenCode.

## Layout

```
.claude-plugin/marketplace.json    Claude Code marketplace catalog
.agents/plugins/marketplace.json   Codex marketplace catalog
plugins/<theme>/                   Per-theme plugin manifests (Claude + Codex)
skills/<name>/SKILL.md             Canonical skill content
template/SKILL.md                  Starter template for new skills
scripts/check-consistency.sh       Cross-file consistency lint (runs in CI)
.github/workflows/validate.yml     CI: schema + frontmatter + consistency
```

## Install

```bash
# Claude Code
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install meta@vadim-loadout

# Codex CLI
codex plugins marketplace add github:vadimcomanescu/agents-skills
codex plugins install meta@vadim-loadout

# Gemini CLI / OpenCode (via npx skills)
npx skills add vadimcomanescu/agents-skills -a gemini-cli opencode
```

The `-a` flag is mandatory on `npx skills add` calls. Without it, `npx skills` creates skill directories for every runtime it knows about, including ones not in use. CI rejects PRs with `npx skills add` invocations missing `-a`; see `scripts/check-consistency.sh` check A.

## Adding a new skill

1. Copy `template/SKILL.md` to `skills/<your-skill>/SKILL.md`.
2. Fill in frontmatter `name` and `description`.
3. Reference `./skills/<your-skill>` in the appropriate themed plugin's `skills` array in `.claude-plugin/marketplace.json`. The Codex catalog discovers skills by scanning the plugin source dir; no separate registration is needed there.
4. Bump the `version` in three places, all to the same value:
   - `plugins/<theme>/.claude-plugin/plugin.json`
   - `plugins/<theme>/.codex-plugin/plugin.json`
   - the matching plugin entry in `.claude-plugin/marketplace.json`
   CI rejects mismatches; see `scripts/check-consistency.sh` check B.
5. Add an entry to `CHANGELOG.md`.
6. Run `bash scripts/check-consistency.sh` locally before opening a PR.

## Themes

Current:

- `meta` — agent and skill authoring.
- `engineering` — TDD, systematic debugging, verification before completion.

Add new themed plugins by creating `plugins/<theme>/.claude-plugin/plugin.json` and `plugins/<theme>/.codex-plugin/plugin.json`, then declaring them in both marketplace catalogs.

## No shadow canon, no legacy weight

When replacing or removing **anything** from this marketplace — a skill, a plugin theme, a cross-reference, a convention, a scaffold, an example — the old surface MUST be removed entirely. The active marketplace teaches and enforces only what is currently true.

MUST NOT keep:
- Dead skills retained "just in case" (e.g. the original scaffold `example-skill` after real skills exist).
- Dangling cross-references with "marked inactive" annotations — either the target skill is imported and the link resolves, or the line is removed.
- Deprecated marketplace entries pointing at deleted directories.
- Legacy versions of a renamed skill kept under the old name as an alias.
- Negative compatibility tests / "old behavior" fixtures unless the user explicitly asks for a supported compatibility window.

When replacing a skill (e.g. an updated version of an obra-vendored skill), the old version MUST be deleted, not kept under a `*-old` name. Use git history if you need to recover.

This rule is the local instance of Vadim's global *No shadow canon* rule (see `~/.claude/CLAUDE.md`). It exists because additive bias — keeping old things "just in case" — is how marketplaces accumulate dead weight that confuses both agents and contributors.

## Naming

The marketplace name is `vadim-loadout` (in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`). The GitHub repo name is `agents-skills`. They are intentionally different: the repo path is what users `add`; the marketplace name is what users install plugins `@`.

## License

MIT.

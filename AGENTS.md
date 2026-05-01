# agents-skills

Public skill collection for Claude Code, Codex, Gemini CLI, and OpenCode.

## Layout

```
.claude-plugin/marketplace.json    Claude Code marketplace catalog
.agents/plugins/marketplace.json   Codex marketplace catalog
plugins/<theme>/                   Per-theme plugin manifests (Claude + Codex)
skills/<name>/SKILL.md             Canonical skill content
template/SKILL.md                  Starter template for new skills
scripts/install.sh                 Linux/macOS plain-clone installer
.github/workflows/validate.yml     CI: JSON schema + frontmatter checks
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

# Plain clone (Linux/macOS)
git clone https://github.com/vadimcomanescu/agents-skills && ./scripts/install.sh
```

## Adding a new skill

1. Copy `template/SKILL.md` to `skills/<your-skill>/SKILL.md`.
2. Fill in frontmatter `name` and `description`.
3. Reference `./skills/<your-skill>` in the appropriate themed plugin's `skills` array in `.claude-plugin/marketplace.json`.
4. Bump the plugin `version` in `plugins/<theme>/.claude-plugin/plugin.json` and `plugins/<theme>/.codex-plugin/plugin.json`.
5. Add an entry to `CHANGELOG.md`.

## Themes

Current:

- `meta` — agent and skill authoring.

Add new themed plugins by creating `plugins/<theme>/.claude-plugin/plugin.json` and `plugins/<theme>/.codex-plugin/plugin.json`, then declaring them in both marketplace catalogs.

## Naming

The marketplace name is `vadim-loadout` (in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`). The GitHub repo name is `agents-skills`. They are intentionally different: the repo path is what users `add`; the marketplace name is what users install plugins `@`.

## License

MIT.

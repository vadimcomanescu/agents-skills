# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Includes skill authoring, Shepherd orchestration, TDD, debugging, and verification workflows. Pressure-tested with adversarial subagents; revised when an agent finds a way around them.

## Install

The [`npx skills`](https://github.com/vercel-labs/skills) CLI handles the install in one shot. Codex / Gemini CLI / OpenCode are universal agents that natively read `~/.agents/skills/`; Claude Code reads `~/.claude/skills/<name>`, which the CLI auto-symlinks to the canonical bundle.

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code codex gemini-cli opencode
```

Or, for Claude Code only, the plugin marketplace path:

```bash
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install agents-skills@vadim-agents-skills
```

### What gets created (so you can verify)

| Layout | After the install |
|---|---|
| `~/.agents/skills/<name>/` | Canonical bundle directory. Codex, Gemini CLI, and OpenCode read this location natively. |
| `~/.claude/skills/<name>` | Symlink → canonical (auto-created by the CLI for Claude Code). |

```bash
npx skills@latest list -g                          # all globally-installed skills
ls ~/.agents/skills/creating-skills/SKILL.md       # canonical exists
ls -la ~/.claude/skills/creating-skills            # → ../../.agents/skills/creating-skills
```

### Per-agent install

`-a` accepts a space-separated subset of `claude-code`, `codex`, `gemini-cli`, `opencode`. `-g` is user-level scope; drop it for project-level. **Do not** use `--all` — it targets every agent in the CLI's 50+ catalog and creates skill directories for tools you don't run.

> Beware of `-a claude-code` **alone**: the CLI bypasses `~/.agents/skills/` and copies bundles directly to `~/.claude/skills/<name>/` as plain directories. If you later want Codex/Gemini/OpenCode, the recommended install above will move things into the canonical layout cleanly — but mixing per-agent runs over time can leave stale copies behind. Prefer the multi-agent command.

### Picking specific skills

Add `-s <skill>...` to install a subset:

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code -s tdd-mutation systematic-debugging
```

### If you are an agent installing this for the user

```bash
# Detect which agents have a config dir; only pass those.
agents=()
[ -d ~/.claude ]   && agents+=(claude-code)
[ -d ~/.codex ]    && agents+=(codex)
[ -d ~/.gemini ]   && agents+=(gemini-cli)
[ -d ~/.opencode ] && agents+=(opencode)

npx skills@latest add vadimcomanescu/agents-skills -g -y -a "${agents[@]}"
```

- Recognized `-a` values for this repo: `claude-code`, `codex`, `gemini-cli`, `opencode`.
- Skills shipped here: `agents-md`, `context-engineering`, `creating-skills`, `grill-with-docs`, `interview-me`, `plan`, `shepherd`, `slap`, `spec`, `systematic-debugging`, `tdd-mutation`, `using-agents-skills`, `verification-before-completion`. Use `-s` to install a subset; omit it for all shipped skills.
- MUST NOT use `--all` (alias for `-s '*' -a '*' -y`) — it creates dirs for every agent the CLI knows about.

> **SSH error on `marketplace add`?** Claude Code clones via SSH. If you don't have GitHub SSH keys set up, [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once: `git config --global url."https://github.com/".insteadOf "git@github.com:"`.

## Update

Update all skills from this repo in one go:

```bash
npx skills update -g agents-md context-engineering creating-skills grill-with-docs interview-me plan shepherd slap spec systematic-debugging tdd-mutation using-agents-skills verification-before-completion
```

The `npx skills` CLI updates by skill name (not by source repo), so the skills are listed explicitly. The CLI fetches the latest from the source recorded in `~/.agents/.skill-lock.json` and overwrites the canonical bundle at `~/.agents/skills/<name>/`. The `~/.claude/skills/<name>` symlink keeps working — no re-symlinking needed.

To update every globally-installed skill regardless of source:

```bash
npx skills update -g
```

To refetch from `vadimcomanescu/agents-skills` by re-running the install (equivalent end state):

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code codex gemini-cli opencode
```

### When a skill is renamed or removed from this repo

`npx skills add`/`update` are additive — they will not uninstall a skill that has been deleted or renamed at the source. Tracked upstream as [vercel-labs/skills#415](https://github.com/vercel-labs/skills/issues/415). Run an explicit remove first, then re-install:

```bash
npx skills@latest remove <old-or-deleted-name> -g -y -a claude-code codex gemini-cli opencode
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code codex gemini-cli opencode
```

## Skills

| Skill | What it does |
|---|---|
| [`creating-skills`](skills/creating-skills/SKILL.md) | Creates, edits, evaluates, and optimizes agent skills. Merges Anthropic's and OpenAI Codex's `skill-creator` skills, with eval pipeline, description optimization, and graphviz dot conventions. |
| [`shepherd`](skills/shepherd/SKILL.md) | Orchestrates end-to-end autonomous builds across gated intent, spec, standards, planning, implementation, refactor, architect hardening, and implementer repair cycles. It keeps normal acceptance pipeline work with implementers and mutation hardening with architects. |
| [`tdd-mutation`](skills/tdd-mutation/SKILL.md) | Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants. |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify. No symptom patches. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids "done"/"fixed"/"passing" claims without verification output. |
| [`slap`](skills/slap/SKILL.md) | User-invoked correction protocol. Forces meta-level changes (repo, docs, behavior) when steering has failed. |

## Development

`skills/` is the canonical source tree. `.agents/skills/` contains per-skill symlinks back to `skills/` so Codex can discover the same skills while this repo is being edited.

## License

[MIT](LICENSE).

## Attribution

`systematic-debugging` and `verification-before-completion` are vendored from [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), modified for this marketplace. `systematic-debugging` additionally incorporates surgical edits paraphrased from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Copyright (c) 2025 Addy Osmani). The MIT terms in the upstream LICENSE files apply to vendored content.

`creating-skills` merges the `skill-creator` skill from [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0, Copyright (c) Anthropic) and the `skill-creator` skill from [openai/skills](https://github.com/openai/skills) (Apache-2.0, Copyright (c) OpenAI) into a single bundle, with surgical edits and a graphviz dot diagram convention. The Apache-2.0 LICENSE files from each upstream are preserved at `skills/creating-skills/LICENSE-anthropic.txt` and `skills/creating-skills/LICENSE-openai.txt`; their terms apply to the vendored content. The local skill is renamed to `creating-skills` so it does not collide on disk with either upstream when both are installed.

`tdd-mutation` is maintained here as a workflow-first skill for test-first implementation and mutation-backed verification.

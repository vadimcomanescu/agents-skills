# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Pressure-tested with adversarial subagents; revised when an agent finds a way around them.

## Install

The [`npx skills`](https://github.com/vercel-labs/skills) CLI handles the install. The recommended path covers all four agents in one shot, then bridges Codex / Gemini CLI / OpenCode to the canonical with `ln -s`:

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code codex gemini-cli opencode
for s in tdd-mutation systematic-debugging verification-before-completion creating-skills; do
  for a in codex gemini opencode; do
    [ -d ~/."$a" ] && ln -sfn "../../.agents/skills/$s" ~/."$a/skills/$s"
  done
done
```

Or, for Claude Code only, the plugin marketplace path:

```bash
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install agents-skills@vadim-agents-skills
```

### Why the manual loop

The npx CLI tags Codex / Gemini CLI / OpenCode as **universal** agents that share `~/.agents/skills/` as the install location, but those CLIs read from `~/.<agent>/skills/`. The `ln -s` step bridges canonical → per-agent dir. For Claude Code, the CLI creates `~/.claude/skills/<name> → ~/.agents/skills/<name>` automatically when at least one universal agent is in the same `-a` list.

### What gets created (so you can verify)

| Layout | After the recommended install |
|---|---|
| `~/.agents/skills/<name>/` | Canonical bundle directory (source of truth). |
| `~/.claude/skills/<name>` | Symlink → canonical (auto-created by the CLI). |
| `~/.codex/skills/<name>` | Symlink → canonical (created by the manual loop). |
| `~/.gemini/skills/<name>` | Symlink → canonical (created by the manual loop). |
| `~/.opencode/skills/<name>` | Symlink → canonical (created by the manual loop). |

```bash
npx skills@latest list -g                                     # all globally-installed skills
ls -la ~/.codex/skills/creating-skills                        # → ../../.agents/skills/creating-skills
ls    ~/.agents/skills/creating-skills/SKILL.md               # canonical exists
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

# Bridge the universal agents (CLI auto-handles only claude-code).
for s in tdd-mutation systematic-debugging verification-before-completion creating-skills; do
  for a in codex gemini opencode; do
    [ -d ~/."$a" ] && ln -sfn "../../.agents/skills/$s" ~/."$a/skills/$s"
  done
done
```

- Recognized `-a` values for this repo: `claude-code`, `codex`, `gemini-cli`, `opencode`.
- Skills shipped here: `tdd-mutation`, `systematic-debugging`, `verification-before-completion`, `creating-skills`. Use `-s` to install a subset; omit it for all four.
- MUST NOT use `--all` (alias for `-s '*' -a '*' -y`) — it creates dirs for every agent the CLI knows about.
- The `ln -s` loop is required for Codex/Gemini/OpenCode (and harmless if the agent dir is absent — the loop skips it).

> **SSH error on `marketplace add`?** Claude Code clones via SSH. If you don't have GitHub SSH keys set up, [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once: `git config --global url."https://github.com/".insteadOf "git@github.com:"`.

## Update

Update all four skills from this repo in one go:

```bash
npx skills update -g tdd-mutation systematic-debugging verification-before-completion creating-skills
```

The `npx skills` CLI updates by skill name (not by source repo), so the four skills are listed explicitly. The CLI fetches the latest from the source recorded in `~/.agents/.skill-lock.json` and overwrites the canonical bundle at `~/.agents/skills/<name>/`. The per-agent symlinks (`~/.claude/skills/<name>`, `~/.codex/skills/<name>`, etc.) keep working — no re-symlinking needed.

To update every globally-installed skill regardless of source:

```bash
npx skills update -g
```

To refetch from `vadimcomanescu/agents-skills` by re-running the install (equivalent end state):

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a claude-code codex gemini-cli opencode
```

## Skills

| Skill | What it does |
|---|---|
| [`creating-skills`](skills/creating-skills/SKILL.md) | Creates, edits, evaluates, and optimizes agent skills. Merges Anthropic's and OpenAI Codex's `skill-creator` skills, with eval pipeline, description optimization, and graphviz dot conventions. |
| [`tdd-mutation`](skills/tdd-mutation/SKILL.md) | Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants. |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify. No symptom patches. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids "done"/"fixed"/"passing" claims without verification output. |

## Development

`skills/` is the canonical source tree. `.agents/skills/` contains per-skill symlinks back to `skills/` so Codex can discover the same skills while this repo is being edited.

## License

[MIT](LICENSE).

## Attribution

`systematic-debugging` and `verification-before-completion` are vendored from [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), modified for this marketplace. `systematic-debugging` additionally incorporates surgical edits paraphrased from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Copyright (c) 2025 Addy Osmani). The MIT terms in the upstream LICENSE files apply to vendored content.

`creating-skills` merges the `skill-creator` skill from [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0, Copyright (c) Anthropic) and the `skill-creator` skill from [openai/skills](https://github.com/openai/skills) (Apache-2.0, Copyright (c) OpenAI) into a single bundle, with surgical edits and a graphviz dot diagram convention. The Apache-2.0 LICENSE files from each upstream are preserved at `skills/creating-skills/LICENSE-anthropic.txt` and `skills/creating-skills/LICENSE-openai.txt`; their terms apply to the vendored content. The local skill is renamed to `creating-skills` so it does not collide on disk with either upstream when both are installed.

`tdd-mutation` is maintained here as a workflow-first skill for test-first implementation and mutation-backed verification.

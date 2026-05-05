# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Pressure-tested with adversarial subagents; revised when an agent finds a way around them.

## Install

```bash
# Claude Code
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install agents-skills@vadim-agents-skills

# Codex CLI
codex plugins marketplace add github:vadimcomanescu/agents-skills
codex plugins install agents-skills@vadim-agents-skills

# Gemini CLI / OpenCode
npx skills@latest add vadimcomanescu/agents-skills -a gemini-cli opencode
```

> **SSH error on `marketplace add`?** Claude Code clones via SSH. If you don't have GitHub SSH keys set up, [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once: `git config --global url."https://github.com/".insteadOf "git@github.com:"`.

## Skills

| Skill | What it does |
|---|---|
| [`writing-skills`](skills/writing-skills/SKILL.md) | Authors and revises agent skills using TDD-for-documentation discipline. |
| [`tdd-mutation`](skills/tdd-mutation/SKILL.md) | Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants. |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify. No symptom patches. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids "done"/"fixed"/"passing" claims without verification output. |

## Development

`skills/` is the canonical source tree. `.agents/skills/` contains per-skill symlinks back to `skills/` so Codex can discover the same skills while this repo is being edited.

## License

[MIT](LICENSE).

## Attribution

`writing-skills`, `systematic-debugging`, and `verification-before-completion` are vendored from [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), modified for this marketplace. `systematic-debugging` additionally incorporates surgical edits paraphrased from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Copyright (c) 2025 Addy Osmani). The MIT terms in the upstream LICENSE files apply to vendored content.

`tdd-mutation` is maintained here as a workflow-first skill for test-first implementation and mutation-backed verification.

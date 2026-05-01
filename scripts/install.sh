#!/usr/bin/env bash
# Linux/macOS installer. Symlinks every skill into the per-agent skills dirs.
# Windows: use `npx skills add vadimcomanescu/agents-skills` instead.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

TARGETS=(
  "$HOME/.claude/skills"
  "$HOME/.codex/skills"
  "$HOME/.gemini/skills"
  "$HOME/.config/opencode/skills"
)

for target in "${TARGETS[@]}"; do
  mkdir -p "$target"
done

for skill in "$SKILLS_DIR"/*/; do
  [ -d "$skill" ] || continue
  name="$(basename "$skill")"
  for target in "${TARGETS[@]}"; do
    ln -sfn "$skill" "$target/$name"
    echo "linked $target/$name -> $skill"
  done
done

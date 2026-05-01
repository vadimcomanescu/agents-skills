#!/usr/bin/env bash
# Cross-file consistency checks for the marketplace.
# Run locally before pushing; same script runs in CI.
#
# Each check guards a class of drift that has been observed in this repo
# or in upstream marketplaces. Adding a check is cheaper than discovering
# the drift by support email.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

total_failures=0
section_fail=0

start() {
  echo
  echo "=== $1 ==="
  section_fail=0
}

end() {
  if [[ $section_fail -eq 0 ]]; then
    echo "ok"
  else
    echo ">>> $section_fail drift(s)"
    total_failures=$((total_failures + section_fail))
  fi
}

fail() {
  echo "FAIL: $*"
  section_fail=$((section_fail + 1))
}

# ----- A. npx skills add commands in markdown require -a, forbid --all -----
# Why: ~/.claude/CLAUDE.md MUST-rule. `npx skills add` without -a creates
# dead agent dirs for every runtime npx skills knows about; --all is the
# alias for the same broken behavior.
start "A. npx skills add must include -a and must not use --all"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if grep -qE -- '--all' <<<"$line"; then
    fail "(--all forbidden) $line"
  elif ! grep -qE -- '-a [a-z]' <<<"$line"; then
    fail "(missing -a)     $line"
  fi
done < <(grep -rEn 'npx skills(@[a-zA-Z0-9._-]+)? add ' --include='*.md' . 2>/dev/null || true)
end

# ----- B. Claude catalog plugin versions match plugin manifest versions -----
# Why: catalog and manifest can drift independently. Observed: catalog at
# 0.1.0 while plugins/<theme>/.claude-plugin/plugin.json was at 0.2.0.
start "B. Claude catalog plugin versions match plugin manifest versions"
while IFS=$'\t' read -r name version; do
  manifest="plugins/$name/.claude-plugin/plugin.json"
  if [[ ! -f "$manifest" ]]; then
    fail "catalog references plugin '$name' but $manifest is missing"
    continue
  fi
  mv=$(jq -r '.version' "$manifest")
  if [[ "$version" != "$mv" ]]; then
    fail "plugin '$name' catalog version=$version but manifest version=$mv"
  fi
done < <(jq -r '.plugins[] | "\(.name)\t\(.version)"' .claude-plugin/marketplace.json)
end

# ----- C. Codex catalog plugin versions match plugin manifest versions -----
# Why: same as B but for the Codex side. The Codex catalog does not list a
# version per plugin; if it ever does, this check should be expanded.
start "C. Codex catalog plugin paths exist and plugin names match"
while IFS=$'\t' read -r name path; do
  clean="${path#./}"
  manifest="$clean/.codex-plugin/plugin.json"
  if [[ ! -f "$manifest" ]]; then
    fail "codex catalog '$name' at $path but $manifest is missing"
    continue
  fi
  mn=$(jq -r '.name' "$manifest")
  if [[ "$name" != "$mn" ]]; then
    fail "codex catalog name=$name but manifest name=$mn at $path"
  fi
done < <(jq -r '.plugins[] | "\(.name)\t\(.source.path // .source)"' .agents/plugins/marketplace.json)
end

# ----- D. every skill on disk is registered in the Claude marketplace -----
# Why: a new SKILL.md in skills/ that nobody added to the catalog is invisible
# to /plugin install. The catalog is the install contract.
start "D. every skill on disk is registered in the Claude marketplace"
listed=$(jq -r '.plugins[].skills[]?' .claude-plugin/marketplace.json | sed 's|^\./||')
for d in skills/*/; do
  path="${d%/}"
  if ! grep -qx "$path" <<<"$listed"; then
    fail "$path exists on disk but is not in any plugin's skills[] in .claude-plugin/marketplace.json"
  fi
done
end

# ----- E. every skill in the Claude marketplace exists on disk -----
# Why: a stale entry in skills[] that points at a deleted directory makes
# /plugin install fail mysteriously. Catch it at PR time.
start "E. every skill registered in the Claude marketplace exists on disk"
while read -r raw; do
  [[ -z "$raw" ]] && continue
  clean="${raw#./}"
  if [[ ! -f "$clean/SKILL.md" ]]; then
    fail "marketplace registers '$raw' but $clean/SKILL.md is missing"
  fi
done < <(jq -r '.plugins[].skills[]?' .claude-plugin/marketplace.json)
end

# ----- F. README.md mentions every skill in skills/ -----
# Why: README.md is the public-facing inventory. A skill that exists but
# isn't listed creates the impression it isn't supported. Doc-vs-reality
# drift in the most-read file in the repo.
start "F. README.md mentions every skill in skills/"
for d in skills/*/; do
  name=$(basename "$d")
  if ! grep -q "$name" README.md; then
    fail "skills/$name exists but is not mentioned in README.md"
  fi
done
end

# ----- G. relative file references in top-level docs must exist -----
# Why: a deleted file (e.g. scripts/install.sh) leaves dangling references
# in README/AGENTS that mislead new users and agents. Catch broken markdown
# links of the form [text](path) and inline references like `path/to/file`.
# Scope: top-level docs only, paths that look local (no scheme, no anchor).
start "G. relative file references in README.md and AGENTS.md exist on disk"
extract_paths() {
  local file="$1"
  # only markdown link targets: [text](path). prose-mentioned filenames
  # in backticks are too noisy (generic format references vs real links).
  grep -oE '\]\([^)#][^):]*\)' "$file" | sed -E 's/^\]\(([^)]+)\)$/\1/'
}
for doc in README.md AGENTS.md; do
  [[ -f "$doc" ]] || continue
  while IFS= read -r raw; do
    [[ -z "$raw" ]] && continue
    # strip query strings, anchors, leading ./
    clean="${raw%%#*}"
    clean="${clean%%\?*}"
    clean="${clean#./}"
    # skip URLs (http, https, mailto)
    [[ "$clean" =~ ^(https?|mailto): ]] && continue
    # skip anchor-only refs like #section
    [[ "$clean" =~ ^# ]] && continue
    # skip empty after strip
    [[ -z "$clean" ]] && continue
    if [[ ! -e "$clean" ]]; then
      fail "$doc references '$raw' but no such file or directory exists"
    fi
  done < <(extract_paths "$doc" | sort -u)
done
end

echo
if [[ $total_failures -gt 0 ]]; then
  echo "consistency: $total_failures drift(s) total"
  exit 1
fi
echo "consistency: all checks passed"

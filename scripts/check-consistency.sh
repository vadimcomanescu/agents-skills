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
done < <(grep -rEn 'npx skills(@[a-zA-Z0-9._-]+)? add ' --include='*.md' --exclude='CHANGELOG.md' . 2>/dev/null || true)
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

# ----- H. marketplace metadata.version is at least the max plugin version -----
# Why: .claude-plugin/marketplace.json carries a top-level .metadata.version
# alongside per-plugin versions. The two are easy to bump independently and
# easy to forget; this check fails if the top-level metadata is older than the
# highest plugin version.
start "H. .claude-plugin/marketplace.json metadata.version >= max plugin version"
meta_v=$(jq -r '.metadata.version' .claude-plugin/marketplace.json)
max_plugin_v=$(jq -r '.plugins[].version' .claude-plugin/marketplace.json | sort -V | tail -1)
lowest=$(printf '%s\n%s\n' "$meta_v" "$max_plugin_v" | sort -V | head -1)
if [[ "$lowest" != "$max_plugin_v" ]]; then
  fail "metadata.version=$meta_v is older than max plugin version=$max_plugin_v"
fi
end

# ----- I. <plugin>:<skill> cross-references in docs resolve to live skills -----
# Why: ADR 0004 established <plugin>:<skill> as the cross-reference format.
# A reference whose target is no longer registered under that plugin is dead
# canon, which the "no shadow canon" rule in AGENTS.md forbids.
# Scope: any .md file under the repo, excluding CHANGELOG.md (legitimate history).
start "I. <plugin>:<skill> cross-references in docs resolve"
plugin_names=$(jq -r '.plugins[].name' .claude-plugin/marketplace.json)
plugin_alt=$(echo "$plugin_names" | tr '\n' '|' | sed 's/|$//')
ref_pattern="\b(${plugin_alt}):[a-z][a-z0-9-]*\b"
while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  file=$(cut -d: -f1 <<<"$match")
  line=$(cut -d: -f2 <<<"$match")
  ref=$(cut -d: -f3- <<<"$match" | grep -oE "$ref_pattern" | head -1)
  [[ -z "$ref" ]] && continue
  plugin="${ref%%:*}"
  skill="${ref##*:}"
  if ! jq -e --arg p "$plugin" --arg s "./skills/$skill" \
      '.plugins[] | select(.name == $p) | .skills[] | select(. == $s)' \
      .claude-plugin/marketplace.json > /dev/null; then
    fail "$file:$line references '$ref' but skill is not registered under plugin '$plugin'"
  fi
done < <(grep -rEn "$ref_pattern" --include='*.md' --exclude='CHANGELOG.md' . 2>/dev/null || true)
end

# ----- J. every ADR file is linked from the ADR index -----
# Why: docs/adr/README.md is the index for the ADR set. Adding an ADR without
# updating the index leaves the ADR invisible to anyone reading the index;
# adding an index entry that points at a missing file is dead canon. This
# check enforces the disk-side direction (file exists -> index entry exists).
start "J. every docs/adr/NNNN-*.md is linked from docs/adr/README.md"
if [[ -f docs/adr/README.md ]]; then
  index="$(cat docs/adr/README.md)"
  for adr in docs/adr/[0-9]*.md; do
    [[ -f "$adr" ]] || continue
    base=$(basename "$adr")
    if ! grep -qF "$base" <<<"$index"; then
      fail "$adr exists but is not linked from docs/adr/README.md"
    fi
  done
else
  fail "docs/adr/README.md missing"
fi
end

# ----- K. every plugin in catalog appears in install commands in both docs -----
# Why: the canonical install command shape is <plugin>@agents-skills. Both
# AGENTS.md and README.md document install commands; neither is the sole
# source of truth, so they drift independently. Every plugin in the catalog
# must appear in the install block of both docs.
start "K. every plugin has install commands in both AGENTS.md and README.md"
for doc in AGENTS.md README.md; do
  [[ -f "$doc" ]] || { fail "$doc missing"; continue; }
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    if ! grep -qF "$p@agents-skills" "$doc"; then
      fail "$doc does not contain install command for plugin '$p' (expected '$p@agents-skills')"
    fi
  done <<<"$plugin_names"
done
end

# ----- L. npx skills invocation form is identical in AGENTS.md and README.md -----
# Why: the same npx invocation is documented in both docs. Drift between two
# copy-pasteable commands is invisible to the eye and erodes user trust the
# moment one of them stops working.
start "L. npx skills invocation form matches across AGENTS.md and README.md"
agents_npx=$(grep -oE 'npx skills(@[a-zA-Z0-9._-]+)? add [^[:space:]`]*( -a [^`]+)?' AGENTS.md 2>/dev/null | head -1 | xargs)
readme_npx=$(grep -oE 'npx skills(@[a-zA-Z0-9._-]+)? add [^[:space:]`]*( -a [^`]+)?' README.md 2>/dev/null | head -1 | xargs)
if [[ -n "$agents_npx" && -n "$readme_npx" && "$agents_npx" != "$readme_npx" ]]; then
  fail "AGENTS.md uses '$agents_npx' but README.md uses '$readme_npx'"
fi
end

# ----- M. Claude and Codex catalogs declare the same plugin set -----
# Why: the two catalogs are mirror images for two runtimes. A plugin present
# in one but not the other means a runtime where the plugin is silently
# unavailable. Catch the asymmetry at PR time.
start "M. Claude and Codex catalogs declare the same plugin set"
claude_set=$(jq -r '.plugins[].name' .claude-plugin/marketplace.json | sort)
codex_set=$(jq -r '.plugins[].name' .agents/plugins/marketplace.json | sort)
if [[ "$claude_set" != "$codex_set" ]]; then
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    grep -qx "$p" <<<"$codex_set" || fail "plugin '$p' in Claude catalog but not in Codex catalog"
  done <<<"$claude_set"
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    grep -qx "$p" <<<"$claude_set" || fail "plugin '$p' in Codex catalog but not in Claude catalog"
  done <<<"$codex_set"
fi
end

# ----- Not automated (deliberately) -----
# - ADR file-count snapshots ("12-file skill"). ADRs SHOULD NOT contain live
#   counts; convention only, not enforceable without overfitting.
# - THIRD_PARTY_NOTICES.md per-file inventory of vendored skill directories.
#   Requires content review (which file came from which upstream); cannot be
#   recovered mechanically. Enforce on every ADR that imports files: update
#   THIRD_PARTY_NOTICES in the same PR.
# - "Adding a new skill" prose-procedure parity between AGENTS.md and README.md.
#   Step counts and wording differ legitimately (README is fuller); a strict
#   diff would be brittle. Single source of truth fixes this; pick one.

echo
if [[ $total_failures -gt 0 ]]; then
  echo "consistency: $total_failures drift(s) total"
  exit 1
fi
echo "consistency: all checks passed"

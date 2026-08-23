#!/usr/bin/env bash
# Link Claude Code's out-of-repo state into _/claude/ so it can be browsed and
# clicked from the editor. VS Code only resolves links to paths inside the
# workspace, so absolute paths into /tmp or ~/.claude are dead clicks; a symlink
# under the gitignored `_` makes every artifact reachable by an ordinary
# in-workspace relative path while keeping `git status` clean.
#
# Idempotent. Re-running repoints links whose target moved, creates whatever is
# missing, and never overwrites a path it did not create. Run it after a
# container rebuild, or any time the repo is moved:
#
#   bash .devcontainer/claude-links/setup.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
links_dir="$repo_root/_/claude"

# Claude names a project's state directory after the workspace path with every
# separator turned into a dash, and scopes its scratch space by uid. Deriving
# both keeps this working in a fresh codespace, under a different user, or at a
# different checkout path.
slug="$(printf '%s' "$repo_root" | tr '/' '-')"
claude_home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
scratch_root="/tmp/claude-$(id -u)/$slug"
session_root="$claude_home/projects/$slug"

# why: On a fresh container Claude has not run yet, so these do not exist and a
# link into them would dangle. Creating them empty costs nothing and Claude
# adopts them as its own.
mkdir -p \
  "$links_dir" \
  "$scratch_root" \
  "$session_root/memory" \
  "$claude_home/file-history"

# Point one name in the links dir at a target, never clobbering a real file.
link() {
  local name="$1" target="$2" path="$links_dir/$1"

  if [ ! -e "$target" ]; then
    printf '  skip   %-18s target does not exist yet: %s\n' "$name" "$target"
    return 0
  fi

  if [ -L "$path" ]; then
    if [ "$(readlink "$path")" = "$target" ]; then
      printf '  ok     %s\n' "$name"
    else
      ln -sfn "$target" "$path"
      printf '  move   %-18s now -> %s\n' "$name" "$target"
    fi
  elif [ -e "$path" ]; then
    printf '  KEEP   %-18s a real file is already there, left untouched\n' "$name"
  else
    ln -s "$target" "$path"
    printf '  link   %s\n' "$name"
  fi
}

printf 'linking Claude state into %s\n' "${links_dir#"$repo_root"/}"

link scratch            "$scratch_root"
link sessions           "$session_root"
link memory             "$session_root/memory"
link all-projects       "$claude_home/projects"
link file-history       "$claude_home/file-history"
link user-settings.json "$claude_home/settings.json"
link refresh            "$here/refresh"
link README.md          "$here/README.md"

# why: The whole point of living under `_` is that git never sees any of it, so
# a missing ignore rule is worth shouting about rather than silently polluting
# every future `git status`.
if ! git -C "$repo_root" check-ignore -q "$links_dir" 2>/dev/null; then
  printf '\n  WARNING: %s is not gitignored. Add `_` to .gitignore.\n' "${links_dir#"$repo_root"/}"
fi

"$here/refresh"

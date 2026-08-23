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
#
# Pass --soft-fail to report problems and still exit 0. postCreateCommand uses
# it, because a browsing convenience must never be the reason a container build
# fails.
set -Eeuo pipefail

soft_fail=0
for arg in "$@"; do
  if [ "$arg" = "--soft-fail" ]; then
    soft_fail=1
  else
    printf 'claude-links: ignoring unknown argument %s\n' "$arg" >&2
  fi
done

# why: Expected problems are handled where they happen and degrade to a warning,
# so reaching here means something genuinely unforeseen went wrong. Say what and
# where, say what it does and does not affect, and hand over the one command
# that reproduces it.
on_error() {
  local code=$? line=$1
  {
    printf '\nclaude-links: setup stopped early at line %s (exit %s).\n' "$line" "$code"
    printf '  Only the _/claude browsing links are affected. The repo, the container,\n'
    printf '  and Claude Code itself all work without them.\n'
    printf '  To see the failure in full:  bash .devcontainer/claude-links/setup.sh\n'
  } >&2
  if [ "$soft_fail" -eq 1 ]; then
    printf '  Carrying on so container creation still succeeds.\n' >&2
    exit 0
  fi
  exit "$code"
}
trap 'on_error "$LINENO"' ERR

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

# why: Counted apart because they mean opposite things to a reader. A pending
# link is the normal state of a container Claude has not run in yet; a blocked
# one is a filesystem problem that will not fix itself.
pending=0
blocked=0

# Create a directory we are about to link into, without treating failure as fatal.
ensure_dir() {
  if [ -d "$1" ]; then
    return 0
  fi
  if mkdir -p "$1" 2>/dev/null; then
    return 0
  fi
  printf '  WARN   cannot create %s\n' "$1" >&2
  blocked=$((blocked + 1))
  return 0
}

# Point one name in the links dir at a target, never clobbering a real file.
link() {
  local name="$1" target="$2" path="$links_dir/$1"

  if [ ! -d "$links_dir" ]; then
    return 0
  fi

  if [ ! -e "$target" ]; then
    printf '  skip   %-18s target does not exist yet: %s\n' "$name" "$target"
    pending=$((pending + 1))
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

# why: On a fresh container Claude has not run yet, so these do not exist and a
# link into them would dangle. Creating them empty costs nothing and Claude
# adopts them as its own.
ensure_dir "$links_dir"
ensure_dir "$scratch_root"
ensure_dir "$session_root/memory"
ensure_dir "$claude_home/file-history"

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
  printf '\n  WARNING: %s is not gitignored. Add `_` to .gitignore.\n' "${links_dir#"$repo_root"/}" >&2
fi

if [ -d "$links_dir" ] && ! "$here/refresh"; then
  printf '  WARN   could not point the latest-* shortcuts at a session\n' >&2
fi

if [ "$blocked" -gt 0 ]; then
  {
    printf '\n  %s director%s could not be created, so no links were made into %s.\n' \
      "$blocked" "$([ "$blocked" -eq 1 ] && printf 'y' || printf 'ies')" "${links_dir#"$repo_root"/}"
    printf '  Check that %s is a writable directory and not a file.\n' "${repo_root}/_"
  } >&2
elif [ "$pending" -gt 0 ]; then
  printf '\n  %s link(s) waiting on state Claude Code has not written yet, which is\n' "$pending"
  printf '  normal in a fresh container. Re-run after your first session:\n'
  printf '    bash .devcontainer/claude-links/setup.sh\n'
fi

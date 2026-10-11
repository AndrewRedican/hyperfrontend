#!/usr/bin/env bash
# Install the Railway CLI, the engine behind `railway config plan` and `railway config apply`.
#
# `.railway/railway.ts` describes the demo services as code. The root `railway`
# devDependency only supplies the `railway/iac` imports that file uses; reading
# it, diffing it against the live project and applying it is the CLI's job, and
# the CLI is a native binary rather than an npm dependency.
#
# Idempotent: a CLI already at or above the pinned version is left alone. Either
# way the CLI's usage telemetry, on by default, is switched off.
#
#   bash .devcontainer/railway-cli.sh
#
# Pass --soft-fail to report problems and still exit 0. postCreateCommand uses
# it, because a deploy tool must never be the reason a container build fails.
set -Eeuo pipefail

# The `railway/iac` SDK in package.json requires CLI 5.42.1 or newer.
RAILWAY_CLI_VERSION=5.45.3

soft_fail=0
for arg in "$@"; do
  case "$arg" in
    --soft-fail) soft_fail=1 ;;
    *) ;;
  esac
done

fail() {
  echo "railway-cli: $1" >&2
  if [[ $soft_fail -eq 1 ]]; then
    echo "railway-cli: continuing without it; re-run 'bash .devcontainer/railway-cli.sh' before using 'railway config'" >&2
    exit 0
  fi
  exit 1
}

railway_bin="${RAILWAY_HOME:-$HOME/.railway}/bin/railway"
if ! command -v railway >/dev/null 2>&1 && [[ -x "$railway_bin" ]]; then
  PATH="$(dirname "$railway_bin"):$PATH"
fi

if command -v railway >/dev/null 2>&1; then
  installed="$(railway --version 2>/dev/null | awk '{print $2}')"
  if [[ -n "$installed" && "$(printf '%s\n%s\n' "$RAILWAY_CLI_VERSION" "$installed" | sort -V | head -n 1)" == "$RAILWAY_CLI_VERSION" ]]; then
    railway telemetry disable >/dev/null 2>&1 || fail "could not disable Railway CLI telemetry"
    echo "railway-cli: railway $installed already present"
    exit 0
  fi
fi

installer="$(mktemp)"
trap 'rm -f "$installer"' EXIT

echo "railway-cli: installing railway $RAILWAY_CLI_VERSION"
curl -fsSL https://railway.com/install.sh -o "$installer" || fail "could not download the Railway installer"
RAILWAY_NO_TELEMETRY=1 RAILWAY_VERSION="$RAILWAY_CLI_VERSION" bash "$installer" --yes || fail "the Railway installer failed"
"$railway_bin" telemetry disable >/dev/null 2>&1 || fail "could not disable Railway CLI telemetry"
echo "railway-cli: installed railway $RAILWAY_CLI_VERSION; open a new shell, then run 'railway login' and 'railway link'"

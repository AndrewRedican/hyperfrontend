#!/usr/bin/env bash
# Install the two system binaries the documentation media pipeline prefers.
#
# `tool-media` runs without them: it falls back to a libvips encoder and to the
# ffmpeg build that ships alongside the cached browsers. What they buy is size.
# On a scene where the whole frame is in motion, ffmpeg's own palette pass plus
# gifsicle produced a GIF roughly a third smaller than the fallback path on the
# same frames, and a committed asset is worth that difference.
#
# Idempotent, and cheap on a container that already has them.
#
#   bash .devcontainer/media-tools.sh
#
# Pass --soft-fail to report problems and still exit 0. postCreateCommand uses
# it, because an optional encoder must never be the reason a container build
# fails, and `nx run tool-media:doctor` reports what is missing either way.
set -Eeuo pipefail

soft_fail=0
for arg in "$@"; do
  case "$arg" in
    --soft-fail) soft_fail=1 ;;
    *) ;;
  esac
done

fail() {
  echo "media-tools: $1" >&2
  if [[ $soft_fail -eq 1 ]]; then
    echo "media-tools: continuing without them; run 'npx nx run tool-media:doctor' to see the effect" >&2
    exit 0
  fi
  exit 1
}

missing=()
command -v ffmpeg >/dev/null 2>&1 || missing+=(ffmpeg)
command -v gifsicle >/dev/null 2>&1 || missing+=(gifsicle)

if [[ ${#missing[@]} -eq 0 ]]; then
  echo "media-tools: ffmpeg and gifsicle already present"
  exit 0
fi

if ! command -v sudo >/dev/null 2>&1; then
  fail "sudo is unavailable, cannot install ${missing[*]}"
fi

echo "media-tools: installing ${missing[*]}"
sudo apt-get update -qq || fail "apt-get update failed"
sudo apt-get install -y -qq "${missing[@]}" || fail "apt-get install ${missing[*]} failed"
echo "media-tools: installed ${missing[*]}"

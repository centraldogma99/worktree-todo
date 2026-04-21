#!/usr/bin/env bash
set -euo pipefail

# Ad-hoc sign the packaged Electron app.
#
# Why the inside-out loop below (and no --options runtime):
#   Hardened runtime enforces strict library validation that ad-hoc signed
#   binaries cannot satisfy, causing dyld to reject Electron Framework with
#   "Team IDs are different". We re-sign all nested Helpers / frameworks /
#   dylibs first, then the outer bundle last, without the runtime flag.

APP_PATH="out/mac-arm64/Worktree Todo.app"
[ -d "$APP_PATH" ] || APP_PATH="out/mac/Worktree Todo.app"

if [ ! -d "$APP_PATH" ]; then
  echo "No .app found under out/. Run 'pnpm package' first." >&2
  exit 1
fi

echo "signing nested binaries inside-out in: $APP_PATH"
find "$APP_PATH/Contents/Frameworks" \
  \( -name "*.dylib" \
     -o -name "*.framework" \
     -o -name "*Helper*.app" \
     -o -name "Electron Framework" \) \
  -print 2>/dev/null | sort -r | while read -r target; do
  codesign --force -s - "$target" 2>/dev/null && echo "  signed: ${target##*/}"
done

codesign --force -s - "$APP_PATH"
codesign --verify --verbose "$APP_PATH" 2>&1 | head -5
echo "ad-hoc signed: $APP_PATH"

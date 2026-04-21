#!/usr/bin/env bash
set -e

TARGET="${1:-$HOME/tmp/wt-sandbox/demo-feat-1}"

echo "==> cmux reuse-or-create verification"
echo "    Target path: $TARGET"
echo ""

# Check cmux is available
if ! command -v cmux &>/dev/null; then
  echo "FAIL: cmux not found in PATH. Install cmux and retry."
  exit 1
fi
echo "PASS: cmux found at $(command -v cmux)"

# Verify target path exists
if [ ! -d "$TARGET" ]; then
  echo "WARN: Target directory does not exist: $TARGET"
  echo "      Run bootstrap-fixtures.sh first, or pass a valid path as \$1."
  exit 1
fi

echo ""
echo "==> Step 1: query existing workspaces via rpc workspace.list"
LIST_JSON=$(cmux rpc workspace.list)
MATCH_REF=$(printf '%s' "$LIST_JSON" | TARGET="$TARGET" python3 -c '
import json, sys, os
target = os.environ["TARGET"]
data = json.load(sys.stdin)
for w in data.get("workspaces", []):
    if w.get("current_directory") == target:
        print(w.get("ref", ""))
        break
')

if [ -n "$MATCH_REF" ]; then
  echo "PASS: existing workspace found: $MATCH_REF"
  echo ""
  echo "==> Step 2a: select-workspace $MATCH_REF (reuse)"
  cmux select-workspace --workspace "$MATCH_REF"
  echo "PASS: switched to existing workspace. Verify focus in cmux UI."
else
  echo "INFO: no existing workspace with current_directory=$TARGET"
  echo ""
  echo "==> Step 2b: new-workspace --cwd $TARGET (create)"
  CREATE_OUTPUT=$(cmux new-workspace --cwd "$TARGET")
  echo "$CREATE_OUTPUT"
  NEW_REF=$(printf '%s' "$CREATE_OUTPUT" | grep -Eo 'workspace:[0-9]+' | head -1)
  if [ -n "$NEW_REF" ]; then
    echo ""
    echo "==> Step 2c: select-workspace $NEW_REF (new-workspace does not auto-focus)"
    cmux select-workspace --workspace "$NEW_REF"
    echo "PASS: new workspace created AND focused."
  else
    echo "WARN: could not parse new workspace ref from output. Focus not switched."
  fi
fi

echo ""
echo "----------------------------------------------------------------------"
echo "Re-run this script with same TARGET — the second run MUST reuse,"
echo "not create a duplicate. (Verify via cmux list-workspaces before/after.)"
echo "----------------------------------------------------------------------"

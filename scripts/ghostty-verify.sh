#!/usr/bin/env bash
set -e

TARGET="${1:-/tmp/ghostty-verify-test}"

echo "==> Ghostty CWD verification"
echo "    Target path: $TARGET"
echo ""

# Check Ghostty is installed
if ! open -Ra Ghostty &>/dev/null 2>&1; then
  echo "FAIL: Ghostty.app not found. Install Ghostty and retry."
  exit 1
fi
echo "PASS: Ghostty.app found"

mkdir -p "$TARGET"
echo "PASS: target directory ready: $TARGET"

echo ""
echo "==> Attempt 1: open -a Ghostty <path>"
if open -a Ghostty "$TARGET" 2>/dev/null; then
  echo "PASS (Attempt 1): 'open -a Ghostty <path>' succeeded."
  echo ""
  echo "----------------------------------------------------------------------"
  echo "Manual check: in the new Ghostty window run 'pwd'."
  echo "Expected:     $TARGET"
  echo "If correct  → adapter strategy = 'open -a Ghostty <path>'"
  echo "If wrong    → run Attempt 2 manually (see below)"
  echo "----------------------------------------------------------------------"
else
  echo "FAIL (Attempt 1): 'open -a Ghostty <path>' did not work."
  echo ""
  echo "==> Attempt 2: open -a Ghostty --args --working-directory=<path>"
  if open -a Ghostty --args --working-directory="$TARGET" 2>/dev/null; then
    echo "PASS (Attempt 2): fallback '--working-directory' flag succeeded."
    echo ""
    echo "----------------------------------------------------------------------"
    echo "Manual check: in the new Ghostty window run 'pwd'."
    echo "Expected:     $TARGET"
    echo "If correct  → adapter strategy = '--working-directory' flag"
    echo "If wrong    → mark Ghostty adapter as unavailable"
    echo "----------------------------------------------------------------------"
  else
    echo "FAIL (Attempt 2): both strategies failed."
    echo "Decision: mark Ghostty adapter as unavailable in terminal.ts"
    exit 1
  fi
fi

echo ""
echo "Record the working strategy in .omc/research/phase0-spike.md"

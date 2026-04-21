#!/usr/bin/env bash
set -e

SANDBOX="$HOME/tmp/wt-sandbox"

echo "==> Cleaning up old sandbox..."
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"

cd "$SANDBOX"

echo "==> Initialising bare repo 'demo'..."
git init demo
cd demo
echo hello > README.md
git add .
git commit -m init --no-gpg-sign

echo "==> Adding 29 worktrees..."
for i in $(seq 1 29); do
  git worktree add "../demo-feat-$i" -b "feat/$i"
done

echo "==> Making feat/3 dirty..."
echo x >> "$SANDBOX/demo-feat-3/README.md"

echo ""
echo "Done. Sandbox at: $SANDBOX"
echo "Worktrees created: $(git worktree list | wc -l | tr -d ' ') (including main)"
echo ""
echo "Teardown:"
echo "  rm -rf ~/tmp/wt-sandbox"

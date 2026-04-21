# Worktree Todo — Raycast Extension

A Raycast extension for browsing, searching, opening, and removing git worktrees. Shares the same registry as the menubar app.

## Requirements

- [Worktree Todo menubar app](../app) must be installed and running.
- At least one repository must be registered in the menubar app. The extension is read-only from the menubar app's config.

## Local Development

```bash
# From the repo root
pnpm install

# Then launch via Raycast CLI (requires Raycast app installed)
pnpm --filter worktree-todo-raycast dev
```

Or import it directly in Raycast via **Import Extension** pointing to `packages/raycast/`.

## Commands

| Command | Description |
|---|---|
| List Worktrees | Browse, search, open, and remove git worktrees |

## Plan

See the main plan doc at `.omc/plans/worktree-todo-mvp.md` for architecture and phase details.

# Worktree Todo

A small macOS menubar app (+ Raycast extension) for managing `git worktree` setups.

Built because `git worktree list` → copy path → `cd ...` gets old, and a stale
worktree you can't see is a stale worktree you won't clean up.

## Features

- **Menubar popup** — click the tray icon, see every worktree across every
  registered repo, grouped by repo, with a live filter.
- **Open in terminal** — Terminal.app / iTerm2 / Ghostty / [cmux](https://cmux.com/)
  adapters. cmux adapter reuses an existing workspace if one is already open on
  that path, otherwise creates a new one and focuses it.
- **Safe delete** — dirty pre-check, confirmation modal, force-remove fallback
  when git refuses. Never shells out `rm -rf`.
- **Dirty badges** — each worktree is checked for uncommitted/untracked files
  asynchronously after the list renders.
- **Collapsible repo sections** with persisted state.
- **Raycast extension** — same data, same cmux-aware launcher, read-only view
  of the menubar app's registered repos.

## Requirements

- macOS 13+ (Ventura or newer)
- Node 20+ and pnpm 9+ (`corepack enable` or your manager of choice)
- Xcode CLT for `codesign`

## Install from source

```sh
git clone https://github.com/centraldogma99/worktree-todo.git
cd worktree-todo
pnpm install

# Build the packaged .app and ad-hoc sign it
pnpm --filter @worktree-todo/app package
pnpm --filter @worktree-todo/app sign

# Install to ~/Applications
cp -R "packages/app/out/mac-arm64/Worktree Todo.app" ~/Applications/
open "$HOME/Applications/Worktree Todo.app"
```

First launch will be blocked by macOS Gatekeeper because the build is
ad-hoc signed. Go to **System Settings → Privacy & Security**, scroll to the
bottom, click **Open Anyway**.

Alternatively, keep running from source with hot-reload:

```sh
pnpm --filter @worktree-todo/app start
```

## Raycast extension

The Raycast extension shares the same git core and reads the menubar app's
config file, so registered repos show up in both.

```sh
cd packages/raycast
pnpm run dev    # keeps the extension live in Raycast while the process runs
```

For always-on use, register a LaunchAgent that runs `pnpm run dev` at login.

## Repo layout

```
packages/
├── core/      # shared: git executor, porcelain parser, terminal adapters
├── app/       # Electron menubar app (main + preload + renderer)
└── raycast/   # Raycast extension (reuses core)
scripts/       # bootstrap fixtures, cmux/Ghostty verification
.omc/
├── plans/     # MVP plan (v3.1) with decision log
└── research/  # Phase 0/1 findings
```

## Why Electron (not SwiftUI)

The project originally targeted SwiftUI `MenuBarExtra`. It pivoted to Electron
mid-scaffold so the Raycast extension (TypeScript) and the menubar app could
share a single core package. See `.omc/plans/worktree-todo-mvp.md` for the
full ADR.

## License

MIT — see `LICENSE` if present.

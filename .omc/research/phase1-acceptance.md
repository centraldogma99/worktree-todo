# Phase 1 Acceptance — Automated Results + Manual QA Checklist

**Date**: 2026-04-20 (session carried into 2026-04-21)
**Plan reference**: ../plans/worktree-todo-mvp.md (Phase 1 section)
**Upstream tasks completed**: #1 (IPC wiring), #2 (terminal adapters), #3 (renderer), #4 (settings persistence)
**Environment**: macOS 26.4 (Darwin 25.4.0), Node 20+, pnpm 10.28.2, Electron 30.5.1

---

## Automated Results

### AC-1a / AC-2a — Core unit tests

Command:
```
pnpm --filter @worktree-todo/core test
```

Output:
```
 RUN  v1.6.1 /Users/choejun-yeong/open-source/worktree-todo/packages/core

 ✓ test/parser.test.ts  (9 tests) 4ms
 ✓ test/terminal.test.ts  (9 tests) 3ms
 ✓ test/dirty.test.ts  (7 tests) 2ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  01:18:52
   Duration  236ms (transform 158ms, setup 0ms, collect 185ms, tests 9ms, environment 0ms, prepare 175ms)
```

| Suite | Expected | Actual | Result |
|---|---|---|---|
| parser.test.ts | 9/9 | 9/9 | PASS |
| terminal.test.ts | 9/9 | 9/9 | PASS |
| dirty.test.ts | 7/7 | 7/7 | PASS |
| **Total** | **25** | **25** | **PASS** |

### AC-3 — Destructive filesystem operation grep

Command:
```
rg -i "rm -rf|fs\.rm|fs\.rmSync|fs\.unlink" packages/
```

Result: **0 hits** (exit code 1 = no matches found). No dangerous filesystem operations present in any package source.

### AC-4 — Full app build (all Phase 1 changes)

Command:
```
pnpm --filter @worktree-todo/app build
```

Output (exit code 0):
```
> pnpm build:main && pnpm build:preload && pnpm build:renderer && pnpm build:assets

build:main   → tsc -p tsconfig.main.json    ✓ (no errors)
build:preload → tsc -p tsconfig.preload.json ✓ (no errors)
build:renderer → tsc -p tsconfig.renderer.json ✓ (no errors)
build:assets → node scripts/copy-assets.mjs
  assets copied to packages/app/dist/renderer
  preload CJS scope marker written to packages/app/dist/preload
```

Result: **PASS** — all four build steps clean, zero TypeScript errors.

---

## Manual QA Checklist

Run `pnpm --filter @worktree-todo/app start` before checking these items.

### AC-1b — Tray popup latency

- [ ] Click tray icon → worktree list window appears within 100ms (subjective: "instant")
- [ ] Open DevTools Console before clicking; confirm no `[AC-1b breach]` or similar error logged on open

### AC-2b — Terminal adapter smoke test

Test each adapter by selecting it in Settings, then clicking a worktree row to open.

- [ ] **Terminal.app** — opens a new terminal window at the correct CWD
- [ ] **iTerm2** — opens a new iTerm2 window/tab at the correct CWD
- [ ] **Ghostty** — opens Ghostty at the correct CWD _(see Known Gaps below — may be N/A)_
- [ ] **cmux** — reuses existing workspace if CWD matches; creates new workspace otherwise; focuses correctly

### AC-4 — Add Repository dialog

- [ ] Open the app → trigger "Add Repository" dialog
- [ ] Select or type a local git repo path → repo row appears in list within 500ms
- [ ] Quit and relaunch the app → added repo still present (persistence verified)

### AC-5 — Main worktree protection

- [ ] Locate the main worktree row (no branch suffix, or marked as main)
- [ ] Confirm the "Remove" action is disabled / absent for that row
- [ ] Linked worktree rows have Remove enabled

### AC-6 — Dirty badge

- [ ] With a repo that has uncommitted changes, open the tray window
- [ ] Within a few seconds of the window opening, the dirty repo row shows `.is-dirty` badge (e.g., dot indicator or text)
- [ ] A clean repo row has no dirty badge

### Settings persistence

- [ ] Switch terminal adapter in Settings → close Settings → reopen Settings → selection retained
- [ ] Remove a repo from the list → popup window (if open) updates to reflect removal

---

## Known Gaps / Follow-ups

| # | Item | Status | Phase |
|---|---|---|-------|
| G-1 | **Ghostty adapter untested** — Ghostty not installed in dev environment. AC-2b Ghostty row cannot be verified until a Ghostty environment is available. | Deferred | Phase 1.1 |
| G-2 | **AC-1b formal measurement** — No `console.timeEnd("first-paint")` numeric output collected. Subjective feel is <100ms but no logged proof. Phase 1 plan calls for `console.error` on SLA breach; verify this guard fires correctly. | Partial | Phase 1 |
| G-3 | **Multi-display tray positioning** — `screen.getDisplayNearestPoint()` is in code (`src/main/index.ts`) but untested on external monitor. Single-display confirmed PASS in Phase 0. | Deferred | Phase 1.1 |
| G-4 | **Empty-state UI** — No empty list UI when filter matches nothing. Noted in phase0-spike.md as Phase 1 scope item. | Not implemented | Phase 1 / 1.1 |
| G-5 | **cmux workspace cleanup** — Test runs in Phase 0 may have left demo workspaces (workspace:14–17) in cmux sidebar. Cosmetic only; use `cmux close-workspace` or UI to clean up if needed. | Cosmetic | — |

---

## Summary

| Check | Result |
|---|---|
| Core unit tests (25 total) | **25/25 PASS** |
| Destructive fs ops grep | **0 hits — PASS** |
| App build (main + preload + renderer + assets) | **Clean — PASS** |
| Manual QA items | **Pending user verification** |

Automated gate: **GREEN**. Manual checklist above is ready for user sign-off.

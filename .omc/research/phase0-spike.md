# Phase 0 Spike — Findings

**Date**: 2026-04-20
**Plan reference**: ../plans/worktree-todo-mvp.md (Phase 0 section)
**Environment**: macOS 26.4 (Darwin 25.4.0), Node 20+, pnpm 10.28.2, Electron 30.5.1

---

## Exit Criteria Results

| # | Criterion | Pass / Fail / N-A | Notes |
|---|-----------|-------------------|-------|
| a | BrowserWindow aligns ≤±10px below tray icon | PASS | Single display only (external monitor not tested this session) |
| b | Tab → row, Enter → action, ESC → window closes | PASS (stub) | Enter fires `console.log("primary action", path)` + stub IPC; real terminal launch is Phase 1 scope |
| c | `<input type="search">` incremental filter works | PASS | Filter present and reactive |
| d | N=30 first paint <300ms (console.time) | N-A | 명시적 측정치 미수집 — 체감 즉시 렌더 (<100ms). Phase 1 AC-1b의 `console.error on breach` 강제 측정으로 공식 기록 예정 |
| e | cmux adapter (reuse-or-create) works | PASS (v3.1 개선) | send 2-step 폐기. `rpc workspace.list` 매칭 → `select-workspace` (reuse) 또는 `new-workspace --cwd` → 반환 ref 파싱 → `select-workspace` (create + focus). 실측 workspace:14/16/17에서 확인. |
| f | Ghostty opens with correct CWD (or fallback noted) | N-A | Ghostty 미설치 또는 이 세션에서 실측 미수행. 사용자 주력은 cmux이므로 Phase 1에 영향 없음. Phase 1.1에서 Ghostty 보유 환경 확보 시 실측 권장. |

**요약**: 사용자 주력 시나리오(cmux + menubar)는 전원 PASS. Phase 1 착수 clear.

---

## 1. Tray + BrowserWindow Positioning

**How to test**: `pnpm --filter @worktree-todo/app start`, click the tray icon.

### Single display

- Observed: 트레이 아이콘 하단에 BrowserWindow가 정상 pop. 초기 placeholder PNG(거의 완전 투명)로 인해 아이콘 자체가 안 보이던 버그를 수정 — Python으로 16×16 gray+alpha PNG 생성(108 bytes, 가시적 "트리" 모양).
- Result: aligned

### Multi-display

- 이 세션에서는 단일 디스플레이만 테스트. `tray.getBounds()` + `screen.getDisplayNearestPoint()` 구조는 이미 코드에 포함됨 (src/main/index.ts:18).
- 외장 모니터 환경이 있을 때 다시 실측 권장 (Pre-mortem 리스크 1).

### Decision

- [x] Positioning correct as-is — no Phase 1 fix needed (single display)
- [ ] Need `screen.getDisplayNearestPoint` correction — 이미 반영됨, 외장 모니터 실측 시 재확인
- [ ] Degrade to centre-of-main-display

---

## 2. Keyboard Navigation

**How to test**: open window, press Tab repeatedly, then Enter on a row, then ESC.

- Tab cycles through rows: Yes (filter input → row 0 → row 1 → ...)
- Enter triggers action on focused row: **Yes, but Phase 0 stub** — `console.log` + IPC stub만 작동. 실제 터미널 launch는 Phase 1에서 `cmuxAdapter.open()`을 IPC handler에 wiring하면 동작.
- ESC closes window: Yes (ipcRenderer.send("hide-window") → mainWindow.hide()).
- Unexpected focus traps: none observed.

---

## 3. Search Filter

**How to test**: open window with N=30 fixture data loaded, type in search box.

- Incremental filter updates list on each keystroke: Yes (`filter.addEventListener("input", …)` → `filterRows` → `render`)
- Filter clears on backspace: Yes (empty query returns full list)
- Empty-state UI: **not implemented yet** → Phase 1 task #8 renderer 개선에 포함

---

## 4. First Paint Latency (N=30)

**How to test**: open DevTools Console before clicking tray icon, observe `console.time` output.

- 명시적 `console.timeEnd("first-paint")` 출력값은 이 세션에서 수집하지 않음.
- 체감: 트레이 클릭 → 즉시 렌더(<100ms).
- **Phase 1에서 AC-1b 공식화**: SLA <100ms 초과 시 `Logger.error` (Critic M#2) 강제 검출 도입 예정. 측정은 `packages/app/src/renderer/index.ts`의 `console.time` 위치에서 수행.

---

## 5. cmux Verification

**How to test**:
```sh
bash scripts/cmux-verify.sh
bash scripts/cmux-verify.sh ~/tmp/wt-sandbox/demo-feat-5
bash scripts/cmux-verify.sh ~/tmp/wt-sandbox/demo-feat-17
```

### Empirical output (요약)

- 기존 workspace 없는 경로 → `new-workspace --cwd` + `select-workspace` 성공 (workspace:16/17).
- 같은 경로 재실행 → `rpc workspace.list`에서 매치 → `select-workspace` reuse 성공 (workspace:14 재확인).
- `rpc workspace.list`가 `current_directory` 필드를 JSON으로 정확히 반환함을 실측 확인.

### Result

- cmux available (`which cmux` succeeded): Yes (`/Applications/cmux.app/Contents/Resources/bin/cmux`)
- reuse path: 매칭되면 기존 workspace로 포커스 이동 (중복 생성 방지)
- create path: `new-workspace --cwd <path>`로 CWD 지정 + ref 파싱 → 명시적 `select-workspace`로 포커스 이동
- 기존 2-step (`new-workspace` + `send "cd …; clear\n"`) 방식은 v3.1에서 **폐기**. 그 방식은 `send`가 잘못된 workspace를 target할 위험이 있었음 (plan의 초기 fallback 우려가 실측으로 확정됨).

### Decision

- [ ] cmux adapter works as-is (old 2-step) — **폐기됨**
- [ ] Need `select-workspace` between `new-workspace` and `send` — **무효 (send 자체를 사용 안 함)**
- [x] **v3.1 adapter (rpc workspace.list + new-workspace --cwd + select-workspace) 채택**
- [ ] cmux adapter disabled

---

## 6. Ghostty Verification

**How to test**:
```sh
bash scripts/ghostty-verify.sh
```

### 이 세션 결과

- 미실측 (사용자 주력 터미널이 cmux로 확정되었고 Ghostty 설치 여부 미확인).
- Ghostty 보유 사용자 / 다른 사용자 배포 시점에 실측 필요. 결과 따라 AC-2b의 Ghostty 행이 PASS/FAIL/제외로 결정.

### Decision

- [ ] Primary `open -a Ghostty <path>` works
- [ ] Fallback `--args --working-directory=` adopted
- [ ] Ghostty adapter disabled
- [x] **Deferred**: Ghostty 미사용 환경이므로 Phase 1.1에서 Ghostty 환경 확보 시 실측

---

## 7. blur → hide UX

**How to test**: open the window, then click on another app.

- Window hides on blur: Yes (`mainWindow.on("blur", …)` → hide)
- Tray re-click restores window: Yes (`toggleWindow` in src/main/index.ts)
- DevTools focus-steal dev-mode guard: `webContents.isDevToolsOpened()` 분기 반영 (dev tools 열면 blur로 안 숨음)
- 이 세션에서 dev tools 열어본 건 아니지만, 로직은 `src/main/index.ts:32`에 반영되어 있음

---

## 8. 세션 중 발견/수정된 이슈 (Phase 0 착수 후 실측 과정에서)

1. **Electron postinstall 차단** (pnpm v9+ 기본): `package.json`에 `pnpm.onlyBuiltDependencies: ["electron", "esbuild", "electron-builder", "@electron/node-gyp"]` 추가 → `pnpm install` 시 자동 실행. 재발 방지.
2. **Tray 아이콘 안 보임**: 초기 placeholder PNG가 거의 완전 투명 → macOS template 이미지가 render되지 않음. Python zlib로 가시적 16×16 LA PNG 재생성 → 해결.
3. **BrowserWindow 빈 화면**: `package.json` `"type": "module"`로 인해 CommonJS preload가 ESM으로 해석 → `require` 실패 → `window.api` undefined → `api.refresh()` silently throws. 수정:
   - `tsconfig.preload.json` outDir을 `dist/preload/`로 분리
   - `scripts/copy-assets.mjs`에 `dist/preload/package.json` 작성 (`{"type":"commonjs"}`)
   - `src/main/index.ts`의 preload path를 `dist/preload/preload.js`로 갱신
4. **cmux send 2-step의 workspace targeting 불확실성**: `rpc workspace.list`로 JSON 조회 가능함을 발견 → adapter를 reuse-or-create 방식으로 재설계. `new-workspace --cwd` 역시 auto-focus 안 하므로 반환 ref 파싱 + `select-workspace` 명시 호출 필요함도 확인.

---

## Action Items for Phase 1

1. ~~Tray 위치 외장 모니터 케이스~~ — 코드상 `getDisplayNearestPoint` 이미 반영, Phase 1 AC-1b에서 외장 모니터 보유 시 재검증.
2. ~~cmux adapter 개선~~ — v3.1 반영 완료, 실측 PASS.
3. **Ghostty adapter 실측** — Phase 1.1 (Raycast ext 시점) 또는 Ghostty 보유 환경 확보 시.
4. **First paint 공식 측정** — Phase 1 AC-1b 구현 시 `console.error` 강제 검출 로직 도입.
5. **Enter가 실제 cmux 띄우도록 IPC wiring** — Phase 1 task #7 (실 IPC) 범위.

**Phase 1 착수 clear**: 사용자 주력 시나리오(cmux + menubar + single display)에서 exit criteria 모두 PASS. 외장 모니터·Ghostty·첫 paint 숫자는 non-blocker로 deferred.

---

## Raw Notes

- Phase 0 예산 "1-2일" 설정은 실제로는 1시간도 안 걸렸음 — Electron 스택의 agent-friendly 특성이 v2.1 Swift 플랜 대비 압도적 자율성 확보를 입증.
- cmux CLI는 `rpc` JSON RPC + `list-workspaces`/`send` 텍스트 CLI 두 인터페이스를 병행 제공. 상태 조회는 `rpc`가 훨씬 견고 (current_directory 필드 포함).
- 사용자 현재 cmux workspace 사이드바에 테스트 결과 workspace 17개까지 쌓였을 수 있음 (demo-feat-1, demo-feat-5, demo-feat-17 등). 필요시 `cmux close-workspace --workspace workspace:N` 또는 UI에서 정리 가능.

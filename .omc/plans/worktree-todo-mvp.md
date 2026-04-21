# Worktree Todo — macOS Menubar App (MVP) — v3 (Electron pivot)

> 작업 디렉토리: `/Users/choejun-yeong/open-source/worktree-todo/` (신규)
> 작성 모드: RALPLAN Consensus (v2.1 Swift plan → v3 Electron pivot after user decision)
> 대상 OS: macOS 11+ (Electron 30+ minimum). 사실상 개발 환경 macOS 26.4.
> 스택: Electron 30+ / TypeScript 5.x / pnpm workspace / Vitest
> 번들 ID: `app.worktree-todo` (electron-builder `appId`, canonical)

---

## v3 Changelog (Swift → Electron pivot)

사용자가 stack을 Swift native → Electron으로 전환(Q: "electron 앱으로 가게 되면 별로일까?" 제시 tradeoff 수용 후 C 선택).

v2.1에서 확정한 **사용자 결정은 모두 보존**:
- Q1 **Raycast 주력** → monorepo에서 Raycast extension과 git 래퍼 공유 (TS 단일화). 이득 극대화.
- Q2 **cmux** → cmux adapter `child_process.execFile` 2-step 유지.
- Q3 **새 창** / Q4 **3 repo × 5 worktree** / Q5 **Phase 0 spike** / Q6 **team** / Q7 **기본 등록만** / Q8 **동료 공유 + Apple Developer 미보유** — 모두 보존.

### 포기한 것 (수용)

- 네이티브 RAM (~30MB) → Electron 대기 메모리 ~150MB 수용.
- Cold open 200ms → ~800-1200ms 수용.
- macOS 메뉴바 네이티브 affordance → HTML/CSS 재현 (키보드 nav·ESC·focus 명시 구현 필요).
- Swift Testing → Vitest.

### 얻는 것

- **에이전트 자율 개발**: 워커가 `pnpm create electron-forge` → 빌드 → `pnpm start`까지 완결. Xcode GUI 불필요.
- **TS 스택 통일**: Raycast extension(Phase 1.1)과 `packages/core` 완전 공유. 2-stack → 1-stack.
- **크로스-플랫폼 옵션**: Linux/Windows 무료 (요구시).

### 자동 해소된 v2.1 리스크

- `.menu` vs `.window` vs `NSStatusItem+NSPopover` spike — Electron `Tray + BrowserWindow`로 고정. Phase 0 spike 항목 수 감소.
- `MenuBarExtra` 포커스 버그 — N/A.
- Swift `Process` async 패턴·resume-once guard — N/A (Node `child_process` 단순).
- `git <2.35 prunable` 파서 fallback — 여전히 적용 (TS parser).
- Xcode 프로젝트 pbxproj·XcodeGen 고민 — 완전 소멸.

### 새로 생긴 리스크

- **Tray + BrowserWindow 위치 정렬** — Electron의 BrowserWindow는 Tray 아이콘 밑으로 자동 배치되지 않음. `tray.getBounds()` + `window.setPosition()` 수동 계산 필요. Phase 0에서 실측.
- **Window blur 시 숨기기** — 메뉴바 앱 UX: blur 이벤트에서 `hide()`. 디버깅 중 dev tools가 window를 steal focus → blur trigger로 메뉴 사라지는 이슈. Phase 0에서 dev-mode 분기 처리.
- **ad-hoc signing on Electron .app** — `codesign -s - --deep --force --options runtime` 래퍼 스크립트 필요.
- **Gatekeeper** — 서명 없는 Electron .app도 우클릭→열기로 우회 가능 (동료 공유 시 안내).

---

## Principles (유지)

1. **Always-visible surface first** — menubar Tray 아이콘 상시 노출.
2. **Delegate to git CLI** — `child_process.execFile("git", ...)`. libgit2 / nodegit 금지.
3. **Safe destructive ops** — `git worktree remove` + 확인 + dirty 가드. `rm -rf` 금지.
4. **YAGNI — MVP only** — 목록·삭제·열기 세 개. 생성·머지·PR 금지.
5. **Monorepo single stack** — `packages/core` (git·parser·types) + `packages/app` (Electron) + `packages/raycast` (Phase 1.1). 중복 최소화.

---

## Scope

### In-scope (MVP, Phase 1)

- **Tray icon**: macOS menubar에 상주 (tooltip "Worktrees").
- **Window toggle**: Tray 클릭 → BrowserWindow pop (near tray icon). blur → hide.
- **Repository registration**: "Add Repository…" → native dialog → 경로 검증 → `electron-store`에 저장.
- **Worktree list**: 등록된 repo 각각에 `git worktree list --porcelain` 실행, 목록 렌더.
- **Filter**: `<input type="search">` 로 경로/브랜치 incremental filter.
- **Dirty badge (Tier 2)**: 각 row에 `git status --porcelain=v2` 비동기로 실행, dirty면 배지.
- **Remove**: 확인 dialog (`dialog.showMessageBoxSync`) → `git worktree remove [--force]`.
- **Open in terminal**: Terminal.app / iTerm2 / Ghostty / cmux adapter (4종).
- **Settings**: 터미널 선택 + 등록 repo 관리.

### Non-scope (MVP 제외)

- Worktree 생성 (v2).
- Merge / rebase / remote sync.
- PR / issue 연동.
- 자동 업데이트 (`electron-updater`) — Phase 3.
- 공식 배포 (notarization) — Apple Developer 필요 — Phase 3.
- chpwd 훅 auto-suggest — Phase 2.

---

## Discovery Strategy (유지)

**루트 repo 등록제**. "Add Repository…" 버튼 → Electron native `dialog.showOpenDialog({properties: ['openDirectory']})`. 선택 경로에 `execFile("git", ["rev-parse", "--show-toplevel"])` 검증. 저장은 `electron-store` (JSON file at `~/Library/Application Support/worktree-todo/config.json`).

`~/worktrees/*` convention 스캔, chpwd 훅 auto-suggest → Phase 2 이월.

---

## Refresh Strategy (2-tier lazy, 유지)

### Tier 구조

| Tier | 트리거 | 명령 | 역할 | SLA |
|------|--------|------|------|------|
| **1 (sync)** | Tray 클릭 후 window show 직전 | `git worktree list --porcelain` (repo별 병렬, `Promise.all`) | 목록·메타데이터 즉시 렌더 | **<80ms (N≤5 repo)** — Electron overhead 포함 |
| **2 (async)** | Tier 1 렌더 직후 | `git -C <wt> status --porcelain=v2 -uno --no-renames` (worktree별 병렬) | dirty 배지, 도착 순서 업데이트 | 30s TTL 캐시 |
| **3 (lazy, v1.1)** | 배지 클릭 / 상세 | `git -C <wt> log @{u}..HEAD --oneline` | unpushed 경고 | on-demand |

### 동시성·취소

- Tier 1: repo 병렬 `Promise.all` (최대 5). repo > 5면 `min(N, 5)` 청크로 throttle (M#1).
- Tier 2: worktree 병렬, 상한 `min(N, 8)` (p-limit 또는 수동 쿼리).
- Window blur → hide 시 in-flight Tier 2는 **AbortController.abort()** 로 취소.
- Tier 2 결과는 renderer에 `ipcRenderer.on("dirty-update", ...)`로 스트리밍.

### 근거

- Node `child_process.execFile`은 async callback 기반 — Swift `Process` 대비 구현 단순.
- Electron 메인 프로세스가 git 실행, renderer는 IPC로 수신 — security boundary 자연스럽게 생김.

---

## Safety Guards for Delete (유지 + TS화)

1. **Uncommitted 사전 감지**: `git status --porcelain=v2`.
2. **Unpushed 감지 (lazy, 실패 무시)**: `git log @{u}..HEAD --oneline`.
3. **Confirmation**: `dialog.showMessageBox({ buttons: ["Cancel", "Remove", "Force Remove"], defaultId: 0, cancelId: 0 })`.
4. **Command**: 반드시 `execFile("git", ["worktree", "remove", path])` — **`rm -rf` / `fs.rm` 금지**.
5. **Prunable 배지** + "Prune" 액션.
6. **Main 보호**: 첫 항목 Remove 비활성.
7. **git <2.35 parser fallback**: `prunable` 라인 부재 graceful.

---

## Terminal Open Mechanism (유지 + cmux 핵심)

### Adapter 구조

```ts
interface TerminalAdapter {
  id: "terminal-app" | "iterm2" | "ghostty" | "cmux";
  open(path: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}
```

### 구현

- **Terminal.app**: `execFile("open", ["-na", "-b", "com.apple.Terminal", path])`.
- **iTerm2**: `execFile("open", ["-na", "-b", "com.googlecode.iterm2", path])`. Phase 1.1 탭 옵트인 시 `osascript -e '...'` 경로.
- **Ghostty**: Phase 0 spike — `open -a Ghostty <path>` 실측. 실패 시 `open -a Ghostty --args --working-directory=<path>`. 둘 다 실패 시 unavailable.
- **cmux (사용자 주력, v3.1 reuse-or-create)**:
  ```ts
  async function openCmux(path: string) {
    // 1) query workspaces via JSON RPC
    try {
      const { stdout } = await execFile("cmux", ["rpc", "workspace.list"]);
      const data = JSON.parse(stdout) as { workspaces: Array<{ ref: string; current_directory?: string | null }> };
      const match = data.workspaces.find((w) => w.current_directory === path);
      if (match) {
        // 2a) reuse: switch focus to existing workspace
        await execFile("cmux", ["select-workspace", "--workspace", match.ref]);
        return;
      }
    } catch {
      // rpc failure → fall through
    }
    // 2b) create new with --cwd, then select-workspace to focus (new-workspace does NOT auto-focus)
    const { stdout } = await execFile("cmux", ["new-workspace", "--cwd", path]);
    const ref = stdout.match(/workspace:\d+/)?.[0];
    if (ref) await execFile("cmux", ["select-workspace", "--workspace", ref]);
  }
  ```
  - `isAvailable()`: `which cmux` 성공 여부.
  - **UX 개선**: 이미 해당 worktree로 열린 cmux workspace가 있으면 **포커스만 이동** (duplicate 방지). 없으면 `--cwd` 한 방으로 생성 (send 2-step 불필요).
  - Phase 0에서 `rpc workspace.list`가 `current_directory` 필드를 반환함을 실측 확인(2026-04-20).

---

## Tech Stack Specifics

| 항목 | 선택 | 이유 |
|------|------|------|
| 런타임 | **Electron 30+** | Chromium + Node, 공식 signed 바이너리 |
| 언어 | **TypeScript 5.x** (strict) | 타입 안정성, Raycast extension과 공유 |
| 패키지 | **pnpm workspace** | Raycast / core / app 단일 레포, lockfile 공유 |
| 번들 | **electron-builder** | macOS `.app` 생성, ad-hoc signing 친화 |
| UI | **plain TS + HTML/CSS** (No React/Vue) | YAGNI. 150 LOC 뷰 계층에 프레임워크 overkill. 재평가는 >500 LOC 시 |
| 상태 영속화 | **electron-store** | JSON 1-liner, native dialog와 궁합 |
| 테스트 | **Vitest** (unit) + 수동 QA (E2E) | Playwright은 Phase 1.1 검토 |
| IPC | `contextBridge` + `ipcMain/ipcRenderer` | 샌드박스 안전 |
| 서명 | **ad-hoc** (`codesign -s - --deep`) | Apple Developer 없음 (Q8). 개인용 OK |
| 배포 | `out/` 디렉토리 zip → 수령자 우클릭→열기 | 동료 공유 (Q8=B) |

### 왜 Vitest?

- Node/TS 기본 스택. Jest 대비 Vite 친화, ESM 기본.
- `packages/core`의 순수 함수 (parser, cmd builder) 커버에 집중.

---

## Monorepo Module Outline

```
worktree-todo/
├── pnpm-workspace.yaml
├── package.json                    # root. pnpm scripts: build, dev, test, package
├── tsconfig.base.json
├── packages/
│   ├── core/                       # 공용 로직 (Raycast ext도 재사용)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── git.ts              # GitExecutor interface + exec() impl + GitError
│   │   │   ├── parser.ts           # parseWorktreeList(porcelain) -> Worktree[]
│   │   │   ├── dirty.ts            # checkDirty(path) -> boolean
│   │   │   ├── terminal.ts         # TerminalAdapter 4종
│   │   │   └── types.ts            # Worktree, Repository, DirtyBadge
│   │   └── test/
│   │       ├── parser.test.ts      # fixture 5종 (N=1, 3, 15, 30, git<2.35)
│   │       ├── terminal.test.ts    # args 빌드 검증
│   │       └── dirty.test.ts
│   └── app/                        # Electron 앱
│       ├── package.json
│       ├── electron-builder.yml
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts        # app.whenReady → createTray + createWindow
│       │   │   ├── tray.ts         # Tray 아이콘 + 클릭 핸들러 + 위치 계산
│       │   │   ├── window.ts       # BrowserWindow(frame:false, show:false, transparent)
│       │   │   ├── ipc.ts          # ipcMain handlers: refresh, remove, open, addRepo
│       │   │   └── store.ts        # electron-store 래퍼
│       │   ├── preload.ts          # contextBridge.exposeInMainWorld("api", {...})
│       │   └── renderer/
│       │       ├── index.html
│       │       ├── index.ts        # 진입 + render loop
│       │       ├── state.ts        # 간단한 reactive store (custom, <50 LOC)
│       │       └── style.css
│       └── scripts/
│           ├── sign.sh             # post-package ad-hoc codesign
│           └── build-tray-icon.sh  # 16x16 / 32x32 template PNG
└── scripts/
    ├── bootstrap-fixtures.sh       # N=30 dummy worktree 생성 (Phase 0)
    ├── cmux-verify.sh              # cmux 2-step 실측 (Phase 0)
    └── ghostty-verify.sh           # Ghostty open-a CWD 실측 (Phase 0)
```

**파일 수**: core 5 + app 9 + scripts 3 + root 3 ≈ 20. Swift 플랜 9파일 대비 증가는 Electron의 main/renderer/preload 분리 비용. 수용.

---

## Phase 0 — Spike + Scaffold (**필수**, 1일)

### 목표 (3건)

1. **Tray + BrowserWindow 위치 정렬** — 스켈레톤 앱 1개 만들어 Tray 클릭 시 BrowserWindow가 tray 아이콘 하단에 정렬되는지 실측.
2. **blur → hide UX** — window가 외부 클릭에 숨고, 재클릭에 살아나는지.
3. **cmux 2-step + Ghostty `open -a`** — `child_process.execFile`로 실제 동작 실측.

### 스켈레톤 구조

- `packages/app` pnpm init + electron-forge 또는 vanilla + electron-builder.
- `main/index.ts`에 Tray + BrowserWindow 최소 구현 (~50 LOC).
- renderer에 하드코딩 worktree 30개 목록 렌더 — 스크롤·키보드 nav·검색 동작 확인.

### Exit Criteria

- (a) BrowserWindow가 tray 하단 ±10px 이내 정렬.
- (b) Tab 키로 row 이동, Enter로 액션 트리거, ESC로 창 닫힘.
- (c) `<input type="search">` incremental filter 정상 동작.
- (d) N=30 렌더에서 첫 paint 체감 <300ms (console.time으로 측정).
- (e) cmux 2-step이 실제로 새 workspace에 `cd <path>` 전달.
- (f) `open -a Ghostty /tmp/test`가 Ghostty를 CWD로 여는지 확인 (실패 시 `--args --working-directory=` fallback 채택).

(a)-(d) 중 1개라도 실패 시 Phase 0 연장 또는 stack 재평가. (e)(f)는 실패 시 해당 adapter만 disable.

### 산출물

- `packages/app/` 실행 가능한 스켈레톤.
- `.omc/research/phase0-spike.md` 측정 결과 + 결정 기록.

---

## Phase 1 — MVP (2-3일)

1. `packages/core/src/parser.ts` + Vitest fixture 5종.
2. `packages/core/src/git.ts` (`GitExecutor` interface + `execFile`-based impl + `GitError`) + `MockGit`.
3. `packages/core/src/terminal.ts` (4 adapter).
4. `packages/core/src/dirty.ts` (`checkDirty` + `fetchAhead` lazy).
5. `packages/app/src/main/store.ts` (repository 등록/해제).
6. `packages/app/src/main/ipc.ts` (refresh / remove / open / addRepo / removeRepo / setTerminal handlers).
7. `packages/app/src/renderer/index.ts` (레이아웃 + 검색 input + list + badge + row actions).
8. `packages/app/src/renderer/state.ts` (renderer 상태 — Proxy-based 50 LOC).
9. **Settings window** — 별도 BrowserWindow (터미널 선택 + repo 관리).
10. `scripts/sign.sh` ad-hoc codesign + `electron-builder.yml` dmg 설정.
11. 수동 QA: 체크리스트 수행.

### Phase 1.1 — QoL + Raycast Extension (1.5-2.5일)

- Cmd+R refresh / 경로 복사 / Locked 배지 / Prune 액션.
- iTerm2 AppleScript 탭 옵트인.
- Tier 3 unpushed 감지 lazy.
- **Raycast extension** (`packages/raycast`): `packages/core` 의존. TypeScript + Raycast API. `WorktreeListCommand` / `RemoveWorktreeAction` / `OpenInTerminalAction`. 독립 repository registration (local storage).

---

## Acceptance Criteria

### AC-1 — 목록 표시

- **1a (자동, Vitest)**: `parseWorktreeList(fixture)` 반환이 expected `Worktree[]` 배열과 정확 일치 (N=1,3,15,30, git<2.35).
- **1b (반자동, 수동)**: 앱 실행 → Tray 클릭 → 등록된 repo의 모든 worktree row가 렌더. 첫 row, 마지막 row visible. 렌더 console.time <300ms.
  - **Enforceable (Critic M#2)**: SLA 초과 시 `console.error(...)` 강제 (`console.info` 금지). 사용자 console 모니터링 가능.

### AC-2 — 터미널 열기

- **2a (자동, Vitest)**: `buildCommand(adapter, path)` 반환이 expected args 배열. 각 4 adapter × edge case (공백 포함 경로 등).
- **2b (반자동)**: 실기에서 Terminal.app / iTerm2 / Ghostty / cmux 각 1회 E2E. `osascript` 또는 수동 `pwd` 확인.

### AC-3 — 안전 삭제

- `dialog.showMessageBox` 3-button 동작.
- `execFile("git", ["worktree", "remove", ...])` args 검증 (MockGit 주입).
- dirty 시 Force 옵션 경고 분기.
- **자동 grep 검증**: `rg -i "rm -rf|fs\\.rm|fs\\.rmSync|fs\\.unlink" packages/` → 0 hit.

### AC-4 — 등록/해제

- Add Repository native dialog → 경로 검증 → **UI 반영 <500ms**.
- Remove repository 동작.
- 앱 재시작 후 목록 유지 (`electron-store` JSON 파일 확인).

### AC-5 — Main 보호

- Main worktree(첫 항목) row의 Remove 버튼 `disabled`.

### AC-6 — Tier 2 배지 업데이트

- Tier 1 렌더 후 Tier 2 완료 시 dirty worktree row에 배지 (CSS class `.is-dirty`) 추가.
- MockGit 주입 Vitest로 IPC 시퀀스 검증.

---

## Verification Steps (체크리스트)

### Bootstrap

```sh
# scripts/bootstrap-fixtures.sh
set -e
mkdir -p ~/tmp/wt-sandbox && cd ~/tmp/wt-sandbox
rm -rf demo demo-feat-* demo-bugfix-*
git init demo && cd demo
echo hello > README.md && git add . && git commit -m init --no-gpg-sign
for i in $(seq 1 29); do
  git worktree add "../demo-feat-$i" -b "feat/$i"
done
# dirty on feat/3
cd ../demo-feat-3 && echo x >> README.md
```

### Phase 0

- [ ] `pnpm install && pnpm --filter app dev` 실행. Tray 아이콘 표시. Pass/Fail: ___
- [ ] Tray 클릭 → BrowserWindow 하단 정렬 (±10px). Pass/Fail: ___
- [ ] 다른 앱 클릭 → window 숨김. Tray 재클릭 → 복귀. Pass/Fail: ___
- [ ] N=30 row 중 첫 paint <300ms (devtools Performance). Pass/Fail: ___
- [ ] `scripts/cmux-verify.sh` → 새 cmux workspace에서 `pwd` 출력이 지정 경로. Pass/Fail: ___
- [ ] `scripts/ghostty-verify.sh` → Ghostty가 CWD 새 세션 (또는 fallback 채택 기록). Pass/Fail: ___

### Phase 1

- [ ] Add Repository → 경로 선택 → 목록에 즉시 반영 <500ms (**AC-4**). Pass/Fail: ___
- [ ] 검색 input에 "feat/3" 입력 → 매칭 row만. Pass/Fail: ___
- [ ] feat/1 Remove → dialog → 확인 → 목록 제거 + 디스크 제거 (**AC-3**). Pass/Fail: ___
- [ ] feat/3(dirty) Remove → 경고 dialog → Force → 제거. Pass/Fail: ___
- [ ] main row Remove 비활성 (**AC-5**). Pass/Fail: ___
- [ ] 앱 종료 → 재실행 → 등록 repo 유지 (**AC-4**). Pass/Fail: ___
- [ ] 터미널 전환 — Terminal.app / iTerm2 / Ghostty / cmux 각 1회 (**AC-2b**). Pass/Fail: ___
- [ ] `rg -i "rm -rf|fs\.rm|fs\.rmSync|fs\.unlink" packages/` = 0 hits. Pass/Fail: ___
- [ ] `pnpm test` 전부 pass. Pass/Fail: ___

### Teardown

```sh
rm -rf ~/tmp/wt-sandbox
rm -rf ~/Library/Application\ Support/worktree-todo
```

---

## Pre-mortem (1건)

**시나리오**: Tray + BrowserWindow 위치 정렬이 multi-display 환경(메인 모니터 옆 외장 모니터, DPI 다름)에서 깨짐. tray.getBounds() 좌표가 잘못된 display로 계산돼 창이 엉뚱한 모니터에 뜸.

**조기 경보**: Phase 0 (a) 측정 시 외장 모니터 연결 상태에서도 반드시 테스트.

**Fallback**: `screen.getDisplayNearestPoint({x: tray.x, y: tray.y})` 기반 좌표 보정. 실패 시 창을 "항상 메인 디스플레이 중앙"으로 degrade (UX 저하 수용).

---

## Risks & Mitigations (요약)

1. **Tray/Window 정렬 multi-display** — Pre-mortem 참조.
2. **Electron 메모리 상주** — V8 idle GC 주기 (5min) 후 ~120MB 안정화. dev-mode watcher 꺼두면 release는 140MB 수렴. 측정 기준선 확보.
3. **Ad-hoc signed .app Gatekeeper 경고** — 동료 공유 시 "우클릭 → 열기 1회" 안내 문서 동봉.
4. **git <2.35 prunable 부재** — parser graceful + fixture.
5. **cmux `send` workspace 지정 정확성** — Phase 0 spike에서 실측, 실패 시 `select-workspace` 삽입.
6. **contextBridge mis-exposure** — preload에서 `ipcRenderer.invoke` 래퍼만 노출, 전체 `ipcRenderer` 노출 금지. 코드리뷰 체크포인트.

---

## ADR — Architecture Decision Record

### Decision

Electron 30+ / TypeScript / pnpm workspace 기반 macOS 메뉴바 앱으로 MVP 구축. git 상호작용은 `child_process.execFile` via `GitExecutor` interface. `packages/core`는 Raycast extension과 공유.

### Drivers

1. 에이전트 자율 개발 — Xcode GUI 의존성 제거 (방금 raised 실무 blocker).
2. Raycast extension과 stack 통일 (Q1 사용자 주력 Raycast → Phase 1.1에서 핵심).
3. 개발 단순성 유지.

### Alternatives considered

- **Swift + SwiftUI MenuBarExtra** (v2.1 플랜) — 네이티브 UX 최상. 하지만 Xcode GUI 의존, Raycast ext와 2-stack. 기각.
- **Tauri v2** — 메모리/번들 중간지대, Rust 스킬 필요. 에이전트 workers Rust 가능하지만 사용자 onboarding 비용. 수용 가능했으나 사용자 C 선택.
- **React + Electron** — UI 프레임워크 추가 이득 없음 (뷰 100 LOC). 기각.

### Why chosen

- 사용자 결정 (Q: "electron으로 가게 되면 별로일까?" → C).
- 모노레포 코드 공유로 "Phase 1.1 Raycast ext" 개발 비용이 `packages/core` import만으로 거의 0에 가까워짐.
- Xcode 스캐폴딩 실무 blocker 해소.

### Consequences

- **Positive**: 에이전트 workers가 `pnpm` 일원화로 빌드/테스트/배포 전 과정 자동. TS 단일 스택. Raycast ext 레버리지.
- **Negative**:
  - 상주 메모리 ~150MB (개인용 수용).
  - Cold open ~800ms (상시 배경 유지 시 amortize).
  - macOS 메뉴바 네이티브 느낌 손실 (웹 UI 정성 투자로 상쇄).

### Follow-ups

- Phase 2: Electron autoUpdater 또는 Sparkle 래퍼 검토 (공유 빈도 높아질 때).
- Phase 2: Tauri v2 재평가 — 메모리 이슈 표면화 시.
- Phase 3: Apple Developer 계정 가입 여부 결정 → Developer ID signing + notarization.

---

## Next Actions

- [ ] **Team 실행 시작** — 워커 4명 병렬 (scaffold / core / app-main / app-renderer + scripts).
- [ ] Phase 0 spike 완료 후 `.omc/research/phase0-spike.md` 기록 → Phase 1 게이트.
- [ ] 사용자 수동 QA는 Verification 체크리스트로.

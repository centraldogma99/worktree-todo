# Worktree Todo — macOS Menubar App (MVP) — v2.1

> 작업 디렉토리: `/Users/choejun-yeong/open-source/worktree-todo/` (신규, 빈 디렉토리)
> 작성 모드: RALPLAN Consensus (Planner iteration 2 + v2.1 user answers)
> 대상 OS: macOS 13+ (개발 환경 macOS 26.4 / Xcode 26.2 확인)
> 번들 ID: `app.worktree-todo.WorktreeTodo` (Info.plist 고정 — TCC 명령에서 참조되는 canonical id)

---

## v2.1 Changelog (user answers locked)

사용자 답변 반영 (plannotator 2회차):

- **Q1 런처 = A (Raycast 주력)** → Option E 우선순위 상승. **옵션 α 확정**: Menubar MVP (Phase 1) + Raycast Extension (Phase 1.1, TypeScript + Raycast API, git CLI 직접 호출, Swift core 추출 없음).
- **Q2 규모 = 3 repo × 5 worktree ≈ 15** → `.window` 기본값 유지 정당. Tier 1 SLA 가정(repo≤5) 내. `.menu`는 포기 유지.
- **Q3 터미널 = cmux** → **cmux adapter 추가** (Terminal Open Mechanism 섹션 참조). `open -a cmux` 단독으로는 CWD 주입 불가 → `cmux new-workspace` + `cmux send "cd <path>\n"` 2-step. Terminal.app / iTerm2 / Ghostty는 Phase 0·1에 남겨둠.
- **Q4 Phase 0 spike = A (투자함)** → 1-2일 (v2.1 확장) Phase 0 spike 유지.
- **Q5 실행 방식 = A (team)** → `/oh-my-claudecode:team`로 병렬 구현 진행.
- **Q6 Discovery = 기본 등록만** → chpwd 훅 auto-suggest는 Phase 2 이월. Add Repository 버튼만 MVP.
- **Q7 배포 = B (동료 공유 가능성)** → **Apple Developer 계정 미보유 확인**. MVP는 `codesign -s -` ad-hoc 유지. 공유 발생 시 (a) 수신자가 Gatekeeper 우클릭→열기 1회 수행, 또는 (b) v1.1 이후 Apple Developer 가입 + Developer ID signing. notarization은 Phase 3.

### Critic Major 3건 inline 패치

- **M#1**: Tier 1 SLA를 `repo > 5` 시 `min(N, 5)` throttle 및 SLA `<100ms`로 완화 명시 (Refresh Strategy 섹션).
- **M#2**: AC-1b `<100ms` 위반 시 **`Logger.error` 강제 검출** (observational → enforceable).
- **M#3**: Phase 0 예산을 **1-2일** 및 A3를 "baseline 측정만" 허용으로 완화.

### Critic P0-6 minor

- `GitCLI` 스케치 `args[0]` 처리: `"git"` 단일 토큰 시 `/usr/bin/env`로 위임, 절대 경로면 직접 `executableURL` 세팅.

---

## v2 Changelog

Architect/Critic iteration 1에서 제기된 P0·P1 항목을 반영하여 전면 개정.

- **P0-1 `.menu` vs `.window` 결정 재정의**: Phase 0를 `.menu` / `.window` / `NSStatusItem+NSPopover` 세 스켈레톤을 N=30 더미로 비교하는 **spike phase**로 격상. 명시적 exit criteria 추가. **MVP 기본값을 `MenuBarExtra(.window)` + `List` + `TextField` 검색으로 전환** (스케일·키보드 nav 고려). AppKit fallback 경로 확정.
- **P0-2 Raycast strawman 수정**: Option C 기각 사유를 "주력 런처가 Raycast가 아니면 menubar보다 affordance 낮음"으로 재정의. **Option E (Swift CLI core + menubar + Raycast twin UIs)를 ADR Alternatives에 추가**하고 "스코프 연기"로 기각.
- **P0-3 2-tier lazy refresh 설계로 교체**: Tier 1(sync, on-open, `git worktree list`만, <50ms 목표) / Tier 2(async, dirty/locked 배지, 도착 순서 업데이트, 30s TTL 캐시) / Tier 3(unpushed는 lazy, 배지 클릭 시). 취소 정책·동시성 상한 명시.
- **P0-4 모듈 축소 14 → 9 파일**: `WorktreeRepositoryService`·`DirtyStateChecker`·`AppSettings`·`ConfirmRemoveAlert`·`RepositoryManagerView`를 통합/제거. YAGNI.
- **P0-5 `GitExecuting` 프로토콜 + Process async 래핑 명시**: DI 스케치, timeout·cancellation·error surface, `MockGit` 테스트 fixture.
- **P0-6 AC-1, AC-2 자동/수동 분리**: AC-1a/1b, AC-2a/2b로 split. AC-4에 500ms 응답 숫자 추가.
- **P1-1**: Verification Steps를 `- [ ]` 체크리스트 포맷으로 재작성 + teardown 스크립트 추가.
- **P1-2**: git <2.35 prunable 라인 부재 graceful 파싱 + 테스트 케이스 1건.
- **P1-3**: Ghostty 인자 검증을 Phase 0 spike에 포함. 실패 시 fallback 또는 AC-2에서 Ghostty 제외.
- **P1-4**: Ad-hoc signing + TCC reset 고지 추가.
- **P1-5**: Pre-mortem 1건(`.menu` scale 실패 → `.window` fallback 트리거) 추가.
- **Non-interactive default assumption**: Q1=Terminal.app 기본, Q2=새 창 기본(iTerm2 탭 옵트인 Phase 1.1), Q3=1-3 repo × 3-8 wt 기본. 10+ repo / 30+ wt 시 UI 조기 전환 경로 명시.

---

## Confirmed Assumptions (v2.1 locked by user)

사용자 답변(plannotator 2회차) 반영. 이전 non-interactive 기본값 대체.

### Q1 — 주력 런처: **Raycast (주력)**

- 옵션 α: Menubar MVP 먼저(Phase 1) + Raycast Extension (Phase 1.1, ~1-2일).
- 공통 Swift core 추출은 **하지 않음** (YAGNI). Raycast extension은 TypeScript + Raycast API + Node `child_process`로 `git` CLI 직접 호출.
- Menubar의 "상시 노출" affordance + Raycast의 "키보드 즉시 호출" affordance 이중화.

### Q2 — 주력 터미널: **cmux**

- cmux는 libghostty 기반 Swift/AppKit 네이티브 terminal. `open -a cmux`만으로는 CWD 주입 불가 (공식 doc 기준 `new-workspace` CLI 플래그 미지원).
- **TerminalLauncher.cmux 어댑터 별도 경로** (Terminal Open Mechanism 섹션 참조).
- Terminal.app / iTerm2 / Ghostty adapter도 유지(Settings 전환용).

### Q3 — 창/탭 선호: **새 창 (default)**

- cmux는 워크스페이스 단위 → `new-workspace`가 "새 창" equivalent로 작동.
- iTerm2 탭 옵트인 토글은 Phase 1.1 유지.

### Q4 — 규모: **3 repo × 5 worktree ≈ 15**

- `.window` 기본값 유지. Tier 1 SLA(repo≤5) 가정 내.
- `.menu` 스타일은 폐기 유지.

### Q5 — Phase 0 spike: **투자함 (1-2일)**

- 3개 UI 스켈레톤 실측 진행. A3는 "baseline 측정만"으로 경량 허용.

### Q6 — 실행 방식: **team (병렬)**

- `/oh-my-claudecode:team` 스킬로 핵심 파일 분담 구현.

### Q7 — Discovery: **기본 등록만**

- "Add Repository" 버튼 + NSOpenPanel. chpwd 훅 auto-suggest는 Phase 2 이월.

### Q8 — 배포: **B (동료 공유 가능성) + Apple Developer 미보유**

- MVP: ad-hoc (`codesign -s -`) 유지.
- 동료 배포 시 수신자가 Gatekeeper 우클릭→열기 1회 수행 (고지).
- v1.1 이후 Apple Developer 가입 시 Developer ID signing 검토. notarization은 Phase 3.

---

## RALPLAN-DR Summary

### Principles (guiding rules)

1. **Always-visible surface first** — worktree 목록은 상시 한 클릭 거리. "보이지 않으면 잊는다"가 이 앱의 존재 이유.
2. **Delegate to git CLI** — 파싱/트랜잭션은 `git` 바이너리가 담당. libgit2/SwiftGit2 금지(버전 스큐 리스크).
3. **Safe destructive ops** — 삭제는 반드시 `git worktree remove` + 확인 다이얼로그 + dirty 가드. `rm -rf` 금지.
4. **YAGNI — MVP only** — 만들기·머지·원격 싱크·PR 뷰 금지. 보이기·열기·지우기 세 가지만.
5. **Zero external deps** — 네이티브 프레임워크만. SPM 의존성 0개 목표(불가피 시 1개).

### Decision Drivers (top 3)

1. **개발 단순성** (1인 유지보수, 주말 프로젝트 규모)
2. **항상 보이는 UX** (메뉴바 상주가 핵심 요구사항 — "목록이 안 보여서 잊는다"가 문제 #2의 근본 원인)
3. **유지보수 부담 최소화** (Swift/SwiftUI 1-stack, 추가 런타임·패키지·빌드 파이프라인 없음)

### Viable Options

| # | Option | Dev Complexity | Always-visible | Native Feel | Distribution | Extensibility |
|---|--------|----------------|----------------|-------------|--------------|---------------|
| A | **SwiftUI `MenuBarExtra(.window)` (native)** | Low | Yes (메뉴바 상주) | High | `.app` 번들 / Xcode | High |
| B | Tauri/Electron 메뉴바 앱 | Medium | Yes | Medium (Tray API 한계) | DMG/pkg | High but heavy |
| C | Raycast Extension (단독) | Very Low | No (단축키로 호출) | N/A (Raycast 컨텍스트) | Raycast Store | Raycast 생태계에 종속 |
| D | CLI TUI (bubbletea/ratatui) | Medium | No (터미널 포그라운드 필요) | N/A | `brew` tap | Low |
| E | **Swift CLI core + menubar + Raycast (twin UIs)** | Medium-High | Yes (menubar 경로) | High | `.app` + Raycast ext | Very High |

#### Pros/Cons

**Option A — SwiftUI `MenuBarExtra(.window)`**
- ✅ macOS 13+에서 `@main` + `MenuBarExtra(style: .window)` 선언 한 줄로 메뉴바 앱 구축. 드라이버 #2에 정면 일치.
- ✅ `.window` 스타일은 `List` + `TextField` 내장으로 **스크롤·검색·키보드 nav 모두 지원** (10+ worktree scale 대응).
- ✅ `Process` API로 `git worktree list --porcelain` 호출이 간단. 외부 라이브러리 불필요(드라이버 #3).
- ⚠️ `.window` 스타일은 키보드 포커스 관련 버그 보고가 있음 → Phase 0 spike에서 실측 검증. 실패 시 **AppKit `NSStatusItem + NSPopover` fallback** 경로 확정.
- ⚠️ Terminal/iTerm2 자동화에 AppleScript 사용 시 TCC(Automation) 동의 창이 뜸 — 예측 가능, 옵트인.

**Option B — Tauri/Electron**
- ✅ 향후 웹 기반 대시보드로 확장 쉬움.
- ❌ Rust + Node + WebView 툴체인 → 1인 프로젝트에는 과대 투자. 드라이버 #1·#3 위배.
- ❌ 메뉴바 Tray UX가 macOS 네이티브보다 투박함.

**Option C — Raycast Extension (단독)**
- ✅ 개발량 극소. TypeScript + Raycast API만.
- ❌ **재정의된 기각 사유**: "사용자가 Raycast를 주력 런처로 사용하지 않으면 메뉴바보다 affordance가 낮음". "항상 보임" 제약은 Raycast 상시 사용자에게만 성립.
- ❌ 단독 옵션으로는 드라이버 #2 미충족 (사용자의 런처 habit에 종속).
- → 단독 기각. **Option E에서 보조 UI로 부활 가능**.

**Option D — CLI TUI**
- ✅ 터미널 친화적. 서버 환경에도 이식.
- ❌ 메뉴바 상시 노출 불가 → 드라이버 #2 미충족. "잊음" 문제 해결 실패.
- ❌ 터미널 자체를 먼저 열어야 함 → 드라이버 #2·문제 #3 동시 미해결.

**Option E — Swift CLI core + menubar + Raycast (twin UIs)**
- ✅ Core 로직(git 호출·파싱·삭제 안전장치)을 순수 Swift 모듈로 빼고, UI 어댑터를 menubar와 Raycast ext(또는 CLI) 2개로 제공.
- ✅ 드라이버 #2를 menubar가 담당, Raycast 사용자는 추가 affordance.
- ❌ 드라이버 #1 직격 — UI 어댑터 2개 유지. Swift core ↔ Raycast TS ext 간 IPC(예: JSON over stdio)까지 설계 필요.
- ❌ 아직 실사용 패턴(사용자가 Raycast를 얼마나 쓰는지) 미확인.
- → **MVP에서 기각 but "스코프 연기"**. Phase 2 이월. Open Questions에 "주력 런처 Raycast 여부" 추가하여 우선순위 판단.

### Recommendation

**Option A — SwiftUI `MenuBarExtra(.window)` (macOS 13+)** 를 채택한다.

**Invalidation rationale**
- **B 폐기**: 드라이버 #1(개발 단순성) 점수가 A 대비 현저히 낮음. 번들 크기·릴리즈 파이프라인·메모리 모두 열세.
- **C 폐기**: 단독으로는 사용자의 런처 습관에 종속되어 드라이버 #2가 조건부 성립. "항상 보임"의 강함이 약해짐.
- **D 폐기**: 드라이버 #2 미충족 + 문제 #3(터미널 여는 번거로움) 오히려 악화.
- **E 스코프 연기**: 드라이버 #1에서 A보다 열세. Core 분리 자체는 P1 리팩토링으로 달성 가능(테스트성 향상 목적)하지만 Raycast adapter 추가는 Phase 2 이후 수요 확인 후.

→ 유효 후보가 A 1개로 남은 상태. Architect/Critic이 이 근거를 수용하지 않으면 B(웹뷰 선호) 또는 E(twin UIs 조기 착수) 재검토.

### Mode

**SHORT** (표준 consensus). 프로젝트 스코프는 macOS 유틸리티 MVP, 보안·규제 리스크 없음. `--deliberate` 플래그가 명시되지 않는 한 pre-mortem·확장 테스트 플랜은 경량으로 유지(단, P1-5 pre-mortem 1건은 포함).

---

## Context

사용자(시니어 엔지니어)는 `git worktree`를 자주 사용하지만 다음 3개 마찰점을 경험한다:

1. Worktree 목록을 상시 볼 방법이 없음 (`git worktree list` 실행 필요)
2. 완료된 worktree를 삭제하는 것을 잊음 (보이지 않아서)
3. worktree 경로로 터미널을 여는 절차가 번거로움 (경로 복사 → `cd`)

MVP는 세 마찰점을 **한 번의 메뉴바 클릭**으로 해결한다.

---

## Scope

### In-scope (MVP)

- **Repository registration**: 사용자가 루트 git 저장소 1개 이상을 앱에 등록.
- **Worktree discovery**: 등록된 저장소에서 `git worktree list --porcelain`으로 worktree 목록 획득.
- **List UI**: `MenuBarExtra(.window)`에 worktree 목록을 `List`로 표시 (브랜치, 경로, 상태 배지) + `TextField` 필터.
- **Delete action**: 각 항목에서 "Remove" → 확인 다이얼로그 → `git worktree remove [--force]`.
  - Dirty 상태 사전 감지(`git status --porcelain=v2`)로 `--force` 필요 시 경고.
- **Open in terminal action**: 항목 클릭 또는 "Open in Terminal" 메뉴 → 기본 터미널에서 해당 경로로 새 창.
- **Supported terminals**: Terminal.app(기본), iTerm2, Ghostty. 설정에서 택1.
- **Manual refresh**: 메뉴 내 "Refresh" 버튼 (Cmd+R) + 메뉴 열 때 Tier 1 자동 refresh.

### Non-scope (MVP 제외 — 명시)

- Worktree **생성**(`git worktree add`) — v2 이후 검토.
- Merge/rebase/pull/push 등 원격 연동.
- PR/이슈 상태 표시.
- 자동 prune 스케줄링.
- 앱 자동 업데이트(Sparkle 등).
- 공식 배포(App Store, notarization). 개인용 ad-hoc signing만.
- Raycast adapter (Option E, Phase 2 후보).

---

## Discovery Strategy

### 선택지

| 전략 | 장점 | 단점 |
|------|------|------|
| **(1) 루트 저장소 등록제** | 명시적 · 의도 일치 · 불필요한 디스크 스캔 없음 | 등록 UX 필요 |
| (2) `~/worktrees/*` convention 스캔 | 등록 없음 | 사용자가 그 convention을 쓰지 않을 수 있음 · 안 쓰면 빈 화면 |
| (3) 최근 사용 worktree 추적 | 자동학습 | 초기 빈 상태 · 추적 로직 복잡 · "잊는다"가 오히려 재현됨 |
| (4) Spotlight/`mdfind`로 `.git/worktrees/` 검색 | 매우 자동 | 전체 디스크 스캔 · 프라이버시/성능 우려 |

### 결정 — **(1) 루트 저장소 등록제**

**근거**
- 드라이버 #1(단순성): 등록된 경로 N개에서 `git worktree list`만 반복 → 구현량 최소.
- 드라이버 #3(유지보수): 탐색 결과가 결정론적. 디버깅이 쉽다.
- **false-negative 위험 최소화**: 등록한 저장소만 보여주므로 "왜 안 보이지?" 상황이 "등록 안 함"으로 단일화됨.
- convention/추적 전략은 P1에서 **옵션**으로 추가 가능(상호 배타 아님).

**첫 사용 UX**
- 앱 첫 실행 시 빈 목록 + "Add Repository…" 버튼 → `NSOpenPanel` 디렉토리 선택.
- 선택한 경로가 git 저장소인지 `git rev-parse --show-toplevel`로 검증.
- 등록 목록은 `UserDefaults` 또는 `~/Library/Application Support/WorktreeTodo/repos.json`에 저장.

---

## Refresh Strategy (2-tier lazy, v2 재설계)

### 계층 구조

| Tier | 시점 | 명령 | 목적 | SLA |
|------|------|------|------|-----|
| **1 (sync)** | 메뉴 열릴 때 | `git worktree list --porcelain` (repo별 병렬) | 목록·메타데이터 즉시 렌더 | **<50ms (N≤5 repo)** |
| **2 (async)** | Tier 1 렌더 직후 | `git -C <wt> status --porcelain=v2 -uno --no-renames` (worktree별 병렬) | dirty 배지, 도착 순서 업데이트 | 30s TTL 캐시 |
| **3 (lazy, v1.1)** | 배지 클릭 / 상세 뷰 | `git -C <wt> log @{u}..HEAD --oneline` | unpushed 커밋 경고 | on-demand |

### 동시성·취소 정책

- Tier 1은 `TaskGroup`으로 repo 단위 병렬. repo 수 ≤ 5 가정.
  - **v2.1 (Critic M#1)**: repo > 5일 때 `TaskGroup` 병렬도를 `min(N, 5)`로 throttle하거나 SLA를 `<100ms`로 완화. 실측치가 초과하면 `Logger.warning` (Tier 1 ≠ 실패 — Tier 2와 동일 warning 경로).
- Tier 2는 worktree 단위 병렬, **상한 `min(N, 8)` concurrency** (FD 고갈·spawn 비용 가드).
- **메뉴 닫힐 때**: in-flight Task 전부 `cancel()`. 재오픈 시 30s TTL 캐시 히트면 Tier 2 skip.
- Tier 2 결과는 `WorktreeStore` 내 `[Path: DirtyBadge]` 딕셔너리. 도착 즉시 `@Observable` 변경으로 SwiftUI가 해당 row만 re-render.

### UI 반영 SLA

- **메뉴 열기 → worktree 목록 visible: <100ms (N≤15)**.
- Tier 2 배지는 도착 즉시 업데이트(보장 시점 없음, 일반 네트워크 아님 — local git process).
- AC-1에 위 숫자 포함.

### 근거

- "On-open + manual"(구 v1)만으로는 dirty 판정이 메뉴 열림 초기에 묶여 렌더 지연 유발. 2-tier로 분리하여 **체감 응답성 우선**.
- FSEvents(구 v1.1 후보)는 Full Disk Access TCC 이슈 및 FSEventStream 리소스 관리 부담으로 v1.1에서도 보류. Tier 2 + 30s TTL로 충분.

---

## Safety Guards for Delete

1. **Uncommitted changes 사전 감지**: `git -C <path> status --porcelain=v2` 결과가 비어있지 않으면 "Uncommitted changes detected — force remove?" 경고.
2. **Branch unpushed 감지** (Tier 3, lazy, 실패해도 무시): `git -C <path> log @{u}..HEAD --oneline` 결과가 있으면 경고에 추가.
3. **Confirmation dialog**: `NSAlert` with 3 buttons: Cancel / Remove / Force Remove.
4. **Command 사용**: 반드시 `git worktree remove <path>` 또는 `git worktree remove --force <path>`. **절대 `rm -rf` 또는 `FileManager.removeItem` 직접 호출 금지** (git metadata 일관성 파괴 위험).
5. **Prunable 처리**: `git worktree list --porcelain`의 `prunable` 필드가 있으면 배지 표시 + "Prune" 액션 노출(`git worktree prune`).
6. **Main worktree 보호**: 목록에서 main(첫 항목)은 삭제 버튼 비활성화.
7. **git <2.35 graceful degradation** (P1-2): `prunable` 라인 미존재 시 예외 없이 `isPrunable=false`로 파싱. 테스트 케이스 1건 추가.

---

## Terminal Open Mechanism

### 접근 방식 비교

| 방식 | Terminal.app | iTerm2 | Ghostty | cmux | 주의 |
|------|--------------|--------|---------|------|------|
| **`open -a "<App>" <path>`** | ✅ (새 창) | ✅ | ⚠️ 실측 필요 (Phase 0 spike) | ❌ (CWD 주입 불가, 공식 CLI ref) | 가장 단순, TCC 불필요 |
| `open -a Ghostty --args --working-directory=<path>` | N/A | N/A | ⚠️ Ghostty fallback 후보 | N/A | CLI 인자 지원 여부 검증 필요 |
| **`cmux new-workspace` + `cmux send "cd <path>\\n"`** | N/A | N/A | N/A | ✅ (2-step) | cmux 전용 adapter |
| AppleScript (`osascript`) | ✅ 탭/창 제어 | ✅ 상세 제어 | ⚠️ AppleScript 미지원/제한 | ⚠️ 미확인 | TCC Automation 동의 필요 |
| URL scheme | ❌ | ❌ | ⚠️ 미지원(현재) | ⚠️ 미확인 | 비표준 |

### 결정 — **adapter 다원화 (MVP)**: `open -a` 기본, cmux는 전용 2-step adapter, AppleScript는 Phase 1.1 옵트인

**구현 스케치 — 기본 경로**

```swift
// Terminal.app / iTerm2 / Ghostty: open -a 단일 경로
try await shell.run(
    ["/usr/bin/open", "-na", terminalApp.bundleId, path.path],
    cwd: nil
)
```

- `-n` (새 인스턴스) + `-a` (앱 지정). 경로를 마지막 인자로 전달하면 대다수 터미널 앱이 해당 CWD로 새 창/세션 시작.
- **Phase 0 spike 검증 대상**: Ghostty가 `open -a Ghostty /path/to/dir`를 CWD 있는 새 세션으로 여는지 실측. 실패 시 `open -a Ghostty --args --working-directory=<path>` fallback 시도. **두 방법 모두 실패하면 AC-2에서 Ghostty 제외**하고 Open Questions에 기록.

**구현 스케치 — cmux 전용 adapter (v2.1 신규)**

```swift
// cmux는 CLI 바이너리 기반 (PATH에 `cmux` 필요). 2-step:
//   (1) cmux new-workspace  → 새 workspace 생성
//   (2) cmux send "cd <path>; clear\n"  → 새 workspace에 cd 전송
//
// 주의: cmux CLI는 workspace ID를 별도 식별 없이 "마지막 생성/선택"에 대해 동작하는 것으로
// 공식 API reference에 언급됨. Phase 0 spike에서 send 대상 workspace 지정 정확성 실측.
func openCmux(path: URL) async throws {
    _ = try await shell.run(["cmux", "new-workspace"], cwd: nil, timeout: .seconds(3))
    let payload = "cd \(path.path.shellEscaped); clear\n"
    _ = try await shell.run(["cmux", "send", payload], cwd: nil, timeout: .seconds(3))
}
```

- **전제**: cmux CLI가 `PATH`에 있어야 한다. `which cmux` 실패 시 Settings에서 cmux 선택 불가 처리 + 안내 문구.
- **검증**: Phase 0 spike에서 (a) `new-workspace` 직후 `send`가 실제로 그 workspace에 전달되는지, (b) 앱이 foreground로 올라오는지 실측. 실패 시 `select-workspace` 명시 호출을 중간 삽입하는 fallback.
- **Settings 자동 감지**: 첫 실행 시 `which cmux`로 감지하여 우선순위 상단 노출.
- **Fallback**: 앱 설정에서 "Use AppleScript for tabs (iTerm2)" 토글 (Phase 1.1) → iTerm 사용자 중 탭 선호자만 활성. 활성 시 TCC Automation 동의 창 한 번 발생.

**근거**
- 드라이버 #1: `open`은 전역 존재, 인자 2개. 구현량이 1줄.
- TCC 프롬프트 없음 → 첫 실행 마찰 최소화.
- 탭 vs 새 창은 사용자 선호 분기 → 옵트인으로 해결.

---

## Tech Stack Specifics

| 항목 | 선택 | 이유 |
|------|------|------|
| 언어 | **Swift 5.9+** (Xcode 26 기본) | 네이티브, 최신 `Observation` 프레임워크 사용 가능 |
| UI | **SwiftUI `MenuBarExtra(style: .window)`** (macOS 13+) | `List`/`TextField` 사용 가능, 스케일 대응 |
| 최소 타겟 | **macOS 13.0 Ventura** | `MenuBarExtra` 도입 버전 |
| git 호출 | **`Foundation.Process`** + `/usr/bin/env git` via `GitExecuting` 프로토콜 | DI·mock 가능, libgit2 의존성 회피 |
| 저장소 | `UserDefaults`(등록 목록, 설정) | SwiftData 과잉 |
| 로깅 | `os.Logger` (subsystem: `app.worktree-todo`) | Console.app에서 필터 가능 |
| 테스트 | **Swift Testing** (Xcode 26 기본) + XCUITest(UI 검증) | XCTest 대비 가볍고 현대적 |
| 의존성 | **0개** | 드라이버 #3. 불가피 시 argument parsing 한 개만 허용 |
| 서명 | **Ad-hoc signing** (`codesign -s -`) | 개인용. notarization 생략 |
| 배포 | Xcode archive → `.app` → `~/Applications/`에 복사 | App Store 미배포 |

### 서명·TCC 고지 (P1-4)

- **Ad-hoc signing** (`codesign -s - <app>`)은 Apple ID 필요 없음. `.app` 실행 시 Gatekeeper가 "확인되지 않은 개발자" 경고 → 우클릭 → 열기 1회로 통과.
- **TCC 영향**:
  - MVP `open -a` 경로는 TCC 프롬프트 없음.
  - Phase 1.1 AppleScript 옵트인 시 "System Settings → Privacy & Security → Automation → WorktreeTodo" 항목 추가.
  - 권한 꼬임/리셋 시 복구 명령: `tccutil reset AppleEvents app.worktree-todo.WorktreeTodo` (터미널에서 실행, 설정 문서에 기재).

### 왜 Swift Testing?

Xcode 26 번들. `@Test` 매크로로 셋업/티어다운 간결, `#expect` 매크로로 단언. `WorktreeParser`, `TerminalLauncher`, `GitCLI`(mock) 같은 순수 로직을 XCTest 보일러플레이트 없이 빠르게 커버.

---

## File / Module Outline (v2 — 9 파일)

```
WorktreeTodo/
├── WorktreeTodoApp.swift          # @main, MenuBarExtra(.window), Settings scene
├── Domain/
│   ├── Worktree.swift             # struct Worktree { path, branch, head, isMain, isPrunable, isLocked, dirty?, ahead? }
│   └── Repository.swift           # struct Repository { id, rootPath, displayName }
├── Services/
│   ├── GitCLI.swift               # protocol GitExecuting + struct GitCLI 구현 + enum GitError
│   ├── WorktreeParser.swift       # pure function parse(_ porcelain: String) -> [Worktree]
│   └── TerminalLauncher.swift     # open(path:, app:) — Process 인자 빌드
├── Store/
│   └── WorktreeStore.swift        # @Observable. repositories, worktreesByRepo, dirtyBadges, refresh Tier1/2, remove, open
└── UI/
    ├── MenuContentView.swift      # 메뉴 루트: 저장소 섹션 + TextField 검색 + List + 확인 NSAlert
    ├── WorktreeRowView.swift      # 한 줄: 브랜치, 경로(축약), 배지, 액션
    └── SettingsView.swift         # 터미널 선택 + 등록 저장소 관리(Add/Remove) + iTerm 탭 옵트인
Resources/
├── Assets.xcassets
└── Info.plist                     # LSUIElement=YES (Dock 아이콘 숨김)
```

### v1 → v2 통합 내역

- `WorktreeRepositoryService.swift` → `WorktreeStore`에 **병합** (list/remove/prune 모두 Store 메서드로).
- `DirtyStateChecker.swift` → `GitCLI`의 확장 함수 + `WorktreeStore.fetchDirty(for:)`로 흡수.
- `AppSettings.swift` → SwiftUI `@AppStorage` 직접 사용으로 제거.
- `ConfirmRemoveAlert.swift` → `MenuContentView` 내부 헬퍼 함수로 병합 (NSAlert 래퍼 1개).
- `RepositoryManagerView.swift` → `SettingsView`에 **병합** (Settings scene의 섹션 하나로).

### 핵심 타입 스케치 (P0-5)

#### `GitExecuting` 프로토콜

```swift
protocol GitExecuting: Sendable {
    /// args[0]은 보통 "git" 또는 절대 경로. cwd nil이면 현재 프로세스 cwd.
    /// timeout 초과 또는 nonZero exit는 throws.
    func run(_ args: [String], cwd: URL?, timeout: Duration) async throws -> String
}

enum GitError: Error {
    case nonZero(code: Int32, stderr: String)
    case timedOut
    case cancelled
    case launchFailed(underlying: Error)
}
```

#### `GitCLI` 구현 (개념 스케치, 구현 아님)

```swift
struct GitCLI: GitExecuting {
    func run(_ args: [String], cwd: URL?, timeout: Duration = .seconds(5)) async throws -> String {
        try await withCheckedThrowingContinuation { cont in
            let proc = Process()
            // v2.1 Critic P0-6 minor fix:
            //   args[0]이 "git"처럼 이름만 오면 /usr/bin/env 위임, 절대 경로면 직접.
            let first = args[0]
            if first.hasPrefix("/") {
                proc.executableURL = URL(fileURLWithPath: first)
                proc.arguments = Array(args.dropFirst())
            } else {
                proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
                proc.arguments = args   // env first dropFirst arg 등 bash처럼 전체 전달
            }
            if let cwd { proc.currentDirectoryURL = cwd }
            let out = Pipe(); let err = Pipe()
            proc.standardOutput = out; proc.standardError = err
            // readabilityHandler 로 stdout/stderr 버퍼링
            // terminationHandler에서 resume — nonZero면 GitError.nonZero 던짐
            // Task.checkCancellation() 기반 취소 + Timeout Task로 proc.terminate() + .timedOut
            // 실제 구현 시 프로세스 수명과 Task 수명 바인딩 주의
        }
    }
}
```

#### `MockGit` (Swift Testing 용)

```swift
struct MockGit: GitExecuting {
    let scripted: [String: Result<String, GitError>]  // key: args.joined(" ")
    func run(_ args: [String], cwd: URL?, timeout: Duration) async throws -> String {
        switch scripted[args.joined(separator: " ")] ?? .failure(.launchFailed(underlying: NSError(...))) {
        case .success(let s): return s
        case .failure(let e): throw e
        }
    }
}
```

#### `WorktreeStore` DI

```swift
@Observable
final class WorktreeStore {
    private let git: GitExecuting
    init(git: GitExecuting) { self.git = git }
    // refreshTier1() / refreshTier2() / remove(_:force:) / open(_:)
}
```

Tests는 `WorktreeStore(git: MockGit(scripted: ...))`로 생성, real 앱은 `GitCLI()` 주입.

#### `WorktreeParser` (pure)

```swift
enum WorktreeParser {
    static func parse(_ porcelain: String) -> [Worktree]
    // 빈 라인 delimiter, 각 블록은 key[SPACE]value 라인들
    // "worktree <path>", "HEAD <sha>", "branch refs/heads/<name>", "bare", "detached",
    // "locked [<reason>]", "prunable [<reason>]"
    // v2.35 이전 prunable 라인 부재 허용
}
```

---

## Phased Rollout (v2)

### Phase 0 — Spike + Scaffold (**필수**, 1-2일)

v2에서 spike phase로 격상. 다음 3개 스켈레톤을 각각 생성하고 N=30 worktree 더미(스크립트 자동 생성)로 비교.

**v2.1 (Critic M#3)**: A3 `NSStatusItem + NSPopover`는 "baseline 측정만" 허용. 즉 A2 `.window`가 exit criteria를 통과하면 A3는 포팅하지 않고 평가만 skip. 예산 압박을 1일로 절감하고, A2 실패 시에만 2일차에 A3 포팅 착수.

**Spike matrix**

| 스켈레톤 | 스크롤 | 키보드 nav | TextField 검색 | 포커스 버그 |
|---------|--------|-----------|---------------|------------|
| A1 `MenuBarExtra(.menu)` | ? | ? | 불가(메뉴 아이템에 TextField 부적합) | ? |
| **A2 `MenuBarExtra(.window)` + List + TextField** | 예상 ✅ | 예상 ✅ | 예상 ✅ | 검증 필요 |
| A3 `NSStatusItem` + `NSPopover` (AppKit) | ✅ | ✅ | ✅ | AppKit 표준 |

**Exit criteria**
- **최소 1개**가 (a) 스크롤 가능 + (b) Tab/화살표 키보드 nav + (c) TextField 검색 + (d) ESC로 닫기 정상 동작을 모두 충족.
- **최우선 후보는 A2**. 통과 시 A2를 MVP 기본으로 확정.
- A2 실패 시 → A3 (AppKit fallback) 확정. 이 경우 `File/Module Outline`에서 `WorktreeTodoApp.swift` 대신 `AppDelegate.swift` + `StatusItemController.swift`로 조정.
- A1은 `Q3` fallback 기준(10+ worktree)에서 부적합 이미 확인 — 기본값으로 채택하지 않음. 참고 지표용.

**Ghostty 검증 (P1-3)**
- 같은 Phase 0에서 `open -a Ghostty /tmp/ghostty-test` 실측. 새 세션이 해당 dir을 CWD로 여는지 `pwd`로 확인.
- 실패 시 `open -a Ghostty --args --working-directory=/tmp/ghostty-test` 시도.
- 둘 다 실패 시 AC-2에서 Ghostty 제외 + Open Questions에 기록.

**cmux 검증 (v2.1 신규 — 사용자 주력 터미널)**
- `cmux new-workspace` 후 `cmux send "cd /tmp/cmux-test; pwd\n"` 실행 → 새 workspace에서 `pwd` 출력이 `/tmp/cmux-test`인지 확인.
- 새 workspace가 자동 선택/포커스되지 않으면 `cmux select-workspace <id>` 중간 단계 삽입 fallback.
- `which cmux` 실패하는 경우(PATH 문제) Settings에 "cmux CLI not found in PATH — install via…" 안내 문구.

**산출물**
- Xcode 프로젝트 (macOS App, SwiftUI, 최소 타겟 13.0, `LSUIElement=YES`).
- 3개 UI 스켈레톤 브랜치 or 분리 타겟.
- N=30 dummy worktree 생성 스크립트 (`scripts/bootstrap-fixtures.sh`).
- 비교 결과 `.omc/research/phase0-spike.md` 기록.

### Phase 1 — MVP (핵심, 2-3일)

1. `GitCLI` + `GitExecuting` 프로토콜 + `MockGit` (Swift Testing 커버).
2. `WorktreeParser` (porcelain 4 fixture + git <2.35 fallback 케이스).
3. `WorktreeStore` — `refreshTier1()` + `refreshTier2()` 병렬 + TTL 캐시 + cancellation.
4. Repository 등록 UX (`NSOpenPanel` + `UserDefaults` 저장 + `git rev-parse` 검증).
5. `MenuContentView` — 저장소별 섹션, `TextField` 검색, `List` 행.
6. `TerminalLauncher.open(path:, app:)` — `open -a` 경로, 3 터미널 지원.
7. `remove(_:force:)` + NSAlert 3-button + dirty 가드.
8. `SettingsView` — 터미널 선택, 저장소 관리, iTerm 탭 옵트인 토글(비활성 기본).
9. 수동 QA: 실제 worktree 5-8개 시나리오 (Verification Steps 체크리스트 수행).

### Phase 1.1 — QoL + Raycast Extension (완주 후 즉시, 1.5-2.5일)

**QoL 기능**
- Prune 액션 (`git worktree prune`).
- Cmd+R 수동 refresh 단축키.
- 경로 복사 액션 (클립보드).
- Locked worktree 배지.
- iTerm2 AppleScript 탭 열기 (옵트인 활성 시).
- Tier 3 unpushed 감지 (배지 클릭 시 lazy).

**Raycast Extension (v2.1 신규 — 옵션 α)**
- 별도 레포/서브디렉토리(`raycast-extension/`)에 TypeScript + Raycast API로 구현.
- 공통 Swift core 추출 **없음** — Raycast extension은 `child_process`로 `git worktree list --porcelain` / `git worktree remove` / `cmux new-workspace` 직접 호출.
- 기능: 목록 조회, 삭제(확인 프롬프트), 터미널 열기(Raycast preference로 Terminal.app/iTerm2/Ghostty/cmux 선택).
- 등록 repo 목록은 별도 local storage (Raycast `LocalStorage` API, menubar 앱과 독립). 또는 menubar 앱의 `UserDefaults` plist를 read-only로 공유(경로: `~/Library/Preferences/app.worktree-todo.WorktreeTodo.plist`). MVP는 **독립 등록** — 중복 비용 감수 + 구현 단순.
- Raycast Store 배포는 Phase 3.

### Phase 2 — (옵션, 명시적 요청 시에만)

- FSEvents 기반 자동 refresh (TCC·FD 영향 재평가 후).
- Worktree 생성(`git worktree add`) 다이얼로그.
- chpwd 훅 auto-suggest (Q6 이월).
- Swift CLI core 추출 (menubar + Raycast가 common bin 공유하도록 리팩토링).

### Phase 3 — (YAGNI, 수요 확인 후)

- 공개 배포(notarization, Sparkle).

---

## Acceptance Criteria (v2 — 자동/수동 분리)

### AC-1: 목록 표시

- **AC-1a (자동, Swift Testing)**: 고정 porcelain fixture N건 주입 시 `WorktreeStore.refreshTier1()` 후
  - `store.worktrees.count == parsed.count` (N=1, 3, 15, 30 fixture).
  - `Set(store.worktrees.map(\.path)) == expectedPathSet`.
  - prunable/locked 플래그 매핑 정확.
- **AC-1b (반자동, XCUITest 권장 / 수동 허용)**: 앱 실행 → 메뉴 열림 → 첫 3개 + 마지막 3개 worktree row의 text(브랜치 이름)가 화면에 visible.
  - `MenuBarExtra(.window)` 기본. 메뉴 열기 → Tier 1 목록 visible **<100ms** (N≤15 기준).
  - **v2.1 (Critic M#2, enforceable)**: in-app 측정 — `os_signpost`로 `menu-open → first-render` 구간을 기록하고, 초과 시 **`Logger.error("AC-1b breached: \(ms)ms, N=\(count)")`** 로그. QA/사용자 본인이 Console.app에서 `level:error subsystem:app.worktree-todo` 필터로 breach를 `grep` 가능. 단순 `Logger.info`는 금지.

### AC-2: 터미널 열기

- **AC-2a (자동, Swift Testing)**: `TerminalLauncher.open(path:, app:)` 단위 테스트 — 각 (app, path) 조합에 대해 올바른 `Process` `executableURL` + `arguments` 배열 생성.
  - 예: `.terminal("/Users/u/repo")` → `["/usr/bin/open", "-na", "com.apple.Terminal", "/Users/u/repo"]`.
- **AC-2b (반자동)**: 실제 macOS에서 각 터미널별 1회 E2E.
  - Terminal.app / iTerm2: `osascript -e 'tell app "Terminal" to get POSIX path of (current directory of front window)'` (iTerm은 equivalent)로 CWD 자동 확인. 기대값 match.
  - **Ghostty**: 스크립트 자동화 미지원 가능 → 수동 `pwd` 확인 (checklist에 명시). Phase 0에서 Ghostty 부적합 판정 시 이 항목 스킵.

### AC-3: 안전 삭제 (기존 유지 + 자동 검증 강화)

- 항목의 "Remove" 클릭 시 `NSAlert` 3-button 표시.
- 확인 후 `git worktree remove <path>` 실행 (MockGit 주입 테스트로 args 검증).
- dirty 상태일 경우 Force 옵션 경고와 함께 제시.
- **자동**: 코드베이스 grep `rm -rf` / `FileManager.removeItem` → 0 hit (CI 없으면 로컬 `rg` 1회).

### AC-4: 등록/해제 — 응답성 숫자 포함

- "Add Repository"로 폴더 선택 → `git rev-parse --show-toplevel` 검증 통과 → **NSOpenPanel 닫힌 후 500ms 이내 메뉴 반영**.
- "Remove Repository"로 등록 해제 가능.
- 앱 재시작 후 등록 목록 유지(`UserDefaults` 또는 JSON 파일).

### AC-5: Main 보호

- main worktree(첫 항목)의 Remove 버튼이 비활성 상태다. XCUITest 또는 수동 확인.

### AC-6: Tier 2 배지 업데이트 (신규)

- dirty worktree에 배지가 Tier 2 완료 후 나타남 (메뉴 열림 직후엔 미표시 허용, 수 초 이내 반영).
- MockGit 주입 시 테스트로 `store.dirtyBadges[path] == .dirty` 확인.

---

## Verification Steps (v2 — 체크리스트 포맷)

### 사전 준비 (bootstrap)

```sh
# scripts/bootstrap-fixtures.sh 와 동일
mkdir -p ~/tmp/wt-sandbox && cd ~/tmp/wt-sandbox
git init demo && cd demo
echo hello > README.md && git add . && git commit -m init
git worktree add ../demo-feat-a feat/a
git worktree add ../demo-feat-b feat/b
# dirty worktree
cd ../demo-feat-b && echo x >> README.md   # uncommitted
```

### 체크리스트

#### Phase 0 spike

- [ ] A2 `.window` 스켈레톤에서 30개 dummy worktree가 스크롤됨. Pass/Fail: ___
- [ ] A2에서 ↑↓ 키로 row 포커스 이동 정상. Pass/Fail: ___
- [ ] A2 TextField에 `feat`ﾠ입력 시 필터링. Pass/Fail: ___
- [ ] A2 ESC 키로 메뉴 닫힘. Pass/Fail: ___
- [ ] Ghostty `open -a Ghostty /tmp/ghostty-test`로 CWD 새 세션 확인. Pass/Fail: ___
  - Fail → `--args --working-directory` fallback Pass/Fail: ___

#### Phase 1 MVP

- [ ] 앱 실행 → 메뉴바 아이콘 표시 확인. Dock 아이콘 없음 (`LSUIElement=YES`). Pass/Fail: ___
- [ ] "Add Repository…" → `~/tmp/wt-sandbox/demo` 선택 → 메뉴에 main + feat/a + feat/b 3개 표시 (**AC-1b**). Pass/Fail: ___
- [ ] 메뉴 열기 → 목록 visible까지 signpost 로그 확인 <100ms (**AC-1a**). Pass/Fail: ___
- [ ] `feat/a` 항목 클릭 → 설정된 터미널 새 창이 `~/tmp/wt-sandbox/demo-feat-a` CWD로 open. `pwd` 또는 osascript로 확인 (**AC-2b**). Pass/Fail: ___
- [ ] 설정에서 터미널 Terminal.app → iTerm2 → Ghostty 순으로 전환하며 반복 (**AC-2b**, Ghostty는 Phase 0 결과에 따름). Pass/Fail: ___
- [ ] `feat/a` 항목 Remove → NSAlert 3-button → Remove → 목록에서 사라짐. `git worktree list`에서도 사라짐 (**AC-3**). Pass/Fail: ___
- [ ] `feat/b`(dirty) Remove → "Uncommitted changes" 경고 → Cancel → 변경 없음. 재시도 → Force Remove → 제거됨 (**AC-3**). Pass/Fail: ___
- [ ] main 항목의 Remove 버튼 비활성 확인 (**AC-5**). Pass/Fail: ___
- [ ] 앱 종료 후 재실행 → 등록한 저장소 유지 (**AC-4**). Pass/Fail: ___
- [ ] `rg -n "rm -rf|FileManager.*removeItem" WorktreeTodo` → 0 hit (**AC-3 보강**). Pass/Fail: ___
- [ ] NSOpenPanel 닫힘부터 메뉴 반영까지 <500ms (**AC-4**). Pass/Fail: ___
- [ ] dirty worktree 배지가 메뉴 오픈 수초 내 Tier 2로 업데이트 (**AC-6**). Pass/Fail: ___

### 자동 테스트 (Swift Testing)

- [ ] `WorktreeParserTests` — porcelain 샘플 5종 (main only, multiple, prunable, locked, **git <2.35 prunable 부재**) 파싱 검증.
- [ ] `GitCLITests` — `MockGit` 이용한 timeout / nonZero exit / cancellation 케이스.
- [ ] `WorktreeStoreTests` — MockGit 주입하여 refreshTier1 count match, Tier2 dirty 반영, remove args 검증.
- [ ] `TerminalLauncherTests` — `open -a` 인자 빌드 검증 (각 터미널별, AC-2a).

### Teardown

```sh
# 테스트 종료 후 정리
cd ~ && rm -rf ~/tmp/wt-sandbox
# TCC 권한 리셋이 필요하다면 (AppleScript 옵트인을 썼을 경우에만)
tccutil reset AppleEvents app.worktree-todo.WorktreeTodo 2>/dev/null || true
```

---

## Pre-mortem (P1-5)

### 시나리오: `.menu` scale 실패

- **가정**: Phase 0에서 A2 `.window`가 키보드 포커스 버그로 불합격. 팀이 A1 `.menu`로 타협.
- **실제 배포 후**: 사용자가 저장소 3개 추가 + worktree 총 18개 시점에서 메뉴 하단 항목이 스크롤되지 않아 접근 불가. TextField 검색도 불가.
- **조기 경보**:
  - worktree 총 개수 > 15 시점에서 앱이 로그로 경고 (`Logger.warning("worktree count exceeds .menu safe threshold")`).
  - 사용자가 Settings에 "메뉴 렌더 모드" 토글 노출. 기본값 자동 감지.
- **Fallback 경로**:
  - Phase 0 결과에서 A2/A3 중 하나를 반드시 확정 (exit criteria 엄수).
  - `.menu` 단독 배포 금지. 만약 Phase 0에서 둘 다 불합격하면 **MVP 릴리즈 연기**하고 AppKit 커스텀(`NSPopover` + `NSTableView`) 경로로 재착수.

### 기타 Risk → Mitigation

1. **Terminal별 새 창 동작 차이** (iTerm2 기본 설정에 따라 새 탭 vs 새 창)
   - 완화: Settings에 "Always new window" 토글, iTerm2 사용자 대상 가이드 문구 제공. AppleScript 분기는 옵트인(Phase 1.1).
2. **Force remove 오동작으로 작업 손실**
   - 완화: 3-button 다이얼로그(Cancel 기본), unpushed 감지 경고(Tier 3), dirty 시 `git diff --stat` 요약을 경고 본문에 포함.
3. **TCC Automation 동의 프롬프트**
   - 완화: MVP `open -a` 일원화로 회피. AppleScript는 옵트인, 최초 1회 설명 모달로 사용자 예측 가능하게.
4. **Xcode 26 / Swift Testing 런타임 버전차**
   - 완화: `.xcode-version` 파일 유지, `xcodebuild -version` 기록.
5. **등록 저장소가 이동/삭제된 경우**
   - 완화: `refresh()`에서 `git rev-parse` 실패 시 해당 저장소를 "unreachable" 상태로 표시(목록 유지, 배지 경고) + 사용자에게 등록 해제 안내.
6. **Tier 2 Process 동시성 폭발** (신규)
   - 완화: `min(N, 8)` 상한, `DispatchSemaphore` 또는 `TaskGroup` throttle. signpost로 spawn 수 모니터.

---

## Open Questions (v2.1 — 답변 상태)

**✅ 답변 완료 (plannotator 2회차)**:
1. 주력 터미널 — **cmux** (adapter 추가 완료)
2. 창/탭 — **새 창** (cmux는 `new-workspace` = 새 창 equivalent)
3. 규모 — **3 repo × 5 worktree** (`.window` 유지)
4. 주력 런처 — **Raycast** (Phase 1.1에서 Raycast Extension 구현)
5. Phase 0 spike 투자 — **Yes (1-2일)**
6. 실행 방식 — **team**
7. Discovery — **기본 등록만** (chpwd 훅 Phase 2)
8. 배포 — **B (동료 공유 가능), Apple Developer 미보유** (ad-hoc 유지)

**🟡 남은 Open Question (MVP 이후 검토)**:
- **Dirty worktree 자동 알림** (예: 1일 이상 커밋 없는 worktree 배지) — Phase 2 후보.
- **Swift CLI core 추출** (menubar + Raycast가 공통 binary 공유) — Phase 2 후보.
- **공개 배포 의사** (App Store / GitHub release + notarization) — Phase 3 조건부.

---

## ADR — Architecture Decision Record

### Decision

SwiftUI `MenuBarExtra(style: .window)` 기반 네이티브 macOS 메뉴바 앱으로 Worktree Todo MVP를 구축하며, git 상호작용은 전적으로 `GitExecuting` 프로토콜 뒤에서 `Process`를 통해 `git` CLI에 위임한다. UI 스케일 대응을 위해 `.menu` 스타일을 폐기하고 `.window` + `List` + `TextField`를 기본으로 채택하되, Phase 0 spike에서 실패 시 AppKit `NSStatusItem + NSPopover` fallback을 확정한다.

### Drivers

1. 개발 단순성 (1인 주말 프로젝트 스케일)
2. 항상 보이는 UX (문제 #2의 근본 원인 해결)
3. 유지보수 부담 최소화 (외부 의존성 0)

### Alternatives considered

- **B: Tauri/Electron** — 툴체인 과잉, 네이티브 느낌 열세 → 기각.
- **C: Raycast Extension (단독)** — 사용자 런처 습관에 종속, 드라이버 #2 조건부 성립 → 기각.
- **D: CLI TUI** — 메뉴바 상주 불가, 문제 #3 악화 → 기각.
- **E: Swift CLI core + menubar + Raycast (twin UIs)** — **v2.1 업데이트**: 사용자 Q1 답변이 "Raycast 주력(A)"이므로 Raycast adapter는 Phase 1.1로 **승격**. 단 Swift core 추출은 YAGNI 원칙 유지 — Raycast extension이 git CLI를 독립 호출(menubar와 병렬 관계). Swift CLI core 공유 리팩토링은 Phase 2 이월.
- **libgit2/SwiftGit2 사용** — 버전 스큐/빌드 복잡도 증가, CLI로 충분 → 기각.
- **`MenuBarExtra(.menu)` 스타일** — 10+ worktree scale에서 스크롤·검색 불가 → 기본값 폐기.

### Why chosen

- Option A가 드라이버 #1·#2·#3을 모두 동시에 만족하는 유일한 안.
- `.window` 스타일이 스케일 대응(List/TextField/검색) + 표준 SwiftUI 표현력의 교집합.
- macOS 13+ `MenuBarExtra`가 플랫폼 네이티브 솔루션이며, Xcode 26이 이미 설치되어 즉시 착수 가능.
- `Process + git CLI` 조합이 가장 안정적인 git 상호작용 경로이며 SwiftPM 의존성을 0으로 유지.
- Phase 0 exit criteria로 `.window` 실패 시 AppKit fallback 확정 → "외발" 리스크 제거.

### Consequences

- **Positive**:
  - 빠른 MVP(3-4일), 네이티브 UX, 유지보수 용이, macOS 업데이트 자동 적응.
  - `GitExecuting` 프로토콜로 테스트성 확보, 향후 Option E(core 분리)로의 마이그레이션 진입점 제공.
  - 2-tier lazy refresh로 체감 응답성 <100ms.
- **Negative**:
  - macOS 13 미만 사용자 대상 불가 (수용).
  - Linux/Windows 미지원 (수용, 의도적).
  - 터미널 앱 지원은 `open -a`가 처리 가능한 범위로 제한됨(Ghostty는 Phase 0 spike 결과에 따라).
  - `.window` 스타일의 포커스 버그 리스크 — Phase 0에서 차단.
  - Tier 2 Process 동시성 상한을 운영 노하우로 튜닝 필요 (초기 `min(N, 8)` 가드 포함).

### Follow-ups

- Phase 0 spike 결과를 `.omc/research/phase0-spike.md`에 기록 후 Planner 재검토.
- v1.1에서 FSEvents 자동 refresh 재평가 (TCC·리소스 영향 재검증 후).
- Phase 2에서 Option E(twin UIs) 착수 여부를 Open Questions #4 답변으로 결정.
- v2에서 `git worktree add` 다이얼로그 추가 여부를 사용 통계로 결정.
- 외부 공유 수요 발생 시 Phase 3(notarization) 착수.
- iTerm2 탭 선호 사용자 비율에 따라 AppleScript 경로 승격 검토.

---

## Next Actions (Planner → Architect/Critic 핸드오프용)

- [ ] **Architect**: v2에서 반영한 (a) `.window` + `List` + `TextField` 스케일 전략, (b) 2-tier lazy refresh 설계, (c) `GitExecuting` DI, (d) 9파일 outline의 책임 분리가 타당한지 리뷰. 특히 `WorktreeStore`에 병합한 책임이 과하지 않은지.
- [ ] **Critic**: Non-interactive 가정(Q1-3)과 Option E의 "스코프 연기" 기각 사유가 충분한가? Ghostty 부적합 시 AC-2에서 배제하는 결정이 수용 가능한가? Tier 2 동시성 상한 8이 합리적인가?
- [ ] **User**: Open Questions 1-4에 답변하면 Planner가 v3에서 반영. Non-interactive 모드 유지 시 현재 v2 가정으로 착수.
- [ ] **Planner (후속)**: Architect/Critic이 ACCEPT 반환 시 `/oh-my-claudecode:start-work worktree-todo-mvp` 핸드오프. ITERATE 반환 시 v3 작성.

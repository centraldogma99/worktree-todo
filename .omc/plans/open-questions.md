# Open Questions

## worktree-todo-mvp — 2026-04-20

- [ ] **주요 사용 터미널은?** (Terminal.app / iTerm2 / Ghostty / 기타) — 기본값 설정 및 우선 검증 순서 결정.
- [ ] **"새 창" vs "새 탭" 선호는?** — iTerm2 사용 시 AppleScript 옵트인 경로 필요 여부 결정.
- [ ] **등록 저장소 수는 대략?** (1–3개 vs 10+) — 병렬 `git` 호출 개수 튜닝 지표.
- [ ] **Dirty worktree 자동 알림이 필요한가?** (예: 1일 이상 커밋 없는 worktree 배지) — Phase 2 스코프 결정.
- [ ] **향후 공유 의사가 있는가?** (Yes면 Phase 3에서 notarization/배포 파이프라인 필요) — MVP 제외지만 의사결정 조기 필요.
- [ ] **Discovery 대안 선호?** — 루트 등록제 외에 `~/worktrees/*` convention 자동 스캔을 P1에 함께 넣을지 여부.

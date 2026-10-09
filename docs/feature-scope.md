# 기능 범위와 활성 상태 (2026-10-08)

이 문서는 **실제로 연결된 React 화면과 Worker 라우트**를 기준으로 유지하는 기능을 정리합니다. 파일·테이블이 존재한다고 활성 기능인 것은 아닙니다. 최종 기준은 `src/components/layout/Sidebar.tsx`, `src/components/app/AppContent.tsx`, `worker/index.ts`입니다.

## 1. 현재 활성 — 유지

| 기능 | 접근 및 구현 | 결정 |
| --- | --- | --- |
| 오늘 | 메뉴 `today`, `TodayPage` | 핵심 실행 화면, 유지 |
| Inbox | 메뉴 `inbox`, `InboxPage`, `planningState=INBOX` | 빠른 수집과 일정 분류에 필요; 2단계에서 다시 연결 |
| 주간 / 월간 | 메뉴 `week` / `month` | 유지; 화면 통합 여부는 UX 단계에서 평가 |
| 프로젝트 및 Kanban | 메뉴 `projects` | 유지; 마일스톤·결정 기록은 보조 기능 |
| 전체 Todo | 메뉴 `all` | 검색·필터·일괄 수정·Someday/Waiting 항목 접근 가능 |
| 메모 / 낙서장 | 메뉴 `memo` / `scratchpad` | 양쪽 모두 유지, 사용 빈도에 따라 후속 통합 검토 |
| 휴지통 | 메뉴 `trash` | 복원 경로와 데이터 보존을 위해 유지 |
| 설정 | 메뉴 `settings` | Routine, PWA, ICS, JSON 백업·복원, Discord 일괄 설정 유지 |
| Todo 오프라인 큐 | `src/lib/offlineTodoQueue.ts`, `/api/offline/todos/:id` | 부분 오프라인 동기화 유지; 전체 오프라인 앱이라고 소개하지 않음 |

공통 API는 `worker/index.ts`에서 등록된 Todo, 프로젝트, 메모, 캘린더, 설정, Routine, 낙서장, 휴지통, 백업 라우트입니다.

## 2. 화면 코드 존재하지만 비활성 — 보류

| 영역 | 현재 코드 | 상태 및 이유 |
| --- | --- | --- |
| 계획·주간 리뷰·저장된 보기·템플릿 | `PlanningHubPage`, `PlanningPage`, `worker/routes/planning.ts` | `AppContent`와 `worker/index.ts`에 각각 연결되지 않음; 활성 기능으로 홍보하지 않음 |
| Focus Timer·Time Blocking | `TimePlanningPanel`, `worker/routes/time.ts` | 별도 화면·API 미등록; 데이터 모델/백업 호환성을 위해 보존 |
| Insights | `InsightsPage` | 내비게이션·화면 분기 미연결; Focus/Time API 미등록 상태라 단독 노출하지 않음 |
| 개별 Todo 리마인더 | `todo_reminders` 스키마 및 관련 저장 코드 | 개별 예약 UI·5분 Cron 경로가 활성화되지 않음; 매일 21:00 일괄 Discord만 제공 |

`planning.ts`, `time.ts`의 핸들러가 파일에 정의되어 있어도 **`worker/index.ts`에 `app.route`로 등록되지 않았기 때문에** 현재 Worker의 해당 API는 정상 호출할 수 없습니다. 향후 재개하려면 UI·라우트·저장 데이터·E2E를 함께 검증해야 합니다.

## 3. 레거시 API/자료 — 즉시 삭제하지 않음

| 항목 | 실제 상태 | 보존 판단 |
| --- | --- | --- |
| Topic / Music Link | `worker/routes/library.ts`가 `app.route`에 등록되지만 현재 UI 없음 | 외부 연동 사용 여부를 모르는 상태이므로 API·기존 DB 데이터 보존; 새로운 핵심 기능으로 홍보하지 않음 |
| Notion 동기화 / Workers AI 학습 가이드 | 현재 React 진입점·Worker 라우트에서 사용 가능한 연동 흐름 확인 안 됨 | README의 제공 기능 목록에서 제외; 관련 과거 스키마가 있다면 삭제하지 않음 |
| `/api/migrate/local-storage` | 기존 클라이언트 자료 이동용 호환 API가 활성 | 과거 데이터 사용자를 고려해 유지 |
| 이전 UI 검토 문서 | `docs/ui-ux-review.md` | 당시 설계 기록으로 유지하고 이 문서로 현재 상태를 구분 |

## 4. 단계별 정리 원칙

- **이번 2단계:** Inbox 접근 복원, 활성 화면 간 내비게이션 계약 테스트, README·운영 문서 현실화. D1 migration·테이블·레코드 제거 없음.
- **3단계 UX:** 모바일 5탭 내비게이션, 검색 결과 직접 열기, Today 빈 상태, 주간 목표 카드가 반영되었습니다. 후속 UX에서 URL 히스토리 탐색, 키보드 검색, 프로젝트·설정 탭, 보조 글씨 대비 개선 및 320/390/768/1280px 브라우저 레이아웃 검증을 추가했습니다. 메모/낙서장은 목적이 달라 통합하지 않습니다.
- **기능 삭제 제안 전:** Production 백업 → 호출·데이터 참조 분석 → Preview E2E → 영향 범위 검증 순서가 필요합니다. 단순히 페이지가 메뉴에 없다는 이유로 API·DB 테이블을 삭제하지 않습니다.
- **복구 전 주의:** JSON 전체 복원은 **병합이 아니라 기존 데이터 대체**이며 [D1 백업 가이드](runbook/d1-backup-restore.md)대로 별도 백업 및 Preview 테스트가 필요합니다.

## 5. 현재 배포 계약

- PR: 타입 검사, Vitest, Build/Wrangler dry-run, Production 의존성 Audit.
- `main` push: 위 검사 통과 시 GitHub Actions가 Production D1 migration → Worker deploy → health check를 자동 실행.
- Preview 브라우저 E2E는 현재 필수 CI 게이트가 **아님**. [배포 Runbook](runbook/deploy-rollback.md)을 참고하세요.

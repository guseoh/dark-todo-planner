# Dark Todo Planner

개인용 작업·프로젝트 관리 웹 앱입니다. **현재 제공하는 기능**과 **코드만 남아 있는 기능**은 구분합니다.

- **Frontend:** React 18 + Vite
- **API:** Hono + Cloudflare Workers
- **Database:** Cloudflare D1
- **Production:** https://dark-todo-planner.guseoh.workers.dev/

## 현재 사용 가능한 기능

- **오늘 / Inbox:** 오늘의 Todo 관리, 핵심 작업 3개 고정(브라우저별 일일 저장), 미완료 작업 가져오기, 일정이 없는 Todo 수집 후 오늘·내일·Someday·Waiting으로 이동
- **주간 / 월간:** 날짜별 Todo 및 목표 확인·수정
- **프로젝트:** 작업·Kanban / 마일스톤 / 결정 기록 / 분석·관리로 나눈 탭에서 프로젝트별 작업과 자료 링크 관리
- **모바일 탐색:** 주요 4개 화면 + 더보기 메뉴로 모든 활성 화면 접근
- **URL 탐색:** `#/today`, `#/week`, `#/projects`처럼 각 화면의 링크와 브라우저 뒤로·앞으로 가기 지원
- **검색:** Ctrl+K에서 검색한 Todo·메모·프로젝트를 해당 편집창·프로젝트 화면에서 바로 열기
- **전체 Todo:** 검색, 카테고리·상태·우선순위 필터, 다중 선택 및 일괄 변경
- **메모 / 낙서장:** 메모와 Todo·프로젝트 연결, 별도 낙서장 자동 저장
- **휴지통:** Todo 이동, 복원 미리보기, 복원·영구 삭제
- **설정:** 앱 정보 / 자동화·알림 / 데이터·백업 탭에서 Routine Bundle, Discord, PWA, ICS/CSV/Markdown 내보내기, JSON 백업·복원 관리
- **오프라인 변경 큐:** IndexedDB에 일부 Todo 변경을 보관한 뒤 온라인 복구 시 동기화합니다. 전체 화면의 오프라인 사용을 지원하는 것은 아닙니다.

### 실제 동작하는 외부 연동

- **Discord:** Production에서 한국 시간 매일 오후 9시, 설정에 따라 미완료·마감 Todo의 일괄 리마인더를 전송합니다. 웹훅 Secret이 구성된 경우에만 발송합니다.
- **Calendar:** ICS 파일 내보내기를 지원합니다. 외부 캘린더와의 양방향 동기화는 지원하지 않습니다.
- **Cloudflare:** Workers와 D1에 저장하고 GitHub Actions로 Production을 배포합니다.
- **D1 백업:** 키 설정 후 월요일 오전 3시(한국 시간) 주간 Production SQL export를 AES-256-GCM으로 암호화해 GitHub Actions 산출물로 30일간 보관합니다. 복원은 자동 실행하지 않습니다.

**현재 미지원:** 개별 Todo의 특정 시각·5분 주기 알림, Notion 자동 동기화, Workers AI 학습 가이드, Planning/Focus/Insights 화면. 일부 코드·스키마는 향후 검토와 백업 호환성을 위해 남아 있으며 현재 앱에서 접근할 수 없습니다.

기능별 **화면 진입·API 등록 여부·보존 정책**은 [기능 범위 및 상태](docs/feature-scope.md)를 참고하세요.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
npm run auth:hash
```

`npm run auth:hash`에서 사용할 비밀번호를 입력하면 scrypt 해시가 출력됩니다. 저장소 루트에 Git으로 추적하지 않는 `.dev.vars`를 만듭니다.

```dotenv
AUTH_USERNAME=your-username
AUTH_PASSWORD_HASH=scrypt$16384$8$5$generated-salt$generated-hash
SESSION_SECRET=at-least-32-random-characters
```

로컬 D1 migration을 적용한 뒤 실행합니다.

```bash
npm run db:migrate:local
npm run dev
```

Wrangler가 표시하는 로컬 주소에서 로그인할 수 있습니다.

## 검증·배포

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

PR에서는 타입 검사·단위 테스트·백업 암호화 검증·빌드·의존성 감사와 **로컬 Worker/D1 HTTP 스모크와 Chromium 브라우저 E2E**를 진행합니다. **`main`에 push 또는 PR 병합하면** 모두 통과한 뒤 **Production D1 migration → Worker 배포 → /api/health 확인**을 자동으로 수행합니다. Preview 원격 환경에서의 복원 훈련은 현재 필수 CI 단계가 아닙니다.

실제 운영 절차와 데이터 복구 주의사항은 [배포·롤백 Runbook](docs/runbook/deploy-rollback.md) 및 [D1 백업 Runbook](docs/runbook/d1-backup-restore.md)을 참고하세요.

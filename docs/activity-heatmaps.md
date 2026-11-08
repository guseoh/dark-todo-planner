# 개발 활동 (GitHub + Codex 잔디)

## 확정된 UX
- 별도 \`#/activity\` 화면. Today/Project/Calendar에는 잔디를 추가하지 않는다.
- GitHub 기여 달력은 초록, Codex 활동은 파랑. 둘을 합산하거나 하나의 생산성 점수로 표현하지 않는다.
- 다크/라이트 모두 Neutral Black 계열, 최소한의 패널/구분선. 전체 정보가 없는 경우 실제 0으로 채우지 않는다.
- 365일 범위를 사용하고, 각 출처별 활동일과 정확한 합계가 있을 때만 합계를 보여준다.

## GitHub (자동)
- Server Worker \`GET /api/activity/github\`, 반드시 로그인 필요. 브라우저는 GitHub 토큰에 직접 접근하지 않는다.
- 기본: \`https://github.com/users/guseoh/contributions\` 공개 달력 HTML. \`td[data-date][data-level]\`와 해당 \`tool-tip\` 숫자를 결합한다. 정확한 기여 건수가 없으면 0을 만들어내지 않고 \`null\`로 응답한다. GitHub 비공개 활동의 세부 정보는 포함하지 않는다.
- 선택적: GitHub GraphQL \`contributionsCollection.contributionCalendar\`. Worker 전용 \`GITHUB_ACTIVITY_TOKEN\` Secret이 있을 때 공식 GraphQL을 우선 사용한다. 배포 설정: \`npx wrangler secret put GITHUB_ACTIVITY_TOKEN --env production\`. **토큰 설정은 자동으로 하지 않는다.**
- 한 Worker isolate에서 한 시간 메모리 캐시/동시 요청 중복 제거. 장애 시 마지막 캐시가 있으면 \`stale: true\`, 없으면 503. GitHub HTML은 비공식 엔드포인트여서 형식이 바뀌면 업데이트가 필요하다.
- API와 배포 Health 성공만으로 실제 GitHub 외부 사이트가 운영 Cloudflare Worker에서 정상 연결된다고 단정하지 않는다. 사용자 로그인 후 실제 기여 데이터 표시 확인이 필요하다.

## Codex (사용자 동의/내 기기)
- 기본: 프로젝트 스크립트 \`scripts/export-codex-activity.ps1\` (Windows PowerShell 5.1 이상)로 \`~/.codex/sessions\`와 \`archived_sessions\`의 **파일 이름만** 읽어 세션 시작일별 개수를 집계한다. 원본 JSONL의 내부 프롬프트·소스 코드는 전혀 읽지 않는다.
- 스크립트 실행(다운로드받은 코드를 검토한 뒤):
  \`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-codex-activity.ps1\`
- 파일 출력: \`codex-activity.json\` 내 \`{ "version":1, "source":"codex-local-sessions", "metric":"sessions", "days":[{"date":"2026-11-08","count":2}] }\`.
- 브라우저 파일 선택 → 입력 구조 검증 → **localStorage 저장만**. HTTP 업로드와 D1 저장 없음. 같은 PC/브라우저 프로필 내에서만 보인다. 가져오기/지우기는 사용자가 직접 수행한다. 자동 동기화한다고 표기하지 않는다.
- Codex App Server \`account/usage/read\`에서 반환하는 \`dailyUsageBuckets\` JSON도 지원하며 이때는 **토큰 수**로 표시한다. 세션 수와 토큰 수를 혼동하지 않는다.
- 로컬 로그는 모든 기기·클라우드 작업을 포괄하지 않을 수 있다. 임의로 누락 날짜를 0이라고 추측하지 않는다.

## 검증 대상
- 탐색·해시·명령 팔레트, 320/390/768/1280/1920px 및 다크/라이트 overflow/접근성.
- GitHub HTML/GraphQL 파싱 유닛, 실패 시 가짜 잔디 없이 오류 표시.
- Codex 정상 aggregate/공식 daily buckets/유효하지 않은 JSONL/중복 날짜/잘못된 날짜 방어.
- IndexedDB/D1에 Codex raw log나 통계가 쓰이지 않는지 Browser smoke.
- 기존 Todo CRUD/오프라인 재시도/Calendar/프로젝트 Regression 유지.

## 참고
- GitHub 공식 GraphQL 기여 달력: https://docs.github.com/en/graphql/reference/users
- Codex App Server account/usage/read: https://learn.chatgpt.com/docs/app-server

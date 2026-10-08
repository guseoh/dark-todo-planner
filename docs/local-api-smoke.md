# 로컬 Worker·D1 E2E + Chromium 브라우저 검증

CI에서는 Production에 데이터를 쓰지 않습니다. `Local Worker + D1 API smoke` 잡이 완전히 분리된 GitHub Runner에서 로컬 D1 migration을 적용하고 Wrangler 개발 서버를 시작합니다.

검증 순서: /api/health → 비로그인 API 401 → 임시 계정 로그인 → 클라이언트 UUID Todo 생성 및 동일 요청 재실행(멱등성) → 제목·관련 링크 수정 → 완료 → 휴지통 이동 → 복원 미리보기 → 복원 → 로컬 데이터 정리.

- `scripts/prepare-smoke-auth.mjs`: CI에서 일회용 계정·비밀번호·세션 Secret을 생성합니다. Production 인증 정보는 사용하지 않습니다.
- `scripts/smoke-local-api.mjs`: loopback IP/호스트 이외의 URL을 거부합니다. Production/Preview를 대상으로는 실행할 수 없습니다.
- `deploy-production` 잡은 **타입·단위 테스트/백업 암호화 검증/빌드 + 로컬 Worker·D1 API smoke 양쪽이 통과해야** 시작합니다.
- API 테스트 뒤 CI에서만 격리된 폴더(.ci-browser-runner)에 고정된 Playwright 드라이버를 임시 설치하고 GitHub Runner에 설치된 Chrome을 이용해 **실제 브라우저 E2E**를 실행합니다.
- 모바일 390px 화면에서 로그인, 고정 5탭·더보기 탐색, 설정의 백업 카드, Today Todo 추가, Ctrl+K 검색 결과로 해당 Todo 편집, 오프라인 작업 생성, 재연결 동기화 및 새로고침 후 보존을 검사합니다.
- 전체 브라우저 흐름도 **로컬 Worker·D1만** 사용하고 Production/Preview URL은 실행 시작 시 거부합니다. 실패 시 테스트용 데이터만 포함하는 스크린샷을 7일간 아티팩트로 남깁니다.
- 개인 장치·다양한 브라우저와 실제 Preview 복원 훈련을 대체하지는 않습니다.
- 정상화 및 D1 Time Travel 복구 훈련은 [D1 백업·복구 Runbook](runbook/d1-backup-restore.md)의 Preview 전용 절차에 따릅니다.

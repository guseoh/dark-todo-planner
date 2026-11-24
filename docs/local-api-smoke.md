# 로컬 Worker·D1 API 검증

운영 Worker는 API 전용입니다. 로컬 API 회귀는 React/Vite를 빌드하지 않고 GitHub Runner의 격리 D1에 migration을 적용합니다. `api-check.yml`은 백엔드 PR과 운영 배포 전, 주간 회귀에서 재사용됩니다.

- `scripts/prepare-smoke-auth.mjs`: CI용 일회용 계정·세션을 생성합니다.
- `scripts/smoke-local-api.mjs`: loopback 전용. API health, 웹 경로 JSON 404, 비로그인 401, 로그인, CRUD, 멱등성, 백업·복원·트랜잭션 롤백을 검증합니다.
- 운영 배포는 이 격리 테스트를 통과해야 합니다. 운영 D1에는 CI 테스트 데이터를 쓰지 않습니다.
- 기존 Chromium 웹/PWA 회귀 스크립트는 이력 참고용이며 더 이상 운영 CI에서 호출하지 않습니다. Windows 앱 QA는 [Windows 체크리스트](tern-windows-qa.md)를 따릅니다.
- D1 복구 훈련은 [D1 백업·복구 Runbook](runbook/d1-backup-restore.md)의 Preview 전용 절차를 사용합니다.

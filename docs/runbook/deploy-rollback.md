# Worker 배포 및 롤백 Runbook

개인용 Todo Planner의 Preview·Production 수동 배포와 Worker 코드 롤백 절차입니다. 배포와 롤백은 자동화하지 않으며, 대상 환경을 확인한 뒤 소유자가 직접 실행합니다.

## 배포 전 확인

`main`을 최신화하고 아래 검증이 모두 성공한 커밋만 배포합니다.

```bash
git switch main
git pull --ff-only origin main
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

## Preview 배포

1. 기존 npm script로 Preview에 배포합니다.

```bash
npm run deploy:preview
```

2. [Preview health endpoint](https://dark-todo-planner-preview.guseoh.workers.dev/api/health)가 HTTP 200과 다음 응답을 반환하는지 확인합니다.

```json
{ "status": "ok", "database": "connected" }
```

3. Preview에 로그인한 뒤 임시 Todo를 생성하고, 수정하고, 완료 상태를 전환하고, 삭제해 핵심 CRUD를 확인합니다.
4. 확인에 실패하면 Production을 배포하지 말고 원인을 먼저 해결합니다.

## Production 배포

Preview 확인을 통과한 같은 `main` 커밋만 기존 npm script로 Production에 배포합니다.

```bash
npm run deploy:production
```

배포 후 [Production health endpoint](https://dark-todo-planner.guseoh.workers.dev/api/health)의 HTTP 200과 D1 연결 응답을 확인합니다. 이어서 Production에 로그인하고, 식별하기 쉬운 임시 Todo로 생성·수정·완료 전환·삭제를 확인합니다.

## Worker 롤백

아래 문법은 2026-07-28에 프로젝트에 설치된 Wrangler `4.114.0`의 실제 `deployments list --help`와 `rollback --help` 출력으로 확인했습니다. 롤백은 선택한 버전으로 새 Deployment를 만들어 즉시 활성화하므로 환경과 version ID를 다시 확인합니다.

### Wrangler

1. 문제가 발생한 환경의 최근 Deployment와 안정 버전의 version ID를 확인합니다.

```bash
npx wrangler deployments list --env preview
npx wrangler deployments list --env production
```

두 명령을 모두 실행할 필요는 없습니다. 실제 롤백 대상 환경의 명령만 실행합니다.

2. 해당 환경의 안정 version ID를 명시해 롤백하고, Wrangler의 확인 프롬프트를 검토한 뒤 승인합니다.

```bash
npx wrangler rollback <version-id> --env preview
npx wrangler rollback <version-id> --env production
```

역시 실제 대상 환경의 명령 하나만 실행합니다. 완료 후 해당 환경의 `/api/health`, 로그인, 핵심 CRUD를 다시 확인합니다. 자세한 동작은 [Cloudflare Workers Rollbacks 문서](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)를 참고합니다.

### Cloudflare Dashboard

1. Cloudflare Dashboard의 **Workers & Pages**에서 대상 Worker를 선택합니다.
   - Preview: `dark-todo-planner-preview`
   - Production: `dark-todo-planner`
2. **Deployments**에서 되돌릴 안정 버전 오른쪽의 점 세 개 메뉴를 열고 **Rollback**을 선택합니다.
3. Worker 이름과 버전을 다시 확인하고 롤백을 승인합니다.
4. 완료 후 해당 환경의 health endpoint, 로그인, 핵심 CRUD를 확인합니다.

## D1 주의사항

Worker 롤백은 D1 데이터나 이미 적용한 migration을 자동으로 되돌리지 않습니다. 이전 Worker 코드와 현재 D1 schema가 호환되지 않으면 Worker만 롤백하지 말고 영향을 먼저 확인합니다.

데이터 손상이나 D1 복구가 필요하면 [D1 백업 및 Time Travel 복구 Runbook](d1-backup-restore.md)을 따릅니다. D1 복구는 이 배포 절차나 CI에 결합하지 않습니다.

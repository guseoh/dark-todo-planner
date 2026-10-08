# Worker 배포 및 롤백 Runbook

현재 배포는 **GitHub Actions의 자동 Production 배포**가 기본입니다. `main` push(또는 PR 병합) 및 수동 `workflow_dispatch` 실행 시 검증을 통과하면 Production D1 migration을 적용하고 Worker를 배포합니다. 이 문서의 직접 `wrangler` 명령은 수동 Preview 검증·장애 대응용입니다.

## 자동 Production 배포

[CI 워크플로](../../.github/workflows/ci.yml)의 실제 순서는 다음과 같습니다.

1. PR에서 `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`를 실행합니다. PR은 **Production 배포를 하지 않습니다**.
2. `main` push 또는 `workflow_dispatch`에서는 검사 성공 뒤 `Deploy production` 잡이 실행됩니다.
3. Cloudflare API Token/Account ID Secret을 확인하고 `npm run db:migrate:production`으로 Production D1 migration을 적용합니다.
4. `npm run deploy:production`으로 Worker를 배포하고 [Production health](https://dark-todo-planner.guseoh.workers.dev/api/health) HTTP 200을 확인합니다.

**주의:** 현재 자동화에는 로그인 후 CRUD 브라우저 E2E와 Preview 승인이 필수 게이트로 연결돼 있지 않습니다. PR 검증 통과만으로 사용자 데이터 복원이나 로그인·동작 확인까지 보증하지 않습니다. Migration을 추가하거나 파괴적 기능을 변경할 때는 병합 전에 별도 Preview 검증 및 백업을 수행하세요.

## 로컬 검증 및 수동 Preview

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run deploy:preview
```

Preview가 필요할 때만 [Preview health](https://dark-todo-planner-preview.guseoh.workers.dev/api/health)에서 `{"status":"ok","database":"connected"}` 응답을 확인하고, Preview 계정으로 임시 Todo의 생성·수정·완료·휴지통 이동·복원을 검사합니다. Preview 환경과 Production은 별도 D1을 사용합니다.

## 수동 Production 배포 (예외)

CI가 아닌 수동 배포가 필요하면 배포할 커밋, Cloudflare 환경, 보관한 D1 백업을 확인하세요. `main`을 최신화하고 **CI 성공 커밋**인지를 재검증한 뒤 `npm run db:migrate:production`, `npm run deploy:production`을 차례대로 실행합니다. 이후 Production health와 로그인·주요 CRUD를 확인합니다. GitHub Actions가 이미 같은 커밋을 배포한 경우 불필요한 중복 배포를 피하세요.

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

# D1 백업 및 Time Travel 복구 Runbook

이 절차는 Cloudflare D1의 원격 SQL export와 Time Travel 복구를 다룹니다. `backups/`는 Git에 포함되지 않으므로 필요한 보관 정책에 따라 별도 안전한 저장소에 복사합니다.

> **경고:** Time Travel restore는 대상 데이터베이스를 제자리에서 덮어쓰고 진행 중인 쿼리와 트랜잭션을 취소합니다. 복구 훈련은 Preview에서만 수행합니다. Production에는 export만 수행하고 npm script나 CI에서 restore를 실행하지 않습니다.

## 사전 조건

- Cloudflare 인증이 된 계정 또는 D1 권한이 있는 API 토큰을 사용합니다.
- `wrangler.jsonc`의 환경별 `DB` binding이 올바른 데이터베이스를 가리키는지 검토합니다.
- Time Travel 지원 여부는 `version: production`으로 확인합니다. `version: alpha` 데이터베이스에는 이 절차를 적용하지 않습니다.

```bash
npx wrangler d1 info DB --env preview
npx wrangler d1 info DB --env production
```

## SQL export

각 명령은 `wrangler d1 export DB --env <environment> --remote`에 출력 경로를 전달하며, `backups/d1/<environment>/`에 Windows 파일명으로도 안전한 UTC ISO-8601 timestamp SQL 파일을 만듭니다. 스크립트는 export 실행 오류, 비정상 종료, 파일 누락 또는 빈 파일을 실패로 처리합니다.

```bash
npm run db:backup:preview
npm run db:backup:production
```

Production export 파일은 접근 제어된 보관 위치로 복사하고, 파일명·실행 시각·실행자를 기록합니다.

## 현재 bookmark 조회

변경 또는 복구 전 대상 환경의 현재 bookmark를 작업 기록에 저장합니다.

```bash
npx wrangler d1 time-travel info DB --env preview
npx wrangler d1 time-travel info DB --env production
```

특정 시각의 복구 지점을 미리 확인하려면 RFC3339 또는 Unix 초 timestamp를 전달합니다.

```bash
npx wrangler d1 time-travel info DB --env preview --timestamp="2026-07-27T09:00:00Z"
```

## Preview 복구 훈련

1. Preview의 현재 bookmark와 SQL export를 보관합니다.
2. 훈련용 변경을 Preview에만 적용하고 영향 시각을 UTC로 기록합니다.
3. 복구할 timestamp 또는 bookmark를 결정합니다.
4. 아래처럼 **Preview에만** 수동 restore를 실행하고 confirmation에 응답합니다.

```bash
npx wrangler d1 time-travel restore DB --env preview --timestamp="2026-07-27T09:00:00Z"
# 또는
npx wrangler d1 time-travel restore DB --env preview --bookmark=<bookmark>
```

5. 출력의 `previous_bookmark`를 작업 기록에 즉시 저장합니다. 이것이 복구 취소 지점입니다.
6. 다음 핵심 테이블의 건수를 확인하고 훈련 전 기대값과 비교합니다.

```bash
npx wrangler d1 execute DB --env preview --remote --command "SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users UNION ALL SELECT 'categories', COUNT(*) FROM categories UNION ALL SELECT 'todos', COUNT(*) FROM todos UNION ALL SELECT 'tags', COUNT(*) FROM tags UNION ALL SELECT 'reflections', COUNT(*) FROM reflections UNION ALL SELECT 'goals', COUNT(*) FROM goals UNION ALL SELECT 'memos', COUNT(*) FROM memos UNION ALL SELECT 'topics', COUNT(*) FROM topics UNION ALL SELECT 'music_links', COUNT(*) FROM music_links UNION ALL SELECT 'focus_sessions', COUNT(*) FROM focus_sessions;"
```

7. 애플리케이션 health check와 핵심 화면을 확인한 후, 결과와 bookmark를 기록합니다.

## 복구 취소 (undo)

restore 결과의 `previous_bookmark`는 복구 직전 상태를 가리킵니다. 해당 값을 잃지 않도록 티켓 또는 보안 작업 기록에 보관합니다. Preview 훈련을 되돌릴 때만 다음 명령을 수동 실행합니다.

```bash
npx wrangler d1 time-travel restore DB --env preview --bookmark=<previous_bookmark>
```

이 명령도 새 `previous_bookmark`를 반환하므로, 추가 복구 가능성을 위해 매번 값을 기록합니다.

## Production 복구 전 확인

Production restore는 자동화하지 않으며, 명시적인 사고 대응 승인 후에만 수동으로 검토합니다. 실행 전 모두 확인합니다.

1. 대상이 `wrangler.jsonc`의 Production `DB` binding이며 `d1 info` 결과가 `version: production`이다.
2. 정확한 사고 시각, 복구할 timestamp/bookmark, 현재 bookmark 및 가장 최근 SQL export가 기록되어 있다.
3. Preview에서 같은 timestamp/bookmark로 복구 훈련과 핵심 테이블 건수 검증을 완료했다.
4. 사용자 영향, 진행 중인 요청 취소, 복구 창 및 담당자 승인을 확인했다.
5. restore 출력의 `previous_bookmark`를 즉시 보관하고, 검증 실패 시 이를 사용한 수동 되돌리기 계획이 있다.

Production restore를 실제로 승인받은 경우에도 이 문서의 Preview 명령을 복사해 환경과 대상 DB를 독립적으로 재검토한 뒤 수동 실행합니다. Production restore 명령을 package.json, CI 또는 자동화 스크립트에 추가하지 않습니다.

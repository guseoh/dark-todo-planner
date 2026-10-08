# D1 백업 및 Time Travel 복구 Runbook

이 절차는 Cloudflare D1의 원격 SQL export와 Time Travel 복구를 다룹니다. `backups/`는 Git에 포함되지 않으므로 필요한 보관 정책에 따라 별도 안전한 저장소에 복사합니다.

> **경고:** Time Travel restore는 대상 데이터베이스를 제자리에서 덮어쓰고 진행 중인 쿼리와 트랜잭션을 취소합니다. 복구 훈련은 Preview에서만 수행합니다. Production에는 export만 수행하고 npm script나 CI에서 restore를 실행하지 않습니다.

## 앱 내 JSON 전체 복원의 제한과 안전 검사

**2026-10-08 이후 전체 JSON 복원은 v13 내보내기 파일만 허용**합니다. 화면과 Worker가 동일한 복원 전 검사기를 사용해 실제 export에 포함되는 **25개 컬렉션**, 낙서장, 항목 필수 필드, 중복 및 핵심 연결 정보를 확인합니다. 하나라도 빠지거나 불완전하면 **DB를 수정하기 전에 400으로 거절**합니다. 기존 `/api/migrate/local-storage`는 별도의 레거시 이전 경로이므로 전체 복원 정책이 적용되지 않습니다.

단, **JSON 전체 복원은 여러 D1.batch 호출로 이루어진 여러 단계 처리이며 단일 원자적 트랜잭션이 아닙니다.** 입력 형식 검증이 통과하더라도 용량 제한·DB 오류·동시 수정 등으로 중간 실패 시 일부만 교체될 수 있습니다. 따라서 Production에서 실제 복원을 하기 전에는 **SQL/D1 백업을 별도로 확보**하고 Preview 또는 일회성 로컬 D1에서 동일 백업으로 복원 훈련을 마쳐야 합니다. 성공 응답을 받더라도 Todo·프로젝트·메모·Routine 등 핵심 데이터를 다시 확인하세요.

`learningItems`, `todoReminders`, `todoDependencies`는 과거 백업 스키마에 이름만 존재하며 현재 JSON export/import가 완전하게 왕복시키는 범위에 포함되지 않습니다. 이 배열에 항목이 있다면 JSON 복원을 거절합니다. 특히 현재 DB에 개별 Todo 알림이 있거나 학습 항목이 Todo에 연결되어 있으면, Todo 교체 시 연동이 손상될 수 있어 409로 복원을 거절합니다. **앱 JSON 파일만으로 모든 D1 테이블을 복구할 수 있다고 판단하지 마세요.**

로컬 CI는 버전·배열이 누락된 백업 거절 후 Todo가 그대로 남는지 검사하고, 일회성 D1에만 정상 export→import→조회 테스트를 수행합니다. Preview 원격 DB를 실제로 초기화하거나 복원하는 테스트는 별도 승인 절차에서만 진행합니다.

## 암호화된 주간 Production D1 백업

[Encrypted Production D1 Backup](../../.github/workflows/d1-backup.yml)은 매주 **월요일 오전 3시(한국 시간)** 및 수동 `workflow_dispatch`로 실행됩니다. `wrangler d1 export --remote`를 통해 **읽기 전용** SQL export를 만들고, AES-256-GCM으로 인증 암호화한 뒤 평문 SQL 파일을 CI 실행 환경에서 삭제합니다. **GitHub Actions에는 `.d1enc` 암호문만 업로드**하며, 산출물 보존 기간은 30일입니다.

### 반드시 필요한 Secret

기존 Cloudflare API Token과 Account ID 외에 GitHub의 `production` Environment Secret **`D1_BACKUP_KEY_B64`**가 필요합니다. 이 값은 CSPRNG로 생성한 랜덤 **32바이트 키를 Base64**로 인코딩한 값이어야 하며 GitHub Secret 설정과 별도로 오프라인 보관해야 합니다. 채팅이나 저장소에는 절대 붙여넣지 않습니다.

Windows PowerShell 5에서도 다음 명령으로 생성할 수 있습니다.

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

이 키를 `Settings → Environments → production → Environment secrets`에 등록하고, 출력값 자체는 안전한 별도 저장소에 보관하세요. **키가 없거나 잘못된 경우 자동 백업이 실패하며, 백업 완료로 표시하지 않습니다.** 키를 잃으면 기존 백업을 복호화할 수 없습니다.

### 백업 다운로드와 검증

GitHub Actions에서 성공한 `Encrypted Production D1 Backup` 실행의 `production-d1-encrypted-...` 아티팩트를 다운로드합니다. ZIP에서 `.sql.d1enc` 파일을 꺼낸 뒤 별도의 안전한 환경에서 복호화합니다.

```bash
# D1_BACKUP_KEY_B64를 터미널 환경변수에 비밀로 입력한 후 실행
node scripts/d1-backup-crypt.mjs decrypt path/to/backup.sql.d1enc path/to/recovered.sql
```

복호화는 AES-GCM 인증 태그가 맞지 않으면 오류가 발생합니다. **이 파일을 Production에 직접 적용하지 마세요.** 아래의 'SQL export에서 새 D1 복원' 절차처럼 **새 검증용 D1**에서 테이블·데이터를 확인하고, 기존 Production 백업을 따로 확보한 상태에서만 복구 계획을 세웁니다.

GitHub 아티팩트 30일 만료 이전에 보관 정책에 맞는 **별도의 접근 제어된 저장소**로 암호문을 복사해야 장기 백업이 됩니다. 백업의 실행·암호화·업로드 성공은 실제 DB 복원의 성공을 뜻하지 않습니다. Preview 복원 훈련은 수동으로 별도 확인해야 합니다.



## 사전 조건

- Cloudflare 인증이 된 계정 또는 D1 권한이 있는 API 토큰을 사용합니다.
- `wrangler.jsonc`의 환경별 `DB` binding이 올바른 데이터베이스를 가리키는지 검토합니다.
- Time Travel 지원 여부는 `version: production`으로 확인합니다. `version: alpha` 데이터베이스에는 이 절차를 적용하지 않습니다.

```bash
npx wrangler d1 info DB --env preview
npx wrangler d1 info DB --env production
```

## SQL export

각 명령은 `wrangler d1 export DB --env <environment> --remote`에 출력 경로를 전달하며, `backups/d1/<environment>/`에 Windows 파일명으로도 안전한 UTC ISO-8601 timestamp와 고유 suffix를 포함한 SQL 파일을 만듭니다. 스크립트는 export 실행 오류, 비정상 종료, 파일 누락 또는 빈 파일을 실패로 처리합니다.

```bash
npm run db:backup:preview
npm run db:backup:production
```

Production export 파일은 접근 제어된 보관 위치로 복사합니다.

## SQL export에서 새 D1 복원

Time Travel 보존 기간이 지났거나 기존 데이터베이스를 사용할 수 없을 때만 보관한 SQL export로 새 D1을 만듭니다. 기존 Production `database_id`는 복원 검증이 끝날 때까지 변경하지 않습니다.

1. 복구용 D1을 생성하고 출력된 `database_id`를 기록합니다.

```bash
npx wrangler d1 create todo-planner-recovery
```

2. 보관한 SQL 파일을 새 데이터베이스에 import합니다.

```bash
npx wrangler d1 execute todo-planner-recovery --remote --file="./backups/d1/production/<backup-file>.sql"
```

3. 아래의 핵심 테이블 건수 조회에서 `DB --env preview` 부분을 `todo-planner-recovery`로 바꿔 실행하고, 기존 기록과 비교합니다.
4. 필요하면 Preview의 D1 binding을 새 데이터베이스로 임시 변경해 로그인과 핵심 화면을 확인합니다.
5. 검증이 끝난 후에만 `wrangler.jsonc`의 Production `database_id`를 새 데이터베이스 ID로 교체하고 Production을 배포합니다.
6. 기존 데이터베이스와 백업 파일은 새 Production 동작을 확인할 때까지 삭제하지 않습니다.

이 복원 절차는 자동화하지 않으며, 평상시에는 Time Travel을 우선합니다.

## 현재 bookmark 조회

변경 또는 복구 전 대상 환경의 현재 bookmark를 기록합니다.

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

5. 출력의 `previous_bookmark`를 즉시 저장합니다. 이것이 복구 취소 지점입니다.
6. 다음 핵심 테이블의 건수를 확인하고 훈련 전 기대값과 비교합니다.

```bash
npx wrangler d1 execute DB --env preview --remote --command "SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users UNION ALL SELECT 'categories', COUNT(*) FROM categories UNION ALL SELECT 'todos', COUNT(*) FROM todos UNION ALL SELECT 'tags', COUNT(*) FROM tags UNION ALL SELECT 'todo_tags', COUNT(*) FROM todo_tags UNION ALL SELECT 'reflections', COUNT(*) FROM reflections UNION ALL SELECT 'goals', COUNT(*) FROM goals UNION ALL SELECT 'memos', COUNT(*) FROM memos UNION ALL SELECT 'topics', COUNT(*) FROM topics UNION ALL SELECT 'topic_links', COUNT(*) FROM topic_links UNION ALL SELECT 'music_links', COUNT(*) FROM music_links UNION ALL SELECT 'focus_sessions', COUNT(*) FROM focus_sessions UNION ALL SELECT 'timer_settings', COUNT(*) FROM timer_settings;"
```

7. 애플리케이션 health check와 핵심 화면을 확인한 후, 결과와 bookmark를 기록합니다.

## 복구 취소 (undo)

restore 결과의 `previous_bookmark`는 복구 직전 상태를 가리킵니다. Preview 훈련을 되돌릴 때만 다음 명령을 수동 실행합니다.

```bash
npx wrangler d1 time-travel restore DB --env preview --bookmark=<previous_bookmark>
```

이 명령도 새 `previous_bookmark`를 반환하므로 추가 복구 가능성을 위해 값을 저장합니다.

## Production 복구 전 확인

Production restore는 자동화하지 않습니다. 실제 데이터 손상이 확인된 경우에만 수동으로 실행합니다.

1. 대상이 `wrangler.jsonc`의 Production `DB` binding인지 확인합니다.
2. `d1 info` 결과가 `version: production`인지 확인합니다.
3. 사고 발생 시각, 복구할 timestamp, 현재 bookmark와 최신 SQL export를 기록합니다.
4. Preview에서 Time Travel 복구 절차를 한 번 이상 검증했는지 확인합니다.
5. Preview와 Production의 bookmark는 각 데이터베이스에서 별도로 조회합니다.
6. restore 결과의 `previous_bookmark`를 저장하고, 복구 후 health check와 핵심 화면을 확인합니다.

Production restore 명령은 `package.json`, CI 또는 자동화 스크립트에 추가하지 않습니다.

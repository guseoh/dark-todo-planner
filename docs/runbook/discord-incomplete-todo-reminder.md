# Discord 오늘 미완료 Todo 알림 Runbook

Production Worker는 매일 한국 시간 오후 9시(`0 12 * * *`, UTC)에 **오늘 일정에 해당하는 미완료 Todo**를 Discord로 알립니다. Preview에는 cron trigger가 없습니다.

## 준비

1. D1 migration을 검토하고 Production 배포 절차에 따라 적용합니다.
2. Discord 채널에서 개인용 webhook을 만든 뒤 값을 로컬 터미널 입력으로만 등록합니다.

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL --env production
```

Webhook 값은 저장소 파일, 문서, 로그, CI 변수 예시에 기록하지 않습니다. Codex 작업에서는 Secret을 설정하지 않습니다.

## 알림 대상

- `single-user` 소유이며 보관되지 않고 완료되지 않은 Todo
- 비반복 Todo는 `planner today`와 일정 날짜가 정확히 같은 경우만 포함
- 반복 Todo는 시작 날짜가 미래가 아니면서 오늘 실제 발생하는 경우만 포함

지난 날짜에 끝내지 못한 비반복 Todo와 미래 Todo, 오늘 발생하지 않는 반복 Todo는 제외합니다. 지난 Todo는 앱의 오늘 화면에서 별도 ‘가져오기’ 기능으로 관리하고 Discord 알림에는 섞지 않습니다.

메시지는 제목을 최대 5개 표시하고 나머지는 `외 N개`로 요약하며, Discord mention은 허용하지 않습니다.

## 중복 전송과 실패

`notification_send_records`는 planner date와 provider(`discord`) 조합을 한 번만 claim합니다. 동일 날짜 cron이 중복 실행되어도 다시 보내지 않습니다.

- Discord 전송 자체가 실패하면 해당 claim을 제거해 같은 날 재시도할 수 있습니다.
- Discord 전송은 성공했지만 D1의 `SENT` 갱신이 실패하면 claim을 유지합니다. 이 상태는 `sent-unconfirmed`로 기록하며 같은 날 재전송하지 않습니다.
- 현재 planner date의 `PENDING` claim은 시간만으로 삭제하지 않습니다. 더 오래된 날짜의 `PENDING` 기록은 다음 날짜 claim 과정에서 정리합니다.

Discord Webhook 전송과 D1 상태 갱신은 하나의 원자적 트랜잭션으로 묶을 수 없습니다. 개인용 하루 한 번 알림에서는 드문 확인 기록 실패 시 재전송보다 중복 알림 방지를 우선합니다.

Webhook Secret이 없으면 알림을 보내지 않고 안전한 로그만 남깁니다. 실패 로그에는 webhook URL이나 Discord 응답 본문을 기록하지 않습니다.

## 확인

배포 전에 다음을 실행합니다.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

로컬 scheduled 호출을 검증할 때만 Wrangler의 `--test-scheduled` 개발 모드를 사용합니다. Production 또는 Preview 배포와 원격 D1 migration은 별도 승인된 운영 절차에서만 수행합니다.

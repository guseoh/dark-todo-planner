# GitHub 잔디

별도 `개발 활동` 화면과 Codex 가져오기는 제거했다. GitHub 기여 잔디만 **오늘 화면 우측 레일**의 위젯으로 유지한다.

## 화면
- 오늘 화면(1280px 이상)의 우측 레일 하단에 최근 16주 잔디, 최근 합계, 오늘 기여 수를 보여준다.
- `365일 전체 보기` 버튼은 최근 365일 잔디와 통계를 대화상자로 연다. 새로고침 버튼은 캐시를 무시하고 다시 불러온다.
- 레일이 숨겨지는 1280px 미만에서는 데이터를 요청하지 않는다.
- 정확한 기여 건수가 없으면 0으로 채우지 않고 `집계 불가` 또는 `활동 있음`으로 표시한다. 실패 시 가짜 잔디를 그리지 않고 오류를 표시한다.
- 예전 `#/activity` 링크는 오늘 화면으로 이동한다.

## 데이터 (자동)
- Worker `GET /api/activity/github`, 로그인 필요. 브라우저는 GitHub 토큰에 접근하지 않는다.
- 기본은 `https://github.com/users/guseoh/contributions` 공개 달력 HTML을 파싱한다(비공식이라 형식이 바뀌면 수정 필요).
- Worker Secret `GITHUB_ACTIVITY_TOKEN`이 있으면 공식 GraphQL `contributionCalendar`를 우선 사용한다. 토큰 설정은 자동으로 하지 않는다: `npx wrangler secret put GITHUB_ACTIVITY_TOKEN --env production`.
- GitHub 요청은 8초 안에 응답이 없으면 중단하고, Worker isolate 메모리에 1시간 캐시하고 장애 시 마지막 캐시를 `stale: true`로 반환한다. 브라우저도 10분간 재요청을 줄인다.
- 비공개 활동의 세부 정보는 읽지 않는다.

## 참고
- GitHub GraphQL 기여 달력: https://docs.github.com/en/graphql/reference/users

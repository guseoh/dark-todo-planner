# V4 GitHub 저장소 연동 운영 가이드

공개 저장소는 자격증명 없이 읽기 전용 조회한다. 비공개 저장소 연동은 단일 사용자 Tern Worker에 별도 읽기 전용 fine-grained PAT를 설정한 경우에만 동작한다. GitHub 활동 조회의 GITHUB_ACTIVITY_TOKEN을 재사용하지 않는다. 인증된 응답은 Worker 메모리 캐시나 공유 in-flight promise에 넣지 않는다. Tern의 기존 인증 미들웨어 및 API no-store 정책을 거친다.

## 운영 설정 (배포 승인 이후에만 수행)
1. GitHub에서 만료 기간을 설정한 fine-grained PAT를 생성한다. 필요한 저장소만 선택하고 Issues, Pull requests, Checks, Commit statuses를 읽기 전용으로 허용한다. Metadata 읽기는 기본이며, 실제 API 응답에 따라 필요한 최소 권한을 확인한다. 쓰기/관리 권한을 주지 않는다.
2. Worker Secret으로 GITHUB_REPOSITORY_TOKEN을 설정한다. 예: Cloudflare Dashboard에서 Secret을 직접 입력하거나 터미널의 `npx wrangler secret put GITHUB_REPOSITORY_TOKEN`을 이용한다.
3. GITHUB_REPOSITORY_ALLOWLIST도 Secret으로 설정한다. 값은 쉼표로 나눈 정확한 owner/repo 목록이다. 빈 값 또는 와일드카드는 허용하지 않는다. 토큰/목록을 소스, PR, 로그, D1, 백업 또는 채팅에 기록하지 않는다.
4. 프로젝트 자료 링크에 저장소 원본 주소를 등록한다. Issues/PR 목록, 리뷰와 HEAD 체크 및 원본 열기를 확인한다. 공개/인증 조회 표시가 맞는지 확인한다.
5. 연결을 해제하려면 허용 목록에서 저장소를 삭제하고, 필요 시 GitHub 토큰을 폐기한다.

서버에 토큰을 두는 단일 사용자 구성이다. Windows 로컬 토큰 저장이나 여러 계정 인증은 구현하지 않았다. 사용자 토큰이 필요한 운영 실검증은 미완료이며 QA fixture는 실제 GitHub 호출을 하지 않는다. GitHub 쓰기, 승인, 병합 및 자동 Todo 완료를 수행하지 않는다. 리뷰/CI 조회는 브랜치 보호 조건을 대체하지 않는다.

참고: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens

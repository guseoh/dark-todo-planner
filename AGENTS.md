# Tern 프로젝트 에이전트 규칙

- 기존 [README](README.md), [Windows QA](docs/tern-windows-qa.md), [릴리스 운영 가이드](docs/tern-desktop-release.md)와 최신 코드가 프로젝트 원본이다. Windows 전용 앱 정책과 기존 검증·배포 절차를 보존한다.
- 문서 변경은 운영 배포 또는 릴리스 승인으로 해석하지 않는다.

## Obsidian 및 중앙 AI Wiki 접근

- 이 저장소의 프로젝트 규칙을 진입점으로 사용한다. 설치된 공식 [Obsidian Agent Skills](https://github.com/obsidianmd/obsidian-skills)는 필요한 경우에만 활용한다.
- 기존 결정·설계·장애·후속 작업을 조회할 때 [중앙 Wiki 실행 계약](https://github.com/guseoh/cs/blob/main/Wiki/AGENTS.md)과 [인덱스](https://github.com/guseoh/cs/blob/main/Wiki/index.md)를 따른다. 로컬 Vault와 CLI 접근이 허용되고 동기화 상태를 확인할 수 있으면 해당 Vault에서 필요한 기록만 읽는다. 그렇지 않으면 최신 GitHub 원문을 조회한다.
- 스킬은 접근 권한이나 MCP 서버가 아니다. CLI가 없거나 앱 실행·권한·동기화 확인이 불가능하면 제한을 보고하고 허용된 GitHub/파일 읽기 경로를 사용한다.
- 기존 프로젝트 권위 원본, 기록 모드, 승인·PR·검증 절차는 그대로 유지한다. Wiki 쓰기는 중앙 규칙에 따르며 로컬 main 직접 편집이나 자동 병합으로 우회하지 않는다. 사용자 승인 없이 앱 설정·플러그인·CSS·파일 삭제를 수행하지 않는다.
- 중앙 Wiki의 `dark-todo` 기록 모드는 `manual`이다. 기존 승인 결정·스냅샷을 유지하고 상시 Journal 수집을 추가하지 않는다.

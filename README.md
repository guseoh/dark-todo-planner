# Dark Todo Planner

개인 작업과 프로젝트를 관리하는 앱입니다. Todo, 캘린더, 프로젝트, 메모를 웹과 Windows 데스크톱에서 사용할 수 있습니다.

- [웹 앱 열기](https://dark-todo-planner.guseoh.workers.dev/)
- 웹은 React와 Vite, 데스크톱 앱 **Tern**은 Tauri 2, 백엔드는 Cloudflare Workers·Hono·D1을 사용합니다.

## Tern 설치 · Windows 11 x64

**[Tern 0.2.0 설치 파일](https://github.com/guseoh/dark-todo-planner/releases/download/tern-v0.2.0/Tern_0.2.0_x64-setup.exe)**

설치 파일을 실행한 뒤 Tern에서 로그인합니다.

Tern 0.1.2를 사용 중이면 트레이 메뉴의 **업데이트 확인**에서 0.2.0을 설치할 수 있습니다. 0.2.0부터는 앱 설정에서도 업데이트를 확인할 수 있습니다. [GitHub Releases](https://github.com/guseoh/dark-todo-planner/releases)

## 개발 환경

Node.js 22 이상이 필요합니다. 의존성을 설치하고 로컬 로그인용 비밀번호 해시를 만듭니다.

```sh
npm ci
npm run auth:hash
```

Git에 포함되지 않는 `.dev.vars`에 `AUTH_USERNAME`, 생성한 `AUTH_PASSWORD_HASH`, 32자 이상의 `SESSION_SECRET`을 설정한 뒤 실행합니다.

```sh
npm run db:migrate:local
npm run dev
```

Windows 데스크톱 개발은 [Tauri 2의 Windows 개발 도구](https://v2.tauri.app/start/prerequisites/)와 네이티브 소스가 있는 체크아웃에서 실행합니다. Tern 개발 창은 운영 웹 주소를 엽니다.

```sh
npm run desktop:dev
npm run desktop:build
```

## 테스트 및 배포

```sh
npm run typecheck
npm test
npm run build
```

운영 웹은 `main` 반영 후 GitHub Actions로 배포합니다. D1 검증과 롤백 방법은 [웹 배포 가이드](docs/runbook/deploy-rollback.md)를 참고하세요.

### Tern 소스와 릴리스

네이티브 창·트레이·전역 단축키는 `src-tauri/src/main.rs`, 업데이트 명령은 `src-tauri/src/updates.rs`, 권한과 업데이트 공개 키는 `src-tauri/tauri.conf.json`에 있습니다. 현재 0.1.2 설치본은 로컬 Windows 빌드에서 생성됐으며, 공개된 `tern-v0.1.2` 태그에는 네이티브 소스와 빌드 설정이 포함되어 있지 않습니다.

0.2.0 소스는 운영 주소를 외부 WebView로 열어 **설정 → 앱 및 연결 정보 → Tern 업데이트**에서 버전 조회와 업데이트 확인을 지원합니다. 원격 IPC는 운영 HTTPS 출처의 메인 창과 `desktop_update` 명령으로 제한됩니다.

0.2.0부터는 네이티브 소스, Cargo 잠금 파일, 빌드 스크립트를 포함하는 커밋에 릴리스 태그를 지정합니다. 해당 체크아웃에서 업데이트 서명 키를 빌드 환경에 설정하고 `npm run desktop:release`를 실행합니다. 같은 릴리스에 NSIS 설치 파일, `.sig`, `latest.json`을 첨부합니다. 게시 전에 파일 SHA-256과 서명된 버전이 릴리스와 일치하는지 확인합니다.

# Tern Windows 네이티브 앱 · 릴리스 운영

기준: 2026-11-24. 현재 저장소에서 재구성한 Tauri 2 소스와 신규 GitHub Actions 파이프라인에 대한 문서입니다. **최초 Windows 빌드/설치 및 기존 v0.2.0에서의 업데이트 성공은 별도 검증 전까지 미확인**입니다.

## 구조

- 프런트엔드는 Vite로 빌드되어 Windows 설치 파일 안에 번들됩니다. 기존 Web URL을 메인 창으로 여는 셸이 아닙니다.
- 메인 창은 React·Tauri webview, 네이티브 진입점은 src-tauri/src/lib.rs입니다.
- 모든 앱 데이터는 기존 Cloudflare Worker API 및 D1에 유지됩니다. 로컬 DB로 이동하거나 D1을 초기화하지 않습니다.
- 데스크톱 앱의 /api/ 요청만 고정 호스트로 전송하는 Rust native API command를 사용합니다. 임의 호스트 요청, 리디렉션, 교차 출처 WebView Cookie 전송은 허용하지 않습니다.
- **현재 네이티브 HTTP 세션 쿠키는 메모리 기반**이므로 앱을 종료하고 다시 실행하면 재로그인이 필요할 수 있습니다. 영속적 쿠키 보관을 추가하려면 OS 보호 저장소, 로그아웃 제거 및 복원 검증이 선행되어야 합니다.
- HTTP 전송은 현재 JSON API 요청용입니다. 파일 기반 FormData 등 다른 본문 형식이 필요하면 안전하게 별도 지원해야 합니다.

## 자동 Windows 릴리스

.github/workflows/tern-windows-release.yml:
1. 릴리스할 때 `src-tauri/tauri.conf.json`의 버전을 명시적으로 변경하고 `src-tauri/Cargo.toml` 및 `src-tauri/Cargo.lock`의 자체 `tern` 패키지 버전을 동일하게 맞춥니다. 이 설정 변경의 main 병합으로 Windows 릴리스가 실행되며, 수동 실행도 가능합니다. 일반 코드 변경만으로는 릴리스하지 않습니다.
2. 안정 SemVer(MAJOR.MINOR.PATCH)를 검증하고 기존 최신 릴리스보다 높은 버전이며 동일 태그가 없는지 확인합니다. 실행 번호에 기반한 자동 증가는 폐기합니다. 등록된 업데이트 공개키만 **빌드 시에** 주입하고 버전 및 Cargo.lock은 변경하지 않습니다.
3. src-tauri/branding/tern.png에서 Windows icon을 재현하여 NSIS 설치 파일을 만듭니다.
4. Tauri가 비공개 서명 키를 사용해 updater 서명을 생성합니다.
5. tauri-action이 GitHub Release와 최신 버전 manifest latest.json을 게시합니다.
6. Tern은 실행 시와 이후 1시간 간격으로 새 버전을 자동 조회하고 사용자가 설치를 승인하면 서명을 검사하고 설치·재시작합니다. 작성 중인 내용이 갑자기 사라지지 않도록 무인 자동 설치하지 않습니다.

필요한 GitHub Actions Repository Secrets:
- TAURI_SIGNING_PRIVATE_KEY: 현재 릴리스용 Tauri updater 개인키 내용 (기존 키 유실 시 새로 생성한 키)
- TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 개인키 암호(설정한 경우)
- TERN_UPDATER_PUBLIC_KEY: 해당 개인키와 정확히 짝인 Tauri CLI가 출력한 **base64 인코딩된 minisign 공개키 문서** 값(일반적으로 `dW50cn...`로 시작). `.pub`의 내부 `RW...` 한 줄만 넣지 않습니다.

**개인키를 Git 또는 공개 문서에 업로드하지 마세요.** GitHub Settings → Secrets and variables → Actions → Repository secrets에서 추가합니다. 기존 개인키가 없으면 공개키만으로 새 업데이트를 만들 수 없습니다. 키가 유실됐다면 새 서명 키를 만든 후 기존 설치자에게 **신규 설치 파일을 직접 실행하는 1회 전환**이 필요합니다. v0.2.0 인플레이스 자동 업데이트를 보장할 수 없습니다.

기존 v0.2.0의 Tauri 설정에서 확인한 bundle identifier `io.github.guseoh.dark-todo-planner`를 유지합니다. 기존 개인키를 찾지 못해 새 키 쌍으로 전환하는 경우 v0.2.0 사용자는 GitHub Releases의 새 NSIS 설치 파일을 직접 실행해야 합니다. 설치 범위 및 실제 인플레이스 교체 결과는 Windows에서 확인해야 합니다. 새 앱은 이후 동일한 새 서명 키를 사용한 릴리스를 자동 확인합니다. 이전 앱의 로컬 미동기화 데이터는 전환 전에 서버 동기화 여부를 확인합니다.

서명 키가 아직 설정되지 않았다면 릴리스 워크플로는 실패하며 **서명하지 않은 실행 파일을 latest.json으로 게시하지 않습니다**. 동작을 우회하기 위해 임시 개인키를 CI에서 매번 생성하지 않습니다.

## 로컬 개발

Windows 11에 Node.js 22, Rust stable/MSVC, WebView2가 준비되어 있어야 합니다.

1. npm ci
2. npx --yes @tauri-apps/cli@2 icon -o src-tauri/icons public/pwa-icon-512.png
3. npx --yes @tauri-apps/cli@2 dev

개발 중에는 공개키 placeholder로 인해 updater 확인에 오류가 표시될 수 있습니다. 릴리스 빌드에는 반드시 실제 키를 주입해야 합니다. PR의 Rust/네이티브 변경은 Windows에서 cargo check로 검증합니다. 설치 파일 및 서명은 main 릴리스에서만 생성합니다.

릴리스 이전에 수동으로 빌드하려면 현재 Tauri 설정의 공개키 자리표시자를 실제 키로 채우고 비공개 서명 키를 환경변수로 제공해야 합니다. 개인키는 저장소에 저장하지 않습니다.

## 백엔드 배포 분리

- .github/workflows/ci.yml: PR의 변경 영역을 판별하고 타입 검사·단위 테스트 및 필요한 영역 검증만 실행합니다. main 전체 CI 재실행은 제거했습니다.
- .github/workflows/tern-windows-check.yml: Rust/Tauri 또는 의존성 변경 PR만 Windows cargo check로 검증합니다. NSIS 패키징은 하지 않습니다.
- .github/workflows/api-check.yml: Worker/D1 변경 PR과 백엔드 배포 전 로컬 인증·CRUD·복원·롤백 검증을 재사용합니다.
- .github/workflows/regression.yml: 매주 또는 수동 실행하는 API·보안 감사·암호화 검증입니다. 기존 웹/Chromium 전용 UI 자동 테스트는 운영 검증에서 제외했습니다.
- Windows 릴리스는 같은 main 커밋에서 타입 검사·단위 테스트·릴리스 스크립트 검증이 성공한 뒤 기존 키로 서명·발행합니다.
- .github/workflows/worker-deploy.yml: worker/, migrations/, wrangler.jsonc 및 공통 의존성·TypeScript 설정 변경 시 Worker API·D1을 배포합니다. 긴급 작업은 workflow_dispatch로 수동 실행할 수 있습니다.
- Worker는 API 전용입니다. 정적 에셋 바인딩 및 SPA fallback을 제거하고 비 API 경로는 JSON 404를 반환합니다. `npm run build:worker`는 React/Vite 빌드를 실행하지 않습니다. 로컬 UI 개발은 `npm run dev:desktop-ui` 또는 Tauri dev로 진행합니다.
- Worker 배포와 Windows 릴리스 성공은 서로 독립된 사실입니다.

## 선행 확인 및 장애 대응

- 기존 v0.2.0의 설치 이름, bundle identifier, NSIS installation scope와 공개키를 확인합니다.
- 첫 릴리스에서 생성된 설치 파일과 latest.json의 버전·다운로드 URL·서명이 같은 릴리스를 가리키는지 확인합니다.
- 기존 설치본에서 실제 업데이트가 확인되기 전에는 최신 Release를 기존 Tern에 자동 배포했다고 보고하지 않습니다.
- 새 키로의 전환 릴리스에는 기존 v0.2.0 사용자의 1회 수동 설치 필요성을 명시합니다. 이전 설치본이 새 서명을 거부하더라도 검증을 우회하지 않습니다.
- 릴리스 실패 시 GitHub Actions 로그를 참고하며, D1 백업/복원과 별개로 Windows 설치 파일만 이전 검증된 릴리스로 수동 재설치할 수 있습니다.

공식 근거: https://v2.tauri.app/plugin/updater/ 및 https://v2.tauri.app/distribute/pipelines/github/

## Rust 의존성 고정

`src-tauri/Cargo.lock`은 Windows runner의 Cargo에서 생성한 실제 lockfile을 추적합니다. PR 컴파일 및 릴리스/네이티브 스모크 빌드에 `--locked`를 적용합니다. 릴리스 준비 스크립트는 추적된 Tauri/Cargo/Cargo.lock의 자체 `tern` 버전 일치 여부를 검사하며 의존성 버전·checksum은 변경하지 않습니다. 의존성 갱신은 별도 PR에서 lockfile과 함께 검토합니다.

운영용 PWA manifest·설치용 아이콘 및 Cloudflare 정적 사이트 `_headers` 파일은 제거했습니다. Tauri 브랜딩 이미지, WebView용 favicon 및 실제 화면 폰트는 유지합니다. Windows 릴리스의 프런트엔드 타입 검사는 Tauri의 beforeBuildCommand에서 한 번 실행되며 Worker 타입 검사는 백엔드 파이프라인이 담당합니다.

## 명시적 버전 관리 (2026-11-24)

- V4 기능 확장: 0.4.0. 호환되는 버그 수정은 0.4.1, 다음 기능 확장은 0.5.0처럼 변경 범위에 따라 결정한다. 0.x 단계에서는 호환성 변경을 별도로 기록한다.
- 버전 기준은 Tauri 설정이며 Cargo.toml/Cargo.lock도 동일해야 한다. private npm 패키지의 버전은 데스크톱 배포 버전이 아니다.
- 이전 0.3.9는 이력으로 보존한다. 기존 tag/Release/자산/서명 키를 변경하지 않는다.
- 같은 버전, 낮은 버전, 이미 존재하는 태그는 발행 전에 실패한다. 실패 후 동일 태그가 남으면 자산과 상태를 별도 점검하고 복구 방안을 결정한다. 무조건 덮어쓰지 않는다.
- main의 일반 코드 변경은 차기 버전으로 누적하며, 릴리스할 때만 버전을 명시적으로 갱신한다. Worker API 배포 워크플로는 독립적으로 유지한다.

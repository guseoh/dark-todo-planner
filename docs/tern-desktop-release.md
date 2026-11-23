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
1. 데스크톱 파일 변경이 main에 들어오면 Windows runner에서 npm ci, Rust toolchain 설치를 수행합니다.
2. src-tauri/tauri.conf.json에 버전 0.3.<run_number>와 기존 업데이트 공개키를 **빌드 시에만** 주입합니다.
3. public/pwa-icon-512.png에서 Windows icon을 재현하여 NSIS 설치 파일을 만듭니다.
4. Tauri가 비공개 서명 키를 사용해 updater 서명을 생성합니다.
5. tauri-action이 GitHub Release와 최신 버전 manifest latest.json을 게시합니다.
6. Tern은 실행 시 새 버전을 자동 조회하고 사용자가 설치를 승인하면 서명을 검사하고 설치합니다. 작성 중인 내용이 갑자기 사라지지 않도록 무인 자동 설치하지 않습니다.

필요한 GitHub Actions Repository Secrets:
- TAURI_SIGNING_PRIVATE_KEY: **기존 Tern v0.2.0에 사용한** Tauri updater 개인키 내용
- TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 개인키 암호(설정한 경우)
- TERN_UPDATER_PUBLIC_KEY: 해당 개인키와 정확히 짝인 Tauri updater 공개키 (.pub 파일의 공개키 텍스트)

**개인키를 Git 또는 공개 문서에 업로드하지 마세요.** GitHub Settings → Secrets and variables → Actions → Repository secrets에서 추가합니다. 기존 개인키가 없으면 공개키만으로 새 업데이트를 만들 수 없습니다. 키가 유실됐다면 새 서명 키를 만든 후 기존 설치자에게 **신규 설치 파일을 직접 실행하는 1회 전환**이 필요합니다. v0.2.0 인플레이스 자동 업데이트를 보장할 수 없습니다.

또한 기존 설치본의 Windows bundle identifier / install scope와 현재 설정의 com.guseoh.tern, NSIS 설치 범위의 일치도 확인해야 합니다. 확인 전에는 v0.2.0을 자동 교체한다고 주장하지 않습니다.

서명 키가 아직 설정되지 않았다면 릴리스 워크플로는 실패하며 **서명하지 않은 실행 파일을 latest.json으로 게시하지 않습니다**. 동작을 우회하기 위해 임시 개인키를 CI에서 매번 생성하지 않습니다.

## 로컬 개발

Windows 11에 Node.js 22, Rust stable/MSVC, WebView2가 준비되어 있어야 합니다.

1. npm ci
2. npx --yes @tauri-apps/cli@2 icon -o src-tauri/icons public/pwa-icon-512.png
3. npx --yes @tauri-apps/cli@2 dev

개발 중에는 공개키 placeholder로 인해 updater 확인에 오류가 표시될 수 있습니다. 릴리스 빌드에는 반드시 실제 키를 주입해야 합니다. PR용 Windows 빌드 검사에서는 서명 아티팩트 생성을 임시로 끄고 컴파일만 검증합니다.

릴리스 이전에 수동으로 빌드하려면 현재 Tauri 설정의 공개키 자리표시자를 실제 키로 채우고 비공개 서명 키를 환경변수로 제공해야 합니다. 개인키는 저장소에 저장하지 않습니다.

## 백엔드 배포 분리

- .github/workflows/ci.yml: PR/push 검증만 수행하고 웹 프런트엔드를 운영 배포하지 않습니다.
- .github/workflows/worker-deploy.yml: worker/, migrations/, wrangler.jsonc 변경 시 Worker API·D1을 배포합니다. 긴급 작업은 workflow_dispatch로 수동 실행할 수 있습니다.
- Worker가 기존 정적 애셋을 함께 보유하는 구조는 유지하지만, **데스크톱 UI 배포 수단으로 취급하지 않습니다**. 백엔드 API 호환성을 지키는 동안만 유지합니다.
- Worker 배포와 Windows 릴리스 성공은 서로 독립된 사실입니다.

## 선행 확인 및 장애 대응

- 기존 v0.2.0의 설치 이름, bundle identifier, NSIS installation scope와 공개키를 확인합니다.
- 첫 릴리스에서 생성된 설치 파일과 latest.json의 버전·다운로드 URL·서명이 같은 릴리스를 가리키는지 확인합니다.
- 기존 설치본에서 실제 업데이트가 확인되기 전에는 최신 Release를 기존 Tern에 자동 배포했다고 보고하지 않습니다.
- 새 키를 사용해야 한다면 업그레이드 경로를 명시적으로 공지하고 기존 설치본의 업데이트 피드를 잘못 덮어쓰지 않도록 합니다.
- 릴리스 실패 시 GitHub Actions 로그를 참고하며, D1 백업/복원과 별개로 Windows 설치 파일만 이전 검증된 릴리스로 수동 재설치할 수 있습니다.

공식 근거: https://v2.tauri.app/plugin/updater/ 및 https://v2.tauri.app/distribute/pipelines/github/

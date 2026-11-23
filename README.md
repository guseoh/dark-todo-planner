# Tern — Windows 작업 플래너

Tern은 Windows 11 x64 데스크톱 앱입니다. React 화면은 Tauri 설치 파일에 포함되며, Cloudflare Worker는 인증·API·D1 데이터 저장과 스케줄러를 담당합니다. 웹 UI는 주 배포 대상이 아닙니다.

## Windows 설치

**[최신 Windows Tern 설치 파일 및 릴리스](https://github.com/guseoh/dark-todo-planner/releases/latest)**

설치 후 로그인합니다. 앱 실행 시 업데이트를 자동 확인하며, 새 버전이 있으면 **업데이트 설치**를 눌러 서명 검증을 거친 후 설치할 수 있습니다. 시스템 트레이의 **업데이트 확인** 또는 **설정 → 앱 및 연결 정보 → Tern 업데이트**에서도 확인할 수 있습니다.

> 기존 v0.2.0에서 새 릴리스로의 인플레이스 업그레이드는 서명 키와 설치 ID의 일치가 확인되어야 합니다. 확인 전에는 기존 릴리스가 자동으로 갱신된다고 가정하지 마세요. 서명 키가 변경되면 최초 1회 수동 재설치가 필요할 수 있습니다.

## 개발 및 배포

- 프런트엔드: React·Vite (Tauri 내부에 정적 파일로 포함)
- 네이티브 앱: Tauri 2 / Rust (src-tauri/)
- 백엔드: Cloudflare Workers·Hono·D1 (worker/)
- Windows 릴리스: main에 데스크톱 코드가 반영되면 GitHub Actions가 **서명된 NSIS 설치 파일 + latest.json**을 GitHub Releases에 게시합니다.
- Worker 배포: 백엔드·DB 설정 변경 시에만 별도의 파이프라인에서 수행합니다.

기존 설치본과의 서명 호환성, GitHub Actions Secret 설정, 로컬 빌드 및 운영 전환 주의사항은 [Windows 릴리스 운영 가이드](docs/tern-desktop-release.md)를 확인하세요.

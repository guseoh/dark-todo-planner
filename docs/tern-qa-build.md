# Tern V4 QA 전용 빌드 (초기 시안)

PR #184, #182. 별도의 Windows 식별자와 잠금, Rust qa feature의 운영 IPC 차단, WebView CSP, 예시 API를 사용한다. 자격증명 복원/운영 요청/전역 단축키/트레이/업데이터를 차단한다. 설치 파일 또는 Releases/latest.json을 생성하지 않는다.

Actions의 Tern Windows QA 실행이 성공한 경우 Artifacts에서 Tern-QA-<SHA> ZIP을 받아 압축 해제하고 Tern-QA.exe를 실행한다. Windows 11/WebView2만 필요하다. GitHub runner에서 생성한 검증용 unsigned 산출물이며 정식 배포가 아니다.

초기 fixture는 화면 조회 및 낙서장 메모리 편집에 한정한다. 지원하지 않는 요청은 501을 반환하며 운영 API로 fallback하지 않는다. Todo/프로젝트/메모 쓰기, DnD, 측정, 복원 등 실제 API와 동일한 회귀 검증은 미완료. QA 종료 후 메모리 변경은 사라지며 로컬 UI 상태는 별도 앱 식별자로 저장된다. 운영 앱과 동시 실행, WebView2 저장소 격리, 실제 Windows 실행은 별도 확인해야 한다.

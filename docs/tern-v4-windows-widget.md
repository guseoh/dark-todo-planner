# V4 Windows 위젯 타당성 검토

## 결론
공식 Windows Widgets Board 위젯은 V4의 NSIS 배포를 교체하지 않고는 도입할 비용이 크므로 보류한다. G10은 타당성 검토 범위로 종료하며, 위젯 구현 완료로 표시하지 않는다.

Microsoft의 Win32 Widget Provider는 패키지된 앱, Windows App SDK, COM 공급자 등록 및 패키지 매니페스트를 요구한다. 현재 Tern은 Tauri NSIS 설치 및 updater 체계를 사용하므로 MSIX 및 별도 서명/배포/업데이트 관리가 필요해진다. 기존 설치 없는 QA 목표와도 충돌한다.

## 대안
Tauri의 독립된 작은 창을 이용한 앱 내부 미니 뷰를 별도 후보로 둔다. Windows 바탕화면 자체에 임의로 삽입하는 비공식 WorkerW 방식이나 외부 위젯 프로그램은 채택하지 않는다. 향후 필요성 확인 시 다음 조건을 충족하는 PoC만 검토한다.
- 현재 측정 시간 및 오늘의 미완료 Todo 일부를 읽기 전용 표시.
- 단일 타이머와 기존 API 경계를 재사용하고 운영 자격증명/IPC를 넓히지 않음.
- 사용자의 명시적 열기/닫기, 기본 자동 실행 및 항상 위 표시 비활성.
- 트레이, 창 위치, DPI, 절전/복귀, 종료 및 updater 호환, QA 데이터 격리.

참고: https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-providers
https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-provider-manifest
https://learn.microsoft.com/en-us/windows/apps/develop/widgets/implement-widget-provider-win32

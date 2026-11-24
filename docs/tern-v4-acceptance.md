# Tern V4 통합 검증 체크리스트 (PR #184)

## 범위 및 상태
- 단일 PR: feat/tern-v4-workspace. Windows 전용; 웹 UI 배포 금지.
- 설치 없는 QA 빌드는 예시 데이터 전용. 기존 설치 파일, updater 및 운영 DB를 변경하지 않는다.
- 실제 기기 테스트와 비공개 저장소 인증은 미확인 상태이며 자동화 통과와 별개이다.

## Windows 사용자 QA
Actions의 최신 PR 커밋 Tern Windows QA가 성공하면 Artifacts ZIP을 풀고 Tern-QA.exe를 실행한다. 운영 Tern과 동시에 실행하고 둘의 제목/데이터/설정이 다른지 확인한다. QA 앱 종료 및 재실행 후 예시 데이터만 초기화되는지 확인한다.
| 범위 | 확인할 동작 |
| --- | --- |
| 공통 | Ctrl+B 축소/확장, 시각 편집기 Ctrl+B 굵게, 한글 IME, 화면 이동 |
| Todo | 연속 입력, 템플릿 저장/불러오기/삭제, 기존 Todo 복제, 인라인 제목/분류/우선순위, 실패 시 입력 유지, 검색 필터/스크롤 복원, undo |
| 프로젝트 | 4열 이동, 하위 완료 토글, 연결 메모, 독립 Todo 프로젝트 이동, 계층이 연결된 작업 이동 거절 및 링크 보존 |
| 메모 | 탭 변경 전후 동일 문서의 원본/시각 편집기 위치, 초안 복구, 저장 실패, 낙서장 전체 및 선택 복사, 원본 보존 |
| 시간 | Todo/프로젝트/카테고리 타이머, 재개, 수동 기록 수정, 03시 경계, 전체 합계와 세 분류의 합계 일치 |
| 캘린더 | 계획 블록 이동, 선택 날짜 수동 기록, 계획/실측 비교, 오늘 정리 및 회고 |
| GitHub | 가상 Issues/PR, 상태·페이지, 리뷰/CI, 기존 Todo 연결 및 생성. QA에서는 외부 브라우저 차단 |
| 안정성 | 운영 앱과 QA 동시 실행, 운영 D1 미접근, QA 재시작, 오류 메시지, 창 크기·DPI |

운영 GitHub 조회는 배포 후 별도 테스트 계정/읽기 권한으로 검증한다. QA에서 운영 Secret을 입력하지 않는다. 템플릿은 현재 PC의 앱 저장소만 사용하며 계정 동기화/백업은 구현하지 않는다. 메모 성능은 실제 Windows에서 문서 전환 반복 및 작업 관리자/DevTools를 통해 관찰하고 결과를 기록한다. 전체 기능 회귀 검증과 배포 승인이 완료되기 전까지 Draft PR을 유지한다.

## 1차 통합 QA 기록 (2026-11-24)

- 기준 head `afb9853`: CI의 Typecheck/Unit/Backup/Audit/Local Worker+D1 및 Windows compile check, QA executable 빌드/Native unit tests/시작/중복 실행 차단/Artifact 업로드 통과. [QA workflow](https://github.com/guseoh/dark-todo-planner/actions/runs/45361653533). 실제 PC에서의 운영 앱과 동시 실행은 아직 검증하지 않았다.
- 코드 감사 후 수정: QA 프로젝트 측정 합계가 항상 0이던 fixture, GitHub Issue/PR 탭 페이지 초기화, 빠른 중복 연결 방어와 조회 시각 표시, 템플릿 로드 시 이전 일정 잔류 및 선택 초기화, Modal IME Escape, 거절된 프로젝트 이동의 요청 serial 변경, 03시 날짜 경계에서 열린 오늘 정리의 대상 날짜 보호.
- QA 프로젝트 합계의 Todo+수동 기록 및 날짜 범위 단위 테스트 추가. 최종 수정 head의 CI/Windows QA 및 실제 사용 검증은 별도로 확인한다.

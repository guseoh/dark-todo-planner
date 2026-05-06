# Dark Todo Planner

브라우저에서 매일 쓰기 위한 개인용 다크모드 Todo / Planner입니다. 백엔드, 로그인, 회원가입 없이 LocalStorage에 데이터를 저장하며 GitHub Pages에서 정적 웹 앱으로 동작합니다.

## 기술 스택

- React
- TypeScript
- Vite
- Tailwind CSS
- date-fns
- lucide-react
- LocalStorage

## 주요 기능

- Todo 등록, 수정, 삭제, 완료 처리
- 오늘 / 주간 / 월간 / 전체 Todo 보기
- 반복 Todo: 반복 없음, 매일, 매주, 매월, 평일, 주말
- 태그 입력과 태그별 필터
- 완료 Todo 보관함
- Todo 선택형 타이머 / 뽀모도로
- FocusSession 저장과 집중 시간 통계
- 오늘 / 주간 / 월간 회고 작성
- 목표 / D-Day / 진행률 관리
- 검색, 필터, 정렬
- 완료율 progress bar
- JSON 백업 / 복원
- 키보드 단축키
- 모바일 대응 다크모드 UI

## 실행 방법

```bash
npm install
npm run dev
```

기본 개발 주소는 `http://localhost:5173`입니다. GitHub Pages 배포 경로는 `/dark-todo-planner/`이므로 `vite.config.ts`의 `base`는 다음처럼 설정되어 있습니다.

```ts
base: "/dark-todo-planner/"
```

## 화면 구성

- 대시보드: 오늘 Todo, 완료율, 집중 시간, 가까운 D-Day 목표, 최근 회고
- 오늘: 오늘 표시 대상 Todo와 빠른 추가
- 주간: 월요일부터 일요일까지 날짜별 Todo와 미완료 개수
- 월간: 달력과 선택 날짜 Todo
- 전체 Todo: 검색, 상태/우선순위/태그/날짜 필터, 정렬
- 타이머: Todo 선택, 집중/휴식 타이머, 집중 통계
- 회고: 오늘/주간/월간 회고 작성, 수정, 삭제
- 목표: D-Day 목표, 완료 처리, 진행률 관리
- 보관함: 보관된 Todo 확인, 보관 해제, 삭제
- 설정: 백업/복원, 타이머 설정, 단축키, LocalStorage 안내

## 데이터 저장 방식

모든 데이터는 현재 브라우저의 LocalStorage에 저장됩니다. 서버로 전송되지 않습니다.

사용 중인 LocalStorage 키:

```ts
const STORAGE_KEYS = {
  TODOS: "dark-todo-planner:todos",
  REFLECTIONS: "dark-todo-planner:reflections",
  GOALS: "dark-todo-planner:goals",
  FOCUS_SESSIONS: "dark-todo-planner:focus-sessions",
  TIMER_SETTINGS: "dark-todo-planner:timer-settings",
  TIMER_STATE: "dark-todo-planner:timer-state",
};
```

이전 Todo 키인 `dark-todo-planner.todos`도 읽어서 새 키로 마이그레이션합니다.

## LocalStorage 주의사항

- 같은 브라우저와 같은 프로필에서 데이터가 유지됩니다.
- 브라우저 데이터 삭제, 시크릿 모드 종료, 다른 브라우저 사용 시 데이터가 사라지거나 분리될 수 있습니다.
- 중요한 데이터는 설정 페이지에서 JSON으로 백업하세요.

## JSON 백업 / 복원

설정 페이지에서 JSON 내보내기와 가져오기를 할 수 있습니다.

백업 구조:

```ts
type BackupData = {
  version: number;
  exportedAt: string;
  todos: Todo[];
  reflections?: Reflection[];
  goals?: Goal[];
  focusSessions?: FocusSession[];
  timerSettings?: TimerSettings;
};
```

이전 형식의 Todo 배열 JSON도 가져올 수 있습니다. 가져오기 전에는 기존 데이터를 덮어쓸지 확인합니다.

## 타이머 / 뽀모도로 사용 방법

1. 타이머 페이지로 이동합니다.
2. 집중할 Todo를 선택하거나 선택하지 않고 시작합니다.
3. 집중, 짧은 휴식, 긴 휴식 모드를 사용할 수 있습니다.
4. 집중 모드가 끝나면 FocusSession이 저장됩니다.
5. 오늘 집중 시간, 오늘 완료 세션 수, 이번 주 집중 시간, 전체 집중 시간을 확인할 수 있습니다.

기본 설정:

- 집중: 25분
- 짧은 휴식: 5분
- 긴 휴식: 15분
- 긴 휴식까지 집중 세션: 4회

설정 페이지에서 시간, 알림음, 브라우저 알림을 변경할 수 있습니다.

## 단축키 목록

- `N`: 새 Todo 입력창 포커스
- `T`: 오늘 보기
- `W`: 주간 보기
- `M`: 월간 보기
- `A`: 전체 Todo
- `R`: 회고 페이지
- `G`: 목표 페이지
- `F`: 타이머 페이지
- `Esc`: 모달 닫기
- `Ctrl + Enter`: 저장

입력창, textarea, select에 포커스가 있을 때는 페이지 이동 단축키가 동작하지 않습니다.

## 폴더 구조

```text
src
 ┣ components
 ┃ ┣ calendar
 ┃ ┣ common
 ┃ ┣ goal
 ┃ ┣ layout
 ┃ ┣ reflection
 ┃ ┣ timer
 ┃ ┗ todo
 ┣ hooks
 ┣ lib
 ┣ pages
 ┣ styles
 ┣ types
 ┣ App.tsx
 ┗ main.tsx
```

## Todo 데이터 구조

```ts
type Todo = {
  id: string;
  title: string;
  memo?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  repeat: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAY" | "WEEKEND";
  tags: string[];
  archived: boolean;
  archivedAt?: string;
};
```

기존 데이터에 새 필드가 없어도 앱이 기본값을 적용합니다.

## 추후 개선 사항

- IndexedDB로 저장소 변경
- 캘린더 드래그 앤 드롭
- 자동 백업 기능
- 통계 차트
- 태그별 통계
- 반복 Todo 고급 설정
- 브라우저 알림 고도화
- PWA 지원
- 서버 연동
- 로그인 기능

## 이번 버전에서 제외한 기능

- Spring Boot
- MySQL
- 로그인
- 회원가입
- 서버 배포
- 모바일 앱 빌드
- Electron 데스크톱 앱
- 관리자 기능
- 과한 인증/권한 구조
- 결제 기능
- 팀 협업 기능

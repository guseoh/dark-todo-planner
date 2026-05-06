# Dark Todo Planner

개인적으로 매일 사용하기 위한 다크모드 웹 Todo / Planner입니다. 백엔드, 로그인, 배포 서버 없이 브라우저에서 실행하고 LocalStorage에 데이터를 저장하는 MVP 버전입니다.

## 기술 스택

- React
- TypeScript
- Vite
- Tailwind CSS
- date-fns
- lucide-react
- LocalStorage

## 주요 기능

- Todo 등록, 수정, 삭제
- 체크박스 기반 완료 처리
- 날짜별 Todo 조회
- 오늘 보기, 주간 보기, 월간 보기
- 전체 Todo 검색
- 완료 여부, 우선순위, 날짜 필터
- 최신순, 오래된순, 우선순위 높은순, 날짜 가까운순 정렬
- 오늘 완료율, 이번 주 완료율, 이번 달 Todo 수 등 통계 표시
- 우선순위 배지 표시
- 메모, 시작 시간, 종료 시간 입력
- LocalStorage 자동 저장
- JSON 내보내기
- JSON 가져오기
- 전체 데이터 초기화
- 모바일 브라우저 대응 반응형 레이아웃

## 실행 방법

```bash
npm install
npm run dev
```

개발 서버가 실행되면 브라우저에서 안내된 주소로 접속합니다. 기본적으로 Vite는 `http://localhost:5173`을 사용합니다.

## 화면 구성

- 대시보드: 오늘 날짜, 오늘 Todo, 오늘 완료율, 남은 Todo, 주간 완료율, 월간 Todo 수, 빠른 추가, 최근 완료 항목
- 오늘: 오늘 날짜의 Todo를 완료/미완료로 나누어 표시
- 주간: 월요일부터 일요일까지 요일별 Todo와 선택 날짜 상세 관리
- 월간: 달력 형태의 월간 Todo 표시와 선택 날짜 상세 관리
- 전체 Todo: 검색, 필터, 정렬이 가능한 전체 목록
- 설정: LocalStorage 안내, JSON 백업/복원, 전체 초기화

## 데이터 저장 방식

현재 버전은 브라우저의 LocalStorage를 사용합니다.

- 저장 키: `dark-todo-planner.todos`
- 서버로 데이터가 전송되지 않습니다.
- 브라우저 데이터 삭제, 다른 브라우저 사용, 시크릿 모드 종료 시 데이터가 사라질 수 있습니다.
- 중요한 데이터는 설정 화면에서 JSON으로 백업하는 것을 권장합니다.

저장 로직은 `src/lib/storage.ts`와 `src/hooks/useTodos.ts`에 분리되어 있어 추후 IndexedDB로 교체하기 쉽게 구성했습니다.

## 폴더 구조

```text
src
 ┣ components
 ┃ ┣ calendar
 ┃ ┣ common
 ┃ ┣ layout
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
};
```

## 추후 개선 사항

- IndexedDB로 저장소 변경
- 반복 Todo 기능
- 알림 기능
- 캘린더 드래그 앤 드롭
- 태그 기능
- 백업 자동화
- 서버 연동
- 로그인 기능
- 모바일 PWA 지원

## 이번 버전에서 제외한 기능

- Spring Boot
- MySQL
- 로그인
- 회원가입
- 서버 배포
- 모바일 앱 빌드
- Electron 데스크톱 앱
- 과한 인증/권한 구조
- 관리자 기능

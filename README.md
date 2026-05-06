# Dark Todo Planner

매일 브라우저에서 쓰기 위한 개인용 다크모드 Todo / Planner입니다. 기존 LocalStorage 중심 구조에서 Express API, Prisma, SQLite 기반 서버 저장 방식으로 전환했습니다.

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Express
- Prisma
- SQLite
- bcryptjs
- HttpOnly Cookie 기반 JWT 세션
- date-fns
- lucide-react

## 백엔드 추가 후 변경점

- Todo, 카테고리, 회고, 목표, 집중 기록, 타이머 설정을 서버 DB에 저장합니다.
- 회원가입, 로그인, 로그아웃, 현재 사용자 조회 API가 추가되었습니다.
- 비밀번호는 bcrypt 해시로 저장하고, API 응답에는 `passwordHash`를 포함하지 않습니다.
- 로그인 세션은 HttpOnly Cookie로 관리하며 프론트 LocalStorage에 JWT를 저장하지 않습니다.
- Todo를 카테고리 / 프로젝트 단위로 묶고, 카테고리별 진행률을 볼 수 있습니다.
- 기존 LocalStorage 데이터는 설정 페이지에서 서버 DB로 가져올 수 있습니다.

## 실행 방법

```bash
npm install
```

`.env.example`을 참고해 `.env`를 만듭니다.

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-long-random-secret"
PORT=3001
CLIENT_ORIGIN="http://localhost:5173"
```

DB 스키마를 SQLite에 반영합니다.

```bash
npm run db:push
```

개발 서버를 실행합니다.

```bash
npm run dev
```

- 프론트엔드: `http://localhost:5173`
- API 서버: `http://localhost:3001`
- Vite 개발 서버는 `/api` 요청을 Express 서버로 프록시합니다.

## DB 마이그레이션 방법

개발 환경에서는 Prisma push 방식으로 바로 스키마를 반영합니다.

```bash
npm run db:generate
npm run db:push
```

운영 환경에서 장기적으로 사용할 경우에는 Prisma migrate 워크플로로 전환하는 것을 권장합니다.

## 로그인 / 회원가입 사용 방법

처음 접속하면 로그인 화면이 표시됩니다.

- 회원가입: 이메일, 비밀번호, 선택 닉네임 입력
- 로그인: 이메일과 비밀번호 입력
- 로그아웃: 설정 페이지의 로그아웃 버튼 사용

인증되지 않은 사용자는 Todo, 카테고리, 회고, 목표, 타이머 데이터를 조회할 수 없습니다.

## 주요 기능

- Todo 등록, 수정, 삭제, 완료 처리
- 카테고리 생성, 수정, 삭제, 카테고리별 Todo 관리
- 카테고리 없는 Todo는 `미분류`로 표시
- 오늘 / 주간 / 월간 / 전체 Todo 보기
- 반복 Todo, 태그, 보관함
- 검색, 완료 여부, 우선순위, 날짜, 반복, 보관, 카테고리 필터
- 회고 섹션 템플릿
- 일간 / 주간 / 월간 목표
- D-Day와 진행률 표시
- 타이머 / 뽀모도로와 집중 세션 기록
- JSON 백업 / 복원
- LocalStorage 데이터 서버 마이그레이션
- 로딩 / 에러 상태와 Todo 완료 낙관적 업데이트

## 화면 구성

- 대시보드: 오늘 Todo, 완료율, 카테고리 요약, 집중 시간, 가까운 목표, 최근 회고
- 오늘: 오늘 표시 대상 Todo와 빠른 추가
- 주간: 주간 목표, 요일별 Todo, 카테고리 색상, 완료율
- 월간: 달력, 날짜별 Todo/목표 개수, 선택 날짜 상세
- 전체 Todo: 검색과 복합 필터
- 카테고리: 카테고리 목록, 카테고리별 Todo, 접기/펼치기, 빠른 추가
- 타이머: Todo 선택형 집중 타이머와 통계
- 회고: 일간 / 주간 / 월간 섹션 회고
- 목표: 일간 / 주간 / 월간 목표 탭
- 보관함: 보관된 Todo 확인, 복원, 삭제
- 설정: 백업, 복원, LocalStorage 마이그레이션, 타이머 설정, 단축키, 로그아웃

## 카테고리 기능 사용 방법

카테고리 페이지에서 `JPA 책`, `Spring 프로젝트`처럼 큰 단위를 만든 뒤, 각 카테고리 안에 하위 Todo를 추가할 수 있습니다.

- 카테고리 색상을 지정하면 Todo 카드와 캘린더에 배지 / dot으로 표시됩니다.
- 카테고리 삭제 시 Todo를 `미분류`로 이동하거나 함께 삭제할 수 있습니다.
- 전체 Todo 화면에서는 카테고리별 필터를 사용할 수 있습니다.

## 회고 템플릿 사용 방법

회고는 타입별 소제목 textarea로 작성합니다.

- 일간: 오늘 잘한 점, 아쉬운 점, 내일 할 일, 메모
- 주간: 이번 주 완료한 것, 이번 주 아쉬웠던 것, 다음 주 목표, 메모
- 월간: 이번 달 잘한 점, 이번 달 아쉬웠던 점, 다음 달 목표, 메모

전체 섹션이 비어 있으면 저장되지 않습니다.

## 일간 / 주간 / 월간 목표 사용 방법

목표 페이지에서 탭을 선택한 뒤 목표를 등록합니다.

- 일간 목표: `targetDate`
- 주간 목표: `weekStartDate`, `weekEndDate`
- 월간 목표: `month`

각 목표는 진행률, 완료 여부, D-Day 또는 기간 표시를 가집니다.

## 데이터 저장 방식

서버 DB가 기본 저장소입니다.

- DB: SQLite
- ORM: Prisma
- 인증: HttpOnly Cookie 세션
- LocalStorage는 기존 데이터 가져오기와 타이머 임시 상태 복원 용도로만 사용합니다.

주요 LocalStorage 키:

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

## LocalStorage에서 DB로 마이그레이션하는 방법

설정 페이지에서 `LocalStorage 데이터 서버로 가져오기`를 실행합니다.

- 기존 Todo, 회고, 목표, 집중 기록, 타이머 설정을 읽어 서버로 업로드합니다.
- 기존 Todo에 카테고리가 없으면 `미분류`로 처리합니다.
- 기존 회고 `content`는 섹션 구조로 변환합니다.
- 기존 목표에 타입이 없으면 `DAILY`로 처리합니다.
- 마이그레이션 후 LocalStorage 데이터를 삭제할지 선택할 수 있습니다.

## JSON 백업 / 복원 방법

설정 페이지에서 서버 DB 기준 JSON 백업과 복원을 할 수 있습니다.

```ts
type BackupData = {
  version: number;
  exportedAt: string;
  categories?: Category[];
  todos: Todo[];
  tags?: Tag[];
  reflections?: Reflection[];
  goals?: Goal[];
  focusSessions?: FocusSession[];
  timerSettings?: TimerSettings;
};
```

가져오기 전 기존 서버 데이터를 덮어쓸지 확인합니다. 잘못된 JSON 또는 `todos` 배열이 없는 데이터는 거부됩니다.

## API 목록

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Categories

- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/:id`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `PATCH /api/categories/reorder`
- `GET /api/categories/:id/todos`

### Todos

- `GET /api/todos`
- `POST /api/todos`
- `GET /api/todos/:id`
- `PUT /api/todos/:id`
- `DELETE /api/todos/:id`
- `PATCH /api/todos/:id/toggle`
- `PATCH /api/todos/:id/archive`
- `PATCH /api/todos/:id/unarchive`
- `PATCH /api/todos/reorder`

### Reflections / Goals / Timer / Backup

- `GET /api/reflections`
- `POST /api/reflections`
- `PUT /api/reflections/:id`
- `DELETE /api/reflections/:id`
- `GET /api/goals`
- `POST /api/goals`
- `PUT /api/goals/:id`
- `PATCH /api/goals/:id/toggle`
- `DELETE /api/goals/:id`
- `GET /api/focus-sessions`
- `POST /api/focus-sessions`
- `GET /api/timer-settings`
- `PUT /api/timer-settings`
- `GET /api/backup/export`
- `POST /api/backup/import`
- `POST /api/migrate/local-storage`

## 폴더 구조

```text
prisma
 ┗ schema.prisma
server
 ┣ auth.ts
 ┣ backup.ts
 ┣ db.ts
 ┣ index.ts
 ┣ serializers.ts
 ┗ validation.ts
src
 ┣ components
 ┃ ┣ calendar
 ┃ ┣ category
 ┃ ┣ common
 ┃ ┣ goal
 ┃ ┣ layout
 ┃ ┣ reflection
 ┃ ┣ timer
 ┃ ┗ todo
 ┣ hooks
 ┣ lib
 ┃ ┣ api
 ┃ ┗ storage.ts
 ┣ pages
 ┣ styles
 ┣ types
 ┣ App.tsx
 ┗ main.tsx
```

## 배포 시 주의사항

기존 정적 배포 버전은 GitHub Pages에서 동작 가능했지만, 백엔드와 DB 기능이 추가된 이후에는 GitHub Pages만으로 전체 기능을 사용할 수 없습니다.

백엔드 포함 버전은 Vercel, Render, Railway, Fly.io, 개인 서버, VPS 등 서버 실행이 가능한 환경에 배포해야 합니다.

Vite의 GitHub Pages 경로 호환을 위해 `vite.config.ts`의 base는 유지되어 있습니다.

```ts
base: "/dark-todo-planner/";
```

단, GitHub Pages에서는 `/api` 서버가 없으므로 로그인과 데이터 저장 기능은 동작하지 않습니다.

## 추후 개선 사항

- Prisma migrate 기반 운영 배포 정리
- Docker 배포 구성
- 서버 배포 자동화
- 캘린더 드래그 앤 드롭
- 자동 백업 기능
- 통계 차트
- 태그별 통계
- 반복 Todo 고급 설정
- 브라우저 알림 고도화
- PWA 지원

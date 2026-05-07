# Todo Planner

개인용으로 매일 쓰기 위한 다크모드 Todo / Planner입니다. 현재 버전은 단일 사용자 모드이며, Express 서버 하나가 React 정적 파일과 `/api` 요청을 함께 처리하고 Prisma + SQLite에 데이터를 저장합니다.

## 기술 스택

- React 18, TypeScript, Vite
- Tailwind CSS, lucide-react
- Express
- Prisma
- SQLite
- Docker / Docker Compose

## 현재 구조

```text
사용자 접속
→ Express 서버
→ React dist 정적 파일 제공
→ /api 요청은 Express API에서 처리
→ 서버 내부 default user 기준으로 Prisma + SQLite에 저장
```

## 주요 기능

- 오늘 중심 Todo 관리
- 오전 3시 기준의 오늘 날짜 계산
- 어제 미완료 Todo를 오늘로 복사 / 이동
- 카테고리별 Todo 보드
- 주간 요약 보기와 주간 목표 체크리스트
- 월간 달력, 날짜별 Todo, O/X 수행 체크
- 전체 Todo 검색 / 필터 / 정렬
- 일간 목표와 주간 목표
- 회고 섹션 템플릿
- 주제 보관함과 참고 링크
- 음악 링크 저장과 새 탭 열기
- Todo / 회고 / 주제 메모 Markdown 편집
- JSON 백업 / 복원
- LocalStorage 데이터 서버 마이그레이션

## 실행 방법

### 로컬 개발

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

접속:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3000`

개발 환경에서는 Vite가 `/api` 요청을 Express 서버로 프록시합니다.

### 운영 빌드

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

접속:

- App: `http://localhost:3000`
- Health Check: `http://localhost:3000/api/health`

운영 DB에 migration 파일이 준비된 환경에서는 `db:push` 대신 `npm run db:deploy`를 권장합니다.

### Docker

```bash
cp .env.example .env
docker compose up --build
```

접속:

- App: `http://localhost:3000`

Docker Compose는 `./data:/app/data` 볼륨을 연결합니다. SQLite DB 파일을 유지하려면 `data` 폴더를 삭제하지 마세요.

PowerShell 기준:

```powershell
cd C:\Users\guseo\dark-todo-planner
Copy-Item .env.example .env
docker compose up --build
```

백그라운드 실행과 로그 확인:

```powershell
docker compose up --build -d
docker compose logs -f todo-planner
```

중지:

```powershell
docker compose down
```

`docker compose down`은 컨테이너를 내리지만 `./data` 폴더는 유지합니다. `./data` 폴더나 그 안의 SQLite DB 파일을 삭제하면 저장된 데이터도 사라집니다.

## 환경 변수

로컬 예시:

```env
DATABASE_URL="file:../data/dev.db"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

Docker / 운영 예시:

```env
DATABASE_URL="file:../data/prod.db"
PORT=3000
NODE_ENV=production
```

Prisma SQLite 경로는 `prisma/schema.prisma` 기준 상대 경로입니다. `file:../data/prod.db`는 프로젝트 루트의 `data/prod.db`를 가리킵니다.

## 단일 사용자 모드

이 프로젝트는 개인용으로 쓰기 쉽도록 로그인/회원가입 화면을 제거했습니다. 서버는 요청이 들어오면 내부 default user를 자동으로 준비하고, 모든 Todo와 카테고리, 목표, 회고, 주제, 음악 링크를 그 userId로 저장합니다.

공개 인터넷에 배포하면 URL을 아는 사람이 앱에 접근할 수 있습니다. 외부 공개 배포가 필요하다면 reverse proxy 기본 인증, VPN, 방화벽, 사설 네트워크 같은 접근 제한을 추가하는 것을 권장합니다.

## GitHub Pages 배포 한계

GitHub Pages는 정적 프론트만 제공하므로 서버 저장, API, DB 기능은 동작하지 않습니다.

- GitHub Pages: 정적 미리보기용
- Express 단일 서버: 실제 개인 사용 권장 방식
- Docker / VPS / Render / Railway / Fly.io: 백엔드 포함 배포 가능

`GITHUB_PAGES=true`일 때 Vite base가 `/dark-todo-planner/`로 설정됩니다.

## 데이터 저장과 백업

- 기본 저장소: SQLite
- DB 파일 위치: `data/*.db`
- JSON 백업: 설정 페이지에서 내보내기 / 가져오기
- 백업 포함 데이터: categories, todos, reflections, goals, topics, topicLinks, musicLinks

SQLite는 개인용 로컬 PC, VPS, 단일 서버에 적합합니다. Render/Railway 같은 PaaS에서는 persistent disk 설정이 없으면 재배포나 재시작 시 DB 파일이 사라질 수 있습니다.

## 날짜 기준과 Todo 이동

Todo Planner의 “오늘”은 자정이 아니라 오전 3시에 바뀝니다.

- 2026-05-08 02:59까지는 2026-05-07을 오늘로 취급
- 2026-05-08 03:00부터는 2026-05-08을 오늘로 취급

오늘 페이지의 기본 추가 날짜, 오늘 Todo, 오늘 목표, 완료율 통계, 어제 Todo 가져오기는 모두 이 기준을 사용합니다.

오늘 페이지에서는 `어제 미완료 가져오기`로 전날 남은 Todo를 오늘로 가져올 수 있습니다.

- 복사하기: 어제 Todo를 그대로 두고 오늘 Todo를 새로 생성
- 이동하기: 기존 Todo의 날짜를 오늘로 변경
- 이미 오늘 같은 제목과 카테고리의 Todo가 있으면 중복 생성을 건너뜁니다.

## 화면 흐름

- 오늘: 오늘 목표, 빠른 Todo 추가, 어제 미완료 가져오기, 카테고리별 오늘 Todo
- 주간: 주간 목표와 7일 요약 보드, 선택 날짜 Todo 확인
- 월간: 월간 달력과 선택 날짜 Todo 확인

주간/월간 오른쪽 패널의 선택 날짜 빠른 추가 입력은 제거했습니다. Todo 추가는 오늘 페이지의 빠른 추가나 각 카테고리 내부의 `+ 하위 Todo 추가` 흐름을 사용합니다.

## Markdown 편집

Todo 메모, 회고 섹션, 주제 메모, 음악 링크 메모에는 compact Markdown 툴바가 제공됩니다.

지원:

- 굵게 / 기울임 / 취소선
- 글머리 / 번호 목록 / 체크리스트
- 인용 / 코드 / 링크

저장 형식은 기존 plain text와 호환되는 Markdown 문자열입니다.

## API 목록

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

### Reflections

- `GET /api/reflections`
- `POST /api/reflections`
- `PUT /api/reflections/:id`
- `DELETE /api/reflections/:id`

### Goals

- `GET /api/goals`
- `POST /api/goals`
- `GET /api/goals/:id`
- `PUT /api/goals/:id`
- `PATCH /api/goals/:id/toggle`
- `DELETE /api/goals/:id`

### Topics

- `GET /api/topics`
- `POST /api/topics`
- `GET /api/topics/:id`
- `PUT /api/topics/:id`
- `DELETE /api/topics/:id`
- `POST /api/topics/:id/links`
- `PUT /api/topics/:id/links/:linkId`
- `DELETE /api/topics/:id/links/:linkId`

### Music Links

- `GET /api/music-links`
- `POST /api/music-links`
- `PUT /api/music-links/:id`
- `DELETE /api/music-links/:id`

### Backup

- `GET /api/backup/export`
- `POST /api/backup/import`
- `POST /api/migrate/local-storage`

## package.json scripts

- `npm run dev`: Vite dev server와 Express dev server 동시 실행
- `npm run build`: React build + Express TypeScript build
- `npm run build:pages`: GitHub Pages용 `/dark-todo-planner/` base 정적 build
- `npm run start`: production Express 서버 실행
- `npm run db:generate`: Prisma Client 생성
- `npm run db:push`: Prisma schema를 DB에 반영
- `npm run db:migrate`: 개발 환경에서 Prisma migration 생성 및 적용
- `npm run db:deploy`: 운영 환경에서 이미 생성된 migration 적용
- `npm run db:studio`: Prisma Studio 실행

## 폴더 구조

```text
data
prisma
server
src
 ┣ components
 ┃ ┣ calendar
 ┃ ┣ common
 ┃ ┣ editor
 ┃ ┣ goal
 ┃ ┣ layout
 ┃ ┣ monthly
 ┃ ┗ todo
 ┣ hooks
 ┃ ┣ usePlannerData.ts
 ┃ ┣ useTodos.ts
 ┃ ┣ useCategories.ts
 ┃ ┣ useReflections.ts
 ┃ ┣ useGoals.ts
 ┃ ┣ useTopics.ts
 ┃ ┣ useMusicLinks.ts
 ┃ ┗ useBackup.ts
 ┣ lib
 ┣ pages
 ┣ styles
 ┣ types
 ┣ App.tsx
 ┗ main.tsx
Dockerfile
docker-compose.yml
```

## 문제 해결

- 앱 접속 시 데이터가 비어 있음: `.env`의 `DATABASE_URL`이 기존 DB 파일을 가리키는지 확인하세요.
- DB 파일이 생성되지 않음: `data` 폴더가 있는지, Prisma schema 기준 경로가 맞는지 확인하세요.
- Docker 재실행 후 데이터가 사라짐: `./data:/app/data` 볼륨이 유지되는지 확인하세요.
- GitHub Pages에서 저장이 안 됨: 정상입니다. GitHub Pages에는 `/api` 서버와 SQLite DB가 없습니다.
- 공개 URL에서 누구나 앱에 들어올 수 있음: 단일 사용자 모드의 특성입니다. 공개 배포 시 접근 제한을 추가하세요.

## 추후 개선 사항

### 1순위

- Prisma migrate 기반 운영 배포 정리
- 서버 백업 자동화
- PostgreSQL 전환 검토

### 2순위

- 통계 차트
- 태그별/카테고리별 통계

### 3순위

- 캘린더 드래그 앤 드롭
- PWA 지원

# Dark Todo Planner

매일 브라우저에서 쓰기 위한 개인용 다크모드 Todo / Planner입니다. 현재 버전은 Express 서버 하나가 React 정적 파일과 `/api` 요청을 함께 처리하고, Prisma + SQLite에 데이터를 저장하는 구조입니다.

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

## 현재 구조

```text
사용자 접속
→ Express 서버
→ React dist 정적 파일 제공
→ /api 요청은 Express API에서 처리
→ Prisma + SQLite에 데이터 저장
```

주요 기능은 서버 DB 기준으로 동작합니다.

- 회원가입 / 로그인 / 로그아웃 / 현재 사용자 조회
- Todo / Category / Reflection / Goal / FocusSession / TimerSettings 서버 저장
- 카테고리별 Todo 구조
- JSON 백업 / 복원
- LocalStorage 데이터 서버 마이그레이션

## GitHub Pages 배포 한계

기존 정적 배포 버전은 GitHub Pages에서 동작 가능했지만, 백엔드와 DB 기능이 추가된 이후에는 GitHub Pages만으로 전체 기능을 사용할 수 없습니다.

GitHub Pages는 정적 프론트만 제공하므로 로그인, 저장, API 기능은 동작하지 않습니다.

백엔드 포함 버전은 Vercel, Render, Railway, Fly.io, 개인 서버, VPS 등 서버 실행이 가능한 환경에 배포해야 합니다.

## 배포 방식 정리

1. GitHub Pages
   - 정적 프론트 미리보기용
   - API / DB 기능 사용 불가
   - `GITHUB_PAGES=true`일 때 Vite base가 `/dark-todo-planner/`로 설정됩니다.

2. Express 단일 서버 배포
   - React 정적 파일 + API + DB를 한 서버에서 제공
   - 실제 개인 사용 권장 방식
   - 기본 Vite base는 `/`입니다.

3. 프론트 / 백엔드 분리 배포
   - 프론트: GitHub Pages 또는 Vercel
   - 백엔드: Render / Railway / VPS
   - CORS와 Cookie 설정이 더 복잡합니다.

이번 프로젝트는 2번 Express 단일 서버 배포를 우선 지원합니다.

## 로컬 개발 실행 방법

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

개발 주소:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3000`

개발 환경에서는 Vite가 `/api` 요청을 Express 서버로 프록시합니다. 필요하면 `VITE_API_BASE_URL=http://localhost:3000`을 사용할 수 있습니다.

## 운영 빌드 실행 방법

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

운영 실행 후 접속:

- App: `http://localhost:3000/`
- Health Check: `http://localhost:3000/api/health`

`npm run start`는 `server/dist/index.js`를 실행합니다. `npm run build`는 React `dist`와 Express 서버 build를 함께 생성합니다.

## package.json scripts

- `npm run dev`: Vite dev server와 Express dev server 동시 실행
- `npm run client:dev`: Vite dev server 실행
- `npm run server:dev`: Express server를 tsx watch로 실행
- `npm run build`: React build + Express TypeScript build
- `npm run start`: production Express 서버 실행
- `npm run db:generate`: Prisma Client 생성
- `npm run db:push`: Prisma schema를 DB에 반영
- `npm run db:studio`: Prisma Studio 실행

## 환경 변수 설정

`.env.example`을 참고해 `.env`를 만듭니다. 실제 `.env`는 Git에 올리지 않습니다.

로컬 예시:

```env
DATABASE_URL="file:../data/dev.db"
JWT_SECRET="change-this-long-random-secret"
COOKIE_SECURE=false
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

운영 예시:

```env
DATABASE_URL="file:../data/prod.db"
JWT_SECRET="strong-production-secret"
COOKIE_SECURE=true
PORT=3000
NODE_ENV=production
```

주의:

- 운영 환경에서 `JWT_SECRET`은 반드시 강력한 랜덤 문자열로 설정하세요.
- `JWT_SECRET`이 없으면 production 서버는 시작되지 않습니다.
- `SESSION_SECRET`은 이전 호환용으로만 지원하며 새 설정은 `JWT_SECRET`을 사용합니다.

## Express 단일 서버 제공 방식

서버 라우팅 순서는 다음 구조입니다.

```text
1. JSON / Cookie middleware
2. 개발 환경 CORS middleware
3. /api 라우트
4. /api 404 JSON 응답
5. React dist 정적 파일 제공
6. React fallback
7. 서버 에러 핸들러
```

`/api/*`는 Express API가 처리합니다. 그 외 요청은 `dist/index.html`로 fallback되어 새로고침이나 직접 URL 접근 시 404가 나지 않도록 했습니다.

## CORS / Cookie 설정

production에서는 React와 API가 같은 Express origin에서 제공되므로 CORS에 의존하지 않습니다.

development에서는 `CLIENT_URL`과 일치하는 origin만 허용합니다.

- `Access-Control-Allow-Credentials: true`
- Cookie 인증은 HttpOnly Cookie 사용
- 인증 토큰은 LocalStorage에 저장하지 않음
- `COOKIE_SECURE=true`이면 secure cookie 사용

GitHub Pages 프론트 + 별도 API 서버 구조는 SameSite / Secure / CORS 설정이 더 복잡하므로 기본 권장 방식이 아닙니다.

## Prisma DB 생성 방법

```bash
npm run db:generate
npm run db:push
```

개발 환경에서는 `db:push`로 빠르게 SQLite 스키마를 반영합니다. 운영에서 장기적으로 관리하려면 Prisma migrate 워크플로로 전환하는 것을 권장합니다.

## SQLite 파일 위치와 주의사항

Prisma SQLite 경로는 `prisma/schema.prisma` 기준 상대 경로입니다. 이 프로젝트는 DB 파일을 루트 `data` 폴더에 모으기 위해 다음처럼 설정합니다.

```env
DATABASE_URL="file:../data/prod.db"
```

주의:

- `data/*.db`와 journal 파일은 Git에 올리지 않습니다.
- Render/Railway 같은 PaaS에서는 재배포나 재시작 시 SQLite 파일이 유지되는지 확인해야 합니다.
- 영구 디스크를 설정하지 않으면 데이터가 사라질 수 있습니다.
- 개인 VPS나 장기 운영 환경에서는 정기 백업을 권장합니다.

## Render 배포 가이드

Build Command:

```bash
npm install && npm run db:generate && npm run build
```

Start Command:

```bash
npm run db:push && npm run start
```

환경 변수 예시:

```text
DATABASE_URL=file:../data/prod.db
JWT_SECRET=강력한_랜덤_문자열
COOKIE_SECURE=true
NODE_ENV=production
PORT=10000
```

Render에서 SQLite를 안정적으로 쓰려면 Persistent Disk 설정이 필요할 수 있습니다. Persistent Disk를 사용하지 않으면 재배포 또는 재시작 시 DB 파일이 사라질 수 있습니다.

## Railway 배포 가이드

환경 변수 예시:

```text
DATABASE_URL=file:../data/prod.db
JWT_SECRET=강력한_랜덤_문자열
COOKIE_SECURE=true
NODE_ENV=production
```

Railway에서 SQLite 파일 저장이 영구적으로 유지되는지 확인해야 합니다. 장기적으로는 Railway PostgreSQL을 사용하는 것이 더 안정적일 수 있습니다.

## PostgreSQL 전환 안내

SQLite는 개인용 로컬이나 VPS에서는 간단하고 좋지만, 서버 재배포 시 파일 유지가 중요한 환경에서는 주의가 필요합니다.

Render/Railway 같은 환경에서 장기적으로 사용할 경우 PostgreSQL로 전환하는 것이 더 안정적입니다. Prisma를 사용하고 있으므로 `DATABASE_URL`과 `provider`를 변경하면 PostgreSQL 전환이 가능합니다.

## API Health Check

```bash
curl http://localhost:3000/api/health
```

응답 예시:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## 로그인 / 회원가입 사용 방법

처음 접속하면 로그인 화면이 표시됩니다.

- 회원가입: 이메일, 비밀번호, 선택 닉네임 입력
- 로그인: 이메일과 비밀번호 입력
- 로그아웃: 설정 페이지의 로그아웃 버튼 사용

비밀번호는 bcrypt로 해시 저장되며 API 응답에 `passwordHash`는 포함되지 않습니다.

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
- `GET /api/goals/:id`
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

## 문제 해결

- `JWT_SECRET 환경 변수가 필요합니다.`: production에서 `JWT_SECRET`을 설정하세요.
- 로그인 후 API가 401을 반환함: 같은 origin 배포인지, 개발 환경에서는 `CLIENT_URL`과 요청 origin이 일치하는지 확인하세요.
- DB 파일이 생성되지 않음: `data` 폴더가 있는지, `DATABASE_URL=file:../data/prod.db`처럼 Prisma schema 기준 경로인지 확인하세요.
- 재배포 후 데이터가 사라짐: 배포 환경의 persistent disk 설정을 확인하세요.
- GitHub Pages에서 로그인이 안 됨: 정상입니다. GitHub Pages에는 `/api` 서버가 없습니다.

## 폴더 구조

```text
data
 ┗ .gitkeep
prisma
 ┗ schema.prisma
server
 ┣ auth.ts
 ┣ backup.ts
 ┣ db.ts
 ┣ index.ts
 ┣ serializers.ts
 ┗ validation.ts
scripts
 ┗ write-server-dist-package.cjs
src
 ┣ components
 ┣ hooks
 ┣ lib
 ┣ pages
 ┣ styles
 ┣ types
 ┣ App.tsx
 ┗ main.tsx
```

## 추후 개선 사항

- Prisma migrate 기반 운영 배포 정리
- Docker 배포 구성
- PostgreSQL 전환
- 서버 백업 자동화
- 캘린더 드래그 앤 드롭
- 통계 차트
- PWA 지원

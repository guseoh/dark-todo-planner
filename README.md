# Dark Todo Planner

개인적으로 사용할 Todo 관리 도구가 필요해서 만든 웹 앱입니다.

오늘·주간·월간 Todo, 프로젝트와 메모, 학습 기록과 알림을 한 곳에서 관리합니다.

- Frontend: React + Vite
- API: Hono + Cloudflare Workers
- Database: Cloudflare D1

## 현재 기능

- Today / Week / Month / Inbox / Project 기반 Todo 관리
- Planning, Time Block, Focus 기록과 예상 시간 정확도 확인
- Scratchpad, Memo, 휴지통, Backup / Restore
- Routine Bundle, Discord Todo 리마인더, Calendar ICS 내보내기
- PWA Share → Inbox, Todo 변경 IndexedDB 오프라인 큐
- Learning Inbox: Notion 문제·기술 블로그 동기화 + Workers AI 학습 가이드

## 외부 연동

- Notion: 데일리 코드 읽기와 기술 블로그를 Learning Inbox로 Pull 동기화
- Discord: 미완료 Todo 및 개별 Todo 리마인더
- Cloudflare Workers AI: Learning 항목의 핵심 포인트·확인 질문·적용 질문 생성

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run auth:hash
```

`npm run auth:hash`에서 사용할 비밀번호를 입력하면 scrypt 해시가 출력됩니다.

저장소 루트에 커밋하지 않는 `.dev.vars` 파일을 만들고 로그인 정보를 설정합니다.

```dotenv
AUTH_USERNAME=your-username
AUTH_PASSWORD_HASH=scrypt$16384$8$5$generated-salt$generated-hash
SESSION_SECRET=at-least-32-random-characters
```

로컬 D1 migration을 적용한 뒤 실행합니다.

```bash
npm run db:migrate:local
npm run dev
```

Wrangler가 표시한 로컬 주소에서 설정한 계정으로 로그인하면 됩니다.

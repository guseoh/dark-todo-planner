# Dark Todo Planner

React/Vite 정적 자산과 Hono API를 하나의 Cloudflare Worker에서 제공하고, 데이터는 Drizzle ORM과 Cloudflare D1에 저장합니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run auth:hash
```

출력된 해시를 사용해 저장소 루트에 커밋하지 않는 `.dev.vars`를 만듭니다.

```dotenv
AUTH_USERNAME=your-username
AUTH_PASSWORD_HASH=pbkdf2-sha256$100000$generated-salt$generated-hash
SESSION_SECRET=at-least-32-random-characters
```

```bash
npm run db:migrate:local
npm run dev
```

Wrangler가 표시한 로컬 URL에서 로그인합니다. 앱은 polling을 사용하지 않으며, 목록 API는 최대 100개 단위 pagination으로 읽습니다.

## 로컬 D1 migration

```bash
npm run db:migrate:local
```

새 migration이 필요하면 `worker/db/schema.ts`를 변경한 뒤 생성합니다.

```bash
npm run db:generate
```

## 필요한 Secret

- `AUTH_USERNAME`: 고정 로그인 사용자명
- `AUTH_PASSWORD_HASH`: `npm run auth:hash`로 만든 PBKDF2-SHA256 해시
- `SESSION_SECRET`: 세션 쿠키 서명용 32자 이상의 무작위 문자열

Preview와 Production에 각각 등록합니다.

```bash
npx wrangler secret put AUTH_USERNAME --env preview
npx wrangler secret put AUTH_PASSWORD_HASH --env preview
npx wrangler secret put SESSION_SECRET --env preview
npx wrangler secret put AUTH_USERNAME --env production
npx wrangler secret put AUTH_PASSWORD_HASH --env production
npx wrangler secret put SESSION_SECRET --env production
```

비밀번호 원문과 `.dev.vars`는 커밋하지 않습니다. 세션은 7일 후 만료되며 `HttpOnly`, `Secure`, `SameSite=Strict` 쿠키를 사용합니다.

## Cloudflare 배포 준비 명령

```bash
npx wrangler login
npx wrangler d1 create todo-planner-preview
npx wrangler d1 create todo-planner-production
```

생성 결과의 ID를 `wrangler.jsonc`의 Preview/Production `database_id`에 각각 입력한 다음 Secret을 등록하고 migration을 적용합니다.

```bash
npm run typecheck
npm test
npm run build
npm run db:migrate:preview
npm run db:migrate:production
npm run deploy:preview
# Preview 확인 후
npm run deploy:production
```

두 환경은 별도 D1 binding을 사용하고 무료 `workers.dev` 주소에 배포됩니다.

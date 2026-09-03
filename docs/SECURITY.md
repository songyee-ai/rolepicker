# 민감 정보와 접근 통제

## 한 줄 요약

Supabase 키는 **`.env.local` 파일에만** 있고, 그 파일은 깃허브로 나가지 않는다. DB는 브라우저에서 오는 접근을 **전부 거부**하고, 모든 읽기·쓰기는 서버를 거친다.

## 비밀값이 있는 곳과 없는 곳

| 어디 | 무엇 | 깃허브에 올라가나 |
|---|---|---|
| `.env.local` | 실제 Supabase 주소와 키 | **아니오** (`.gitignore`) |
| `.env.example` | 값이 비어 있는 빈칸 목록 | 예 (값이 없으니 안전) |
| Vercel 환경변수 | 실제 배포용 키 | 아니오 (Vercel 대시보드에만) |
| 소스 코드 | 없음 | — |

`.gitignore`에 `.env*`가 있어서 `.env`로 시작하는 파일은 전부 제외되고, `!.env.example` 한 줄로 예시 파일만 예외로 올린다.

## 세 겹의 차단

### 1겹. 키 이름에 `NEXT_PUBLIC_`을 붙이지 않는다

Next.js는 `NEXT_PUBLIC_`으로 시작하는 환경변수를 **브라우저 번들에 심는다.** 붙이는 순간 누구나 개발자 도구에서 볼 수 있다. 그래서 이 프로젝트에는 `NEXT_PUBLIC_` 변수가 하나도 없고, 검사가 그걸 확인한다.

### 2겹. `server-only`

`back/env.ts`와 `back/supabase.ts`의 첫 줄은 이렇다.

```ts
import 'server-only';
```

이 파일을 화면 쪽 코드에서 실수로 불러오면 **빌드가 그 자리에서 실패한다.** 키가 브라우저로 새는 사고를 사람의 주의력이 아니라 도구가 막는다.

### 3겹. DB의 RLS

`supabase/migrations/0001_init.sql`에서 모든 테이블에 RLS(Row Level Security)를 켜고, 브라우저 역할(`anon`, `authenticated`)에 대해 **항상 거짓인 정책**을 만든다.

```sql
alter table public.teams enable row level security;

create policy deny_browser_access on public.teams
  as restrictive for all to anon, authenticated
  using (false) with check (false);
```

여기에 권한 자체도 회수한다.

```sql
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
```

정책만으로도 막히지만 권한 회수가 남아 있으면, 나중에 누군가 정책을 하나 추가했을 때 그것이 사고가 되지 않는다. 마지막 `alter default privileges` 줄 덕분에 **앞으로 새로 만드는 테이블도 기본적으로 막힌다.**

서버는 `service_role` 키를 쓴다. 이 역할은 RLS를 우회하도록 만들어진 역할이므로 서버에서는 정상적으로 동작한다. 즉 RLS는 "서버만 통과하는 문"을 만드는 장치다.

**결과:** Supabase 주소가 새더라도 브라우저에서 읽을 수 있는 데이터가 없다.

## 링크가 열쇠인 것의 의미

PRD §3-1이 정한 원칙이다. 로그인도, 비밀번호도, 권한 검사도 없다. **링크를 아는 사람은 누구나 그 조를 읽고 고칠 수 있다.** 이건 취약점이 아니라 설계다 — 접속부터 결과 확인까지 30초 안에 끝내려면 로그인을 넣을 수 없다 (PRD §2).

대신 링크가 추측되지 않아야 한다.

- **조합 수 약 10억.** 단어 64개 × hex 6자리. 목업의 4자리(`MANGO-7B2K`)는 PRD §14의 지적에 따라 6자리로 늘렸다
- **암호용 난수 사용.** `Math.random()`이 아니라 `node:crypto`. `Math.random()`은 값을 몇 개 보면 다음 값을 예측할 수 있다
- **요청 제한.** `/api/resolve`는 한 곳에서 1분에 20번까지. 자동으로 코드를 계속 넣어보는 것을 막는다
- **응답을 구분하지 않는다.** 형식이 틀린 코드와 없는 조에 같은 답을 준다. 구분해주면 "형식은 맞다"는 정보를 주게 되어 대입에 도움이 된다

## 이 조가 담는 정보

들어가는 것은 **조원 이름과 역할 기록**뿐이다. 이메일, 전화번호, 생년월일, 사진, 로그인 정보를 받지 않는다. 링크가 새더라도 노출되는 것이 이름 목록 수준이 되도록 애초에 적게 받는다.

브라우저에 남는 것은 최근 사용한 조 목록(`localStorage`)이고, 이건 서버에 저장하지 않는다 (PRD §8).

## 검사로 지키는 것

`back/boundaries.test.ts`가 `npm test`마다 다음을 확인한다.

- `front`가 `back`을 불러오지 않는다
- `shared`가 어느 쪽도 불러오지 않는다
- 서버 키 이름이 `back` 폴더 밖에 나타나지 않는다
- `NEXT_PUBLIC_` 변수가 하나도 없다
- `.gitignore`에 `.env*`가 있다
- `.env.example`에 실제 값이 들어 있지 않다
- DB나 설정을 만지는 파일에 `server-only`가 걸려 있다
- SQL의 모든 테이블에 RLS가 켜져 있다

약속을 문서로만 두면 지켜지지 않는다. 선을 넘으면 검사가 실패해서, 잘못된 코드가 깃허브까지 가지 않는다.

## 키가 새면

1. Supabase 대시보드 → Project Settings → API → `service_role` 키 재발급
2. `.env.local`과 Vercel 환경변수를 새 키로 교체
3. 깃 이력에 키가 들어갔다면 키 교체만으로는 부족하다 — 이력에서 지워야 한다. 다만 **재발급하면 옛 키는 즉시 무효**가 되므로 1번이 먼저다

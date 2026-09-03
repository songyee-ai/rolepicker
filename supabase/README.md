# Supabase 준비하기

DB를 붙이는 순서. 프로그래밍 지식은 필요하지 않고, 복사·붙여넣기만 하면 된다. 10분 정도 걸린다.

## 1. 프로젝트 만들기

1. https://supabase.com 에 가서 깃허브 계정으로 로그인
2. `New project` 클릭
3. 입력할 것
   - **Name**: `rolepicker` (아무거나 괜찮다)
   - **Database Password**: 자동 생성 버튼을 누르고 **어딘가에 저장.** 이 비밀번호는 우리 코드에서는 쓰지 않지만, 잃어버리면 DB에 직접 접속할 방법이 없어진다
   - **Region**: `Northeast Asia (Seoul)` — 서울이 가장 빠르다
   - **Plan**: Free
4. `Create new project` → 2~3분 기다린다

## 2. 표(테이블) 만들기

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. `New query` 클릭
3. 이 폴더의 **`migrations/0001_init.sql` 파일 내용을 전부 복사해서** 붙여넣기
4. 오른쪽 아래 `Run` 클릭

`Success. No rows returned`가 나오면 된 것이다.

> 빨간 오류가 나오면 **그 오류 문구를 그대로 알려주세요.** 이 SQL은 실제 DB에서 아직 돌려보지 않은 상태라 손볼 곳이 있을 수 있다.

확인: 왼쪽 **Table Editor**에 표 7개가 보여야 한다.

```
teams  members  roles  assignments  assignment_items  attendances  timer_sessions
```

각 표 이름 옆에 **자물쇠 아이콘**이 있으면 RLS가 켜진 것이다.

## 3. 값 두 개 복사하기

1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API**
2. 두 값을 복사한다

| 화면에 있는 이름 | 우리가 쓸 이름 | 생김새 |
|---|---|---|
| **Project URL** | `SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| **service_role** (Project API keys 아래, `Reveal` 눌러야 보인다) | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` 로 시작하는 아주 긴 글자 |

> `anon` / `public` 키는 **쓰지 않는다.** 브라우저에서 DB에 직접 접근하지 않기 때문이다.
>
> `service_role` 키는 DB를 통째로 열 수 있는 열쇠다. 채팅·메일·이슈에 붙여넣지 말고, 아래 4번처럼 파일에만 넣는다.

## 4. 값 넣기

프로젝트 폴더(`rolepicker`)에 **`.env.local`** 이라는 파일을 만들고 이렇게 적는다.

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- 따옴표는 붙이지 않는다
- `=` 앞뒤에 공백을 넣지 않는다
- 이 파일은 `.gitignore`에 있어서 **깃허브로 나가지 않는다** (docs/SECURITY.md)

`.env.example` 파일이 빈칸 형태로 이미 들어 있으니, 그걸 복사해서 이름만 `.env.local`로 바꾸고 값을 채우면 편하다.

## 5. 확인

```bash
npm run dev
```

http://localhost:3000 이 열리면 준비 완료다.

## 나중에 배포할 때 (M4)

Vercel에 올릴 때는 같은 값 두 개를 Vercel 대시보드의 **Settings → Environment Variables**에 넣는다. `.env.local`은 내 컴퓨터에만 있는 파일이라 배포 서버에는 올라가지 않는다.

## 표가 하는 일

| 표 | 담는 것 |
|---|---|
| `teams` | 조. 이름이 없고 링크(`slug`)로 구분한다 |
| `members` | 조원. 조를 떠나도 지우지 않고 `active`를 내린다 |
| `roles` | 역할 3개. 조마다 따로 들어간다 — 나중에 역할을 추가할 수 있게 |
| `assignments` | 하루에 한 줄. 같은 날 두 줄이 생기지 않도록 DB가 막는다 |
| `assignment_items` | 그날 누가 어떤 역할이었나. 그루도 한 줄씩 |
| `attendances` | 그날 참여했는지. 빈자리도 기록에 남는다 |
| `timer_sessions` | 타이머 (M2에서 사용) |

자세한 설계 의도는 `migrations/0001_init.sql`의 주석에 적어뒀다.

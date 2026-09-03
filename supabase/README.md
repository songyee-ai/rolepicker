# Supabase 준비하기

DB를 붙이는 순서. 프로그래밍 지식은 필요하지 않고 복사·붙여넣기만 하면 된다. 10분 정도 걸린다.

---

## 1. 프로젝트 만들기

1. https://supabase.com 에 가서 오른쪽 위 `Sign in` → 깃허브 계정으로 로그인
2. `New project` 클릭
3. 입력할 것
   - **Name**: `rolepicker` (아무거나 괜찮다)
   - **Database Password**: 자동 생성 버튼을 누르고 **어딘가에 저장.** 우리 코드에서는 쓰지 않지만, 잃어버리면 DB에 직접 접속할 방법이 없어진다
   - **Region**: `Northeast Asia (Seoul)` — 서울이 가장 빠르다
   - **Plan**: Free
4. `Create new project` → 2~3분 기다린다

기다리는 동안 화면에 `Setting up project...` 같은 문구가 뜬다. 다 되면 프로젝트 홈이 나온다.

---

## 2. 표(테이블) 만들기

### 2-1. SQL을 클립보드에 담는다

파일을 열어서 직접 긁을 필요가 없다. 이 명령을 한 번 실행하면 클립보드에 들어간다.

```bash
cat /c/airrel_work/rolepicker/supabase/migrations/0001_init.sql | clip
```

아무 메시지도 안 나오는 게 정상이다.

> 직접 열어서 복사하고 싶으면: `notepad C:/airrel_work/rolepicker/supabase/migrations/0001_init.sql` 로 열고 `Ctrl+A` (전체 선택) → `Ctrl+C` (복사).

### 2-2. Supabase에서 SQL Editor를 연다

1. Supabase 프로젝트 화면 **맨 왼쪽 세로 아이콘 줄**을 본다
2. 위에서 네 번째쯤에 **터미널 모양 아이콘**(`>_`)이 있다. 마우스를 올리면 **SQL Editor**라고 뜬다. 그걸 클릭
   - 못 찾으면 `Ctrl + K`를 누르고 `SQL Editor`라고 입력해도 된다
3. 화면 가운데에 **커다란 빈 칸**이 나온다. 여기가 SQL을 적는 곳이다
   - 이미 `New query` 탭이 열려 있으면 그대로 쓰면 된다. 없으면 위쪽 `+` 나 `New query`를 클릭

### 2-3. 붙여넣고 실행한다

1. 그 빈 칸을 한 번 **클릭**해서 커서를 넣는다
2. **`Ctrl + V`**
3. 190줄쯤 되는 글이 붙는다. 제대로 붙었는지 확인하는 방법
   - 맨 윗줄이 `-- ════...` 로 시작한다
   - 맨 아랫줄이 `alter default privileges ...` 로 끝난다
4. **오른쪽 아래 초록색 `Run` 버튼**을 클릭 (`Ctrl + Enter` 도 같다)

### 2-4. 결과 확인

화면 아래쪽에 결과 칸이 생긴다.

| 나온 것 | 뜻 |
|---|---|
| `Success. No rows returned` | **성공.** 다음 단계로 |
| 빨간 글씨 | 실패. **그 문구를 그대로 알려주세요** |

> 이 SQL은 실제 DB에서 아직 돌려보지 못한 상태다. 오류가 나면 손볼 곳이 있다는 뜻이니 그대로 알려주면 고친다. 잘못 누른 게 아니다.

### 2-5. 표가 생겼는지 눈으로 본다

왼쪽 아이콘 줄에서 **표 모양 아이콘**(**Table Editor**)을 클릭한다. 왼쪽 목록에 표 7개가 보여야 한다.

```
teams  members  roles  assignments  assignment_items  attendances  timer_sessions
```

표 이름 옆에 **자물쇠 아이콘**이 있으면 RLS(브라우저 직접 접근 차단)가 켜진 것이다.

표를 눌러도 내용은 비어 있다. 아직 조를 하나도 안 만들었으니 정상이다.

---

## 3. 값 두 개 복사하기

1. 왼쪽 아이콘 줄 **맨 아래 톱니바퀴**(**Project Settings**)를 클릭
2. 왼쪽 메뉴에서 **API** 를 클릭 (**API Keys** 로 되어 있을 수도 있다)

여기서 두 값을 가져온다.

### 첫 번째 — Project URL

- **Project URL** 이라는 칸에 `https://xxxxxxxxxxxx.supabase.co` 같은 주소가 있다
- 옆의 **복사 아이콘**을 누른다

### 두 번째 — service_role 키

- 조금 아래 **Project API keys** 칸에 키가 두 개 있다
- `anon` `public` 은 **쓰지 않는다**
- `service_role` `secret` 이라고 적힌 것을 찾는다. 값이 `••••••` 로 가려져 있다
- **`Reveal`** 또는 **눈 모양 아이콘**을 눌러 보이게 한 뒤 **복사 아이콘**을 누른다
- `eyJ` 로 시작하는 아주 긴 글자다

> **이 키는 DB를 통째로 열 수 있는 열쇠다.** 채팅·메일·이슈에 붙여넣지 말고, 아래 4번처럼 파일에만 넣는다. 자세한 이유는 `docs/SECURITY.md` 에 있다.

두 값을 한 번에 복사할 수는 없으니, 3번과 4번을 **값 하나씩 두 번** 왕복하는 게 편하다.

---

## 4. 값 넣기

`.env.local` 파일이 이미 만들어져 있다. 열어서 `=` 뒤에 값을 붙이면 된다.

```bash
notepad C:/airrel_work/rolepicker/.env.local
```

메모장이 열리면 이런 두 줄이 보인다(위쪽 `#` 로 시작하는 설명 줄들은 그대로 둔다).

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

각 줄의 `=` **바로 뒤**에 커서를 놓고 붙여넣는다. 다 넣으면 이런 모양이 된다.

```
SUPABASE_URL=https://abcdefghijkl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

지킬 것 세 가지.

- **따옴표를 붙이지 않는다** — `"https://..."` (X)
- **`=` 앞뒤에 공백을 넣지 않는다** — `SUPABASE_URL = https://...` (X)
- 줄을 새로 만들지 않는다. 한 줄에 하나씩

`Ctrl + S` 로 저장하고 메모장을 닫는다.

> 이 파일은 `.gitignore` 에 있어서 **깃허브로 나가지 않는다.** 내 컴퓨터에만 남는다.

---

## 5. 서버를 껐다 켜서 확인

**중요:** 개발 서버는 켜질 때 설정값을 한 번만 읽는다. 값을 새로 넣었으면 **껐다 켜야** 한다.

이미 켜져 있으면 그 창에서 `Ctrl + C` 로 끄고 다시 켠다.

```bash
npm --prefix C:/airrel_work/rolepicker run dev
```

그다음 브라우저에서 http://localhost:3000 을 연다.

| 보이는 것 | 뜻 |
|---|---|
| `새 조 만들기` 버튼이 있는 첫 화면 | 여기까지는 DB 없이도 나온다 |
| 조를 만들었을 때 링크가 발급된다 | **연결 성공** |
| `DB를 아직 연결하지 않았어요` 안내 | 값이 안 읽혔다. 4번을 다시 확인하고 서버를 껐다 켠다 |

확인하는 가장 빠른 방법: `새 조 만들기` → 이름 두세 개 입력 → `만들기`. 링크 배너가 뜨면 끝이다.

---

## 안 될 때

| 증상 | 확인할 것 |
|---|---|
| 2번에서 빨간 오류 | **문구를 그대로 알려주세요.** SQL을 고쳐야 하는 경우다 |
| `DB를 아직 연결하지 않았어요` 가 계속 뜬다 | 파일 이름이 정확히 `.env.local` 인지 (메모장이 `.env.local.txt` 로 저장했을 수 있다), 서버를 껐다 켰는지 |
| `설정값 SUPABASE_URL 이 비어 있습니다` | `=` 뒤가 비어 있거나 공백이 끼어 있다 |
| `Invalid API key` | `anon` 키를 넣었을 수 있다. `service_role` 키인지 확인 |
| 조를 만들면 오류가 난다 | 2번의 표 7개가 다 생겼는지 Table Editor에서 확인 |

---

## 나중에 배포할 때 (M4)

Vercel에 올릴 때는 같은 값 두 개를 Vercel 대시보드의 **Settings → Environment Variables** 에 넣는다. `.env.local` 은 내 컴퓨터에만 있는 파일이라 배포 서버에는 올라가지 않는다.

## 표가 하는 일

| 표 | 담는 것 |
|---|---|
| `teams` | 조. 이름이 없고 링크(`slug`)로 구분한다 |
| `members` | 조원. 조를 떠나도 지우지 않고 `active` 를 내린다 |
| `roles` | 역할 3개. 조마다 따로 들어간다 — 나중에 역할을 추가할 수 있게 |
| `assignments` | 하루에 한 줄. 같은 날 두 줄이 생기지 않도록 DB가 막는다 |
| `assignment_items` | 그날 누가 어떤 역할이었나. 그루도 한 줄씩 |
| `attendances` | 그날 참여했는지. 빈자리도 기록에 남는다 |
| `timer_sessions` | 타이머 (M2에서 사용) |

자세한 설계 의도는 `migrations/0001_init.sql` 의 주석에 적어뒀다.

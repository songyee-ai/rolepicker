-- ════════════════════════════════════════════════════════════════
-- 그루뽑기 초기 스키마 (PRD §8)
--
-- 접근 정책
--   브라우저는 DB에 직접 접근하지 않는다. 모든 읽기·쓰기가 서버
--   Route Handler를 거치며, 서버는 service_role 키를 쓴다 (PRD §12).
--   service_role은 RLS를 우회하는 역할이므로, 아래 RLS와 정책은
--   "브라우저에서 오는 요청(anon / authenticated)을 전부 막는" 장치다.
--
--   막는 방법을 두 겹으로 둔다.
--     1) 모든 테이블에 RLS를 켜고, anon·authenticated에 대해
--        항상 거짓인 정책을 명시적으로 만든다
--     2) 그 두 역할의 테이블 권한 자체를 회수한다
--   1만 있어도 막히지만, 나중에 누군가 정책을 하나 추가했을 때
--   2가 남아 있으면 사고가 되지 않는다.
-- ════════════════════════════════════════════════════════════════

-- ─── 테이블 ──────────────────────────────────────────────────────

-- 조. 이름이 없다. 링크로 식별한다 (PRD §3-2)
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,   -- 'mango-7b2c9f'  주소에 들어간다
  code       text not null unique,   -- 'MANGO-7B2C9F'  불러주는 표기
  created_at timestamptz not null default now(),

  constraint teams_slug_format check (slug ~ '^[a-z]{2,12}-[0-9a-f]{6}$'),
  constraint teams_code_matches_slug check (code = upper(slug))
);

-- 조원. 그루라고 부른다 (PRD §17)
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  order_index int  not null default 0,
  -- 조를 떠난 경우 false. 그날 결석(빈자리)과는 무관하다 (PRD §8)
  -- 빈자리는 삭제가 아니다. 결석자도 명단에 남아야 히스토리가 이어진다 (PRD §3-6)
  active      bool not null default true,
  created_at  timestamptz not null default now(),

  -- 앞뒤 공백 제거 후 1~12자 (PRD §14)
  constraint members_name_not_blank check (btrim(name) <> ''),
  constraint members_name_length check (char_length(name) <= 12)
);

create index if not exists members_team_order_idx
  on public.members (team_id, order_index, created_at);

-- 역할. 하드코딩하지 않고 테이블로 관리한다 (PRD §4)
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  key         text not null,          -- 'lead' | 'keeper' | 'groo'
  name        text not null,
  description text not null default '',
  emoji       text not null default '',
  priority    int  not null,          -- 낮을수록 먼저 배정
  -- 그루처럼 뽑지 않는 기본 역할 (PRD §4)
  is_default  bool not null default false,

  unique (team_id, key)
);

create index if not exists roles_team_priority_idx
  on public.roles (team_id, priority);

-- 하루 배정은 한 줄. 다시 뽑으면 덮어쓴다 (PRD §3-5)
create table if not exists public.assignments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  -- KST 기준 날짜. 서버가 UTC라 반드시 shared/date.ts를 통과한 값만 넣는다 (PRD §14)
  date       date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 여러 명이 동시에 '역할 뽑기'를 눌러도 하루 한 줄임을 DB가 보장한다 (PRD §8, §14)
  unique (team_id, date)
);

create index if not exists assignments_team_date_idx
  on public.assignments (team_id, date desc);

-- 그날 누가 어떤 역할이었나. 그루도 한 줄씩 들어간다 (PRD §8)
create table if not exists public.assignment_items (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  role_id       uuid not null references public.roles(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,

  -- 한 사람은 하루에 한 역할만. 겸임 금지를 DB로도 막는다 (PRD §7-4)
  primary key (assignment_id, member_id)
);

create index if not exists assignment_items_role_idx
  on public.assignment_items (role_id);

create index if not exists assignment_items_member_idx
  on public.assignment_items (member_id);

-- 그날 참여했는지. 빈자리도 false로 남는다 (PRD §3-6)
create table if not exists public.attendances (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  present       bool not null,

  primary key (assignment_id, member_id)
);

-- 타이머 세션. M2에서 쓴다 (PRD §8, §10)
-- 자정을 넘겨도 세션이 배정에 붙어 있어 누적 학습시간이 끊기지 않는다 (PRD §14)
create table if not exists public.timer_sessions (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references public.assignments(id) on delete cascade,
  kind             text not null,
  planned_sec      int  not null,
  -- 서버 시각으로 확정한다. 클라이언트는 이 값으로 남은 시간을 계산한다 (PRD §10)
  started_at       timestamptz not null default now(),
  paused_at        timestamptz,
  paused_total_sec int  not null default 0,
  ended_at         timestamptz,

  constraint timer_sessions_kind check (kind in ('study', 'break')),
  constraint timer_sessions_planned_sec check (planned_sec between 0 and 7200),
  constraint timer_sessions_paused_total check (paused_total_sec >= 0)
);

create index if not exists timer_sessions_assignment_idx
  on public.timer_sessions (assignment_id, started_at);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assignments_touch_updated_at on public.assignments;
create trigger assignments_touch_updated_at
  before update on public.assignments
  for each row execute function public.touch_updated_at();

-- ─── RLS: 브라우저에서 오는 접근을 전부 막는다 ────────────────────

alter table public.teams            enable row level security;
alter table public.members          enable row level security;
alter table public.roles            enable row level security;
alter table public.assignments      enable row level security;
alter table public.assignment_items enable row level security;
alter table public.attendances      enable row level security;
alter table public.timer_sessions   enable row level security;

-- anon        = 로그인하지 않은 브라우저 (우리 서비스는 로그인이 없으므로 사실상 모든 브라우저)
-- authenticated = Supabase 로그인 사용자. 우리는 쓰지 않는다
--
-- using (false) 는 "어떤 줄도 보이지 않는다",
-- with check (false) 는 "어떤 줄도 쓸 수 없다"는 뜻이다.
-- 정책을 아예 안 만들어도 RLS를 켜면 막히지만, 명시적으로 적어두면
-- 나중에 이 파일을 읽는 사람이 의도를 오해하지 않는다.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'teams', 'members', 'roles', 'assignments',
    'assignment_items', 'attendances', 'timer_sessions'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'deny_browser_access', target_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      'deny_browser_access', target_table
    );
  end loop;
end;
$$;

-- 두 번째 겹: 권한 자체를 회수한다
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- 앞으로 이 스키마에 만들어지는 것들도 기본적으로 막힌다
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

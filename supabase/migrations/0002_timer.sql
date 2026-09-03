-- ════════════════════════════════════════════════════════════════
-- 타이머에 필요한 두 가지 (M2)
--
-- PRD §8 스키마에 없던 것이라 따로 적어둔다. 왜 필요한지는 아래 주석에 있다.
-- 0001_init.sql 을 이미 돌렸다면 이 파일만 추가로 돌리면 된다.
-- ════════════════════════════════════════════════════════════════

-- (1) 진행 중인 세션은 한 배정에 하나만
--
-- 조원 여러 명이 같은 타이머 화면을 보고 있다. 시간이 다 되는 순간
-- 여러 화면이 동시에 "다음 단계 시작"을 서버에 알린다. 그러면 세션이
-- 두 개 생기고, 사람마다 다른 남은 시간을 보게 된다.
--
-- 애플리케이션에서 "이미 있으면 그걸 쓴다"로 처리하지만, 두 요청이
-- 정확히 같은 순간에 오면 둘 다 "없다"를 보고 둘 다 만든다.
-- 그 경쟁을 DB가 정리한다. 하루 한 배정을 unique 로 보장한 것과 같은 방식이다.
create unique index if not exists timer_sessions_one_active
  on public.timer_sessions (assignment_id)
  where ended_at is null;

-- (2) 그날의 학습·쉬는 시간 약속
--
-- 시간지키미가 정한 "학습 40분, 쉬는시간 10분"은 조 전체가 공유하는 값이다.
-- 세션 기록만 보고 유추하면 쉬는 시간을 0분으로 정한 조를 구분할 수 없다
-- (쉬는 세션이 아예 안 만들어지므로). 그래서 배정에 붙여 저장한다.
--
-- null 이면 아직 타이머를 준비하지 않은 날이다.
alter table public.assignments
  add column if not exists study_sec int,
  add column if not exists break_sec int;

alter table public.assignments
  drop constraint if exists assignments_study_sec_range;
alter table public.assignments
  add constraint assignments_study_sec_range
  check (study_sec is null or study_sec between 300 and 7200);

alter table public.assignments
  drop constraint if exists assignments_break_sec_range;
alter table public.assignments
  add constraint assignments_break_sec_range
  check (break_sec is null or break_sec between 0 and 1800);

-- RLS는 0001 에서 이미 켜져 있다. 새 칼럼도 같은 정책을 따른다.
-- 새로 만든 인덱스에는 별도 권한 설정이 필요하지 않다.

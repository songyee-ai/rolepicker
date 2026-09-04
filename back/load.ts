/**
 * 화면(서버 컴포넌트)이 쓰는 읽기 함수.
 *
 * 서버에서 그리는 화면은 자기 서버에 HTTP 요청을 보낼 이유가 없다.
 * DB를 바로 읽는다. app 폴더의 page.tsx 는 이 함수만 부르고, 받은 값을
 * front 의 화면 컴포넌트에 넘긴다.
 */

import 'server-only';
import { isSupabaseConfigured } from './env';
import { readAssignmentView } from './db/assignments';
import { findTeamBySlug, loadMembers, loadRoles, toTeamView } from './db/teams';
import { loadHistoryView } from './db/history';
import { loadTimerState, loadTimerSummary } from './db/timer';
import { todayKst } from '@/shared/date';
import type { HistoryView, TeamView, TimerStateView } from '@/shared/types';

export { isSupabaseConfigured };

/** 조를 찾지 못하면 null. 페이지가 404를 낸다 */
export async function loadTeamView(slug: string): Promise<TeamView | null> {
  const team = await findTeamBySlug(slug);
  if (!team) return null;

  const today = todayKst();
  const [members, roles, todayAssignment] = await Promise.all([
    loadMembers(team.id),
    loadRoles(team.id),
    readAssignmentView(team.id, today),
  ]);

  const view = toTeamView(team, members, roles, today, todayAssignment);
  return withTimerSummary(view);
}

/**
 * 결과 화면이 '타이머가 돌고 있다'를 알 수 있게 붙여준다.
 * 조원 한 명이 타이머를 켜면 다른 조원 화면의 버튼이 바뀐다.
 */
export async function withTimerSummary(view: TeamView): Promise<TeamView> {
  if (!view.today) return view;
  const timer = await loadTimerSummary(view.today.id);
  return { ...view, today: { ...view.today, timer } };
}

/**
 * 타이머 화면에 필요한 것. (M2)
 * 오늘 배정이 없으면 타이머를 켤 수 없으므로 state 는 null 이다.
 */
export async function loadTimerPage(
  slug: string,
): Promise<{ team: TeamView; state: TimerStateView | null } | null> {
  const team = await loadTeamView(slug);
  if (!team) return null;
  if (!team.today) return { team, state: null };
  return { team, state: await loadTimerState(team.today.id) };
}

/** 지난 기록 화면에 필요한 것. (M3) */
export async function loadHistoryPage(
  slug: string,
  days?: number,
): Promise<{ team: TeamView; history: HistoryView } | null> {
  const team = await findTeamBySlug(slug);
  if (!team) return null;

  const view = await loadTeamView(slug);
  if (!view) return null;

  return { team: view, history: await loadHistoryView(team, todayKst(), days) };
}

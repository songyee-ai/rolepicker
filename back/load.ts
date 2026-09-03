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
import { todayKst } from '@/shared/date';
import type { TeamView } from '@/shared/types';

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

  return toTeamView(team, members, roles, today, todayAssignment);
}

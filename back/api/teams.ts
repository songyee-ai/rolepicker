/**
 * 조 만들기 · 조 읽기 · 명단 저장.
 *
 * app/api 아래의 파일들은 이 함수들을 가리키는 껍데기다.
 * 주소와 구현을 분리해두면 주소가 바뀌어도 로직을 건드리지 않는다.
 */

import 'server-only';
import { handler, jsonOk, readJson } from '../errors';
import { siteOrigin } from '../env';
import { teamUrl } from '../slug';
import { memberArray, stringArray } from '../validate';
import { createTeam, loadRoles, loadMembers, requireTeamBySlug, toTeamView } from '../db/teams';
import { saveMembers } from '../db/members';
import { readAssignmentView, reconcileAssignment } from '../db/assignments';
import { todayKst } from '@/shared/date';
import { MAX_MEMBERS } from '@/shared/names';
import type { CreateTeamResponse, TeamView } from '@/shared/types';

/** 이름을 몇 개까지 받아줄지. 상한(12명)보다 넉넉히 받고 안내로 막는다 */
const MAX_NAME_INPUTS = 60;

/** POST /api/teams — 조 생성 후 slug와 code를 돌려준다 */
export const postTeams = handler(async (request: Request) => {
  const body = await readJson(request);
  const names = stringArray(body, 'names', MAX_NAME_INPUTS);

  const team = await createTeam(names);
  const origin = siteOrigin(new URL(request.url).origin);

  const response: CreateTeamResponse = {
    slug: team.slug,
    code: team.code,
    url: teamUrl(team.slug, origin),
  };
  return jsonOk(response, { status: 201 });
});

/** GET /api/teams/[slug] — 조 + 조원 + 오늘 배정(있으면) */
export const getTeam = handler(
  async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const team = await requireTeamBySlug(slug);
    const today = todayKst();

    const [members, roles, todayAssignment] = await Promise.all([
      loadMembers(team.id),
      loadRoles(team.id),
      readAssignmentView(team.id, today),
    ]);

    const view: TeamView = toTeamView(team, members, roles, today, todayAssignment);
    return jsonOk(view);
  },
);

/** PUT /api/teams/[slug]/members — 명단 일괄 저장 */
export const putMembers = handler(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const team = await requireTeamBySlug(slug);

    const body = await readJson(request);
    const incoming = memberArray(body, MAX_NAME_INPUTS);

    const members = await saveMembers(team.id, incoming);

    // 명단이 바뀌었으면 오늘 배정의 참여 기록도 따라가야 한다.
    // 안 하면 새로 넣은 조원이 결과 화면의 어느 줄에도 나오지 않는다
    const today = todayKst();
    await reconcileAssignment(team.id, today);
    const [roles, todayAssignment] = await Promise.all([
      loadRoles(team.id),
      readAssignmentView(team.id, today),
    ]);

    const view: TeamView = toTeamView(team, members, roles, today, todayAssignment);
    return jsonOk(view);
  },
);

export { MAX_MEMBERS };

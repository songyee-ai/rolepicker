/**
 * 역할 뽑기와 다시 뽑기. (PRD §9)
 *
 * 배정은 서버에서만 만든다 (PRD §3-4). 화면은 참여자 목록만 보내고,
 * 결과를 받아서 연출한다. 연출은 결과를 만들지 않는다 (PRD §6 S4).
 */

import 'server-only';
import { handler, jsonOk, readJson } from '../errors';
import { stringArray } from '../validate';
import { requireTeamBySlug } from '../db/teams';
import { ensureAssignment, rerollAssignment } from '../db/assignments';
import { todayKst } from '@/shared/date';
import type { AssignmentView } from '@/shared/types';

const MAX_PRESENT_INPUTS = 60;

/**
 * POST /api/teams/[slug]/assign
 *
 * 멱등하다. 같은 날 배정이 이미 있으면 새로 만들지 않고 그것을 돌려준다.
 * 조원 여러 명이 동시에 버튼을 누르는 상황이 실제로 발생한다 (PRD §9, §14).
 */
export const postAssign = handler(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const team = await requireTeamBySlug(slug);

    const body = await readJson(request);
    const presentMemberIds = stringArray(body, 'presentMemberIds', MAX_PRESENT_INPUTS);

    const view: AssignmentView = await ensureAssignment(team, todayKst(), presentMemberIds);
    return jsonOk(view);
  },
);

/**
 * POST /api/teams/[slug]/reroll
 *
 * 기존 배정을 덮어쓴다. 같은 날 배정은 항상 한 줄만 존재하므로 히스토리와
 * 다음 가중치는 마지막 결과만 본다 (PRD §7).
 * 다시 뽑기 횟수는 어디에도 저장하지 않고 화면에도 표시하지 않는다 (PRD §6 S5).
 */
export const postReroll = handler(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const team = await requireTeamBySlug(slug);

    const body = await readJson(request);
    const presentMemberIds = stringArray(body, 'presentMemberIds', MAX_PRESENT_INPUTS);

    const view: AssignmentView = await rerollAssignment(team, todayKst(), presentMemberIds);
    return jsonOk(view);
  },
);

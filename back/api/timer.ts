/**
 * 타이머 세션. (PRD §9, §10)
 *
 * 세 주소 모두 같은 모양(TimerStateView)을 돌려준다. 화면은 응답을 그대로
 * 상태로 삼으면 되고, 무엇이 바뀌었는지 따로 계산하지 않는다.
 */

import 'server-only';
import { ApiError, handler, jsonOk, readJson } from '../errors';
import { oneOf, optionalInt } from '../validate';
import { requireTeamBySlug } from '../db/teams';
import {
  applyPlanToActive,
  loadTimerState,
  patchSession as patchSessionRow,
  requireAssignmentId,
  savePlan,
  startSession,
} from '../db/timer';
import { todayKst } from '@/shared/date';
import { BREAK_MAX, BREAK_MIN, STUDY_MAX, STUDY_MIN } from '@/shared/timer';

const KINDS = ['study', 'break'] as const;
const ACTIONS = ['pause', 'resume', 'end'] as const;

type SlugContext = { params: Promise<{ slug: string }> };
type SessionContext = { params: Promise<{ slug: string; id: string }> };

async function assignmentIdFor(slug: string): Promise<string> {
  const team = await requireTeamBySlug(slug);
  return requireAssignmentId(team.id, todayKst());
}

/**
 * GET /api/teams/[slug]/timer/sessions
 *
 * PRD §9의 목록에는 없지만 필요하다. 탭을 닫았다 열면 현재 세션을 다시 받아
 * 남은 시간을 계산해야 하기 때문이다 (PRD §10).
 */
export const getTimer = handler(async (_request: Request, context: SlugContext) => {
  const { slug } = await context.params;
  return jsonOk(await loadTimerState(await assignmentIdFor(slug)));
});

/**
 * POST /api/teams/[slug]/timer/sessions — 세션 시작
 *
 * 처음 시작할 때는 body 에 plan 을 함께 보낸다. 그 값이 그날의 약속으로
 * 저장되고, 다른 조원 화면도 같은 길이로 돌아간다.
 *
 * 이미 진행 중인 세션이 있으면 새로 만들지 않는다. 여러 화면이 동시에
 * 다음 단계를 알려도 결과가 하나여야 한다.
 */
export const postSession = handler(async (request: Request, context: SlugContext) => {
  const { slug } = await context.params;
  const assignmentId = await assignmentIdFor(slug);

  const body = await readJson(request);

  /**
   * kind 가 없으면 약속만 저장한다.
   * 타이머가 돌아가는 중에 `시간 다시 정하기`로 와서 길이를 바꾸는 경우다.
   * 이때는 지금 돌아가는 세션에도 바로 적용한다 — 남은 시간이 그대로면
   * 안 먹힌 것처럼 보인다.
   */
  const wantsStart = (body as { kind?: unknown }).kind !== undefined;
  const kind = wantsStart ? oneOf(body, 'kind', KINDS) : null;

  const rawPlan = (body as { plan?: { studySec?: unknown; breakSec?: unknown } }).plan;
  const studySec = optionalInt(rawPlan?.studySec, '학습 시간', STUDY_MIN * 60, STUDY_MAX * 60);
  const breakSec = optionalInt(rawPlan?.breakSec, '쉬는 시간', BREAK_MIN * 60, BREAK_MAX * 60);

  if ((studySec === undefined) !== (breakSec === undefined)) {
    throw new ApiError('BAD_REQUEST', '학습 시간과 쉬는 시간을 함께 보내주세요.');
  }
  if (!wantsStart && studySec === undefined) {
    throw new ApiError('BAD_REQUEST', '무엇을 할지 알 수 없어요.');
  }

  const before = await loadTimerState(assignmentId);

  if (studySec !== undefined && breakSec !== undefined) {
    /*
      돌아가는 세션이 있는데 kind 까지 함께 온 요청은, 조원 두 명이 거의 같은
      순간에 `시작`을 누른 경우다. 뒤에 누른 사람 화면의 다이얼 값으로 그날의
      약속이 바뀌면, 지금 돌아가는 40분이 끝난 뒤 쉬는 시간이 엉뚱한 길이가 된다.
      먼저 누른 사람의 약속을 지킨다.

      약속만 보낸 요청(kind 없음)은 일부러 바꾸러 온 것이므로 그대로 저장한다.
    */
    const isRaceLoser = wantsStart && before.current !== null;
    if (!isRaceLoser) {
      await savePlan(assignmentId, studySec, breakSec);
      // 일부러 바꾸러 온 경우에는 지금 돌아가는 세션에도 바로 적용한다.
      // 남은 시간이 그대로면 안 먹힌 것처럼 보인다
      if (!wantsStart) {
        await applyPlanToActive(assignmentId, { studySec, breakSec });
      }
    }
  }

  if (kind === null) {
    return jsonOk(await loadTimerState(assignmentId));
  }

  const state = await loadTimerState(assignmentId);
  if (!state.plan) {
    throw new ApiError('BAD_REQUEST', '학습 시간을 먼저 정해주세요.');
  }

  const plannedSec = kind === 'study' ? state.plan.studySec : state.plan.breakSec;
  if (plannedSec <= 0) {
    throw new ApiError('BAD_REQUEST', '쉬는 시간이 0분이에요. 학습을 바로 이어가면 돼요.');
  }

  await startSession(assignmentId, kind, plannedSec);
  return jsonOk(await loadTimerState(assignmentId));
});

/**
 * PATCH /api/teams/[slug]/timer/sessions/[id] — 일시정지 · 재개 · 종료
 *
 * 같은 동작을 두 번 보내도 결과가 같다. 조원 둘이 동시에 일시정지를 눌러도
 * 멈춘 시간이 두 배로 쌓이지 않는다.
 */
export const patchSession = handler(async (request: Request, context: SessionContext) => {
  const { slug, id } = await context.params;
  const assignmentId = await assignmentIdFor(slug);

  const action = oneOf(await readJson(request), 'action', ACTIONS);
  await patchSessionRow(assignmentId, id, action);

  return jsonOk(await loadTimerState(assignmentId));
});

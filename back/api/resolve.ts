/**
 * GET /api/resolve?code=MANGO-7B2C9F — 코드를 링크 주소로 바꾼다. (PRD §9)
 *
 * 기기가 바뀌거나 시크릿 모드에서는 브라우저에 최근 목록이 없다.
 * 그때 남는 유일한 통로이므로 첫 화면에 항상 보여야 한다 (PRD §14).
 *
 * 여기에 요청 제한을 둔다. 코드를 자동으로 계속 넣어보며 남의 조를
 * 찾는 것을 막는다 (PRD §14).
 */

import 'server-only';
import { ApiError, handler, jsonOk } from '../errors';
import { clientKey, rateLimit } from '../rate-limit';
import { normalizeCode } from '../slug';
import { findTeamBySlug } from '../db/teams';
import type { ResolveResponse } from '@/shared/types';

/** 1분에 20번. 사람이 손으로 넣는 속도로는 절대 걸리지 않는다 */
const LIMIT = 20;
const WINDOW_SEC = 60;

export const getResolve = handler(async (request: Request) => {
  const { allowed, retryAfterSec } = rateLimit(
    `resolve:${clientKey(request)}`,
    LIMIT,
    WINDOW_SEC,
  );

  if (!allowed) {
    throw new ApiError(
      'RATE_LIMITED',
      `코드를 너무 여러 번 넣었어요. ${retryAfterSec}초 뒤에 다시 시도해 주세요.`,
      { retryAfterSec },
    );
  }

  const raw = new URL(request.url).searchParams.get('code') ?? '';
  const slug = normalizeCode(raw);

  // 형식이 틀린 것과 없는 조를 같은 문구로 답한다.
  // 형식만 맞으면 "있는 코드"라는 정보를 주게 되므로 대입에 도움이 된다
  const notFound = () =>
    new ApiError('TEAM_NOT_FOUND', '그런 코드의 조가 없어요. 대소문자 없이 그대로 넣어보세요.');

  if (slug === null) throw notFound();

  const team = await findTeamBySlug(slug);
  if (!team) throw notFound();

  const response: ResolveResponse = { slug: team.slug };
  return jsonOk(response);
});

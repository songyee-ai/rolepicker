/**
 * GET /api/teams/[slug]/history?days=14 — 지난 기록. (PRD §9)
 *
 * 기본 14일. v1에서 화면에 필터는 만들지 않지만 (PRD §6 S8),
 * 주소로는 기간을 바꿀 수 있게 열어둔다.
 */

import 'server-only';
import { handler, jsonOk } from '../errors';
import { requireTeamBySlug } from '../db/teams';
import { DEFAULT_HISTORY_DAYS, MAX_HISTORY_DAYS, loadHistoryView } from '../db/history';
import { todayKst } from '@/shared/date';

export const getHistory = handler(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const team = await requireTeamBySlug(slug);

    const raw = Number(new URL(request.url).searchParams.get('days'));
    const days = Number.isFinite(raw) && raw >= 1
      ? Math.min(Math.round(raw), MAX_HISTORY_DAYS)
      : DEFAULT_HISTORY_DAYS;

    return jsonOk(await loadHistoryView(team, todayKst(), days));
  },
);

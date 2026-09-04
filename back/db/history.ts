/**
 * 지난 기록. (PRD §6 S8, §9)
 *
 * 두 가지를 서로 다른 기간으로 본다.
 *   표에 나오는 횟수 — 지난 14일 (기본값)
 *   "아직 한 번도"   — 전체 기간
 *
 * 나눠 놓은 이유가 있다. 14일 안에만 0이고 20일 전에 맡았던 사람은
 * 다음 뽑기에서 먼저 후보가 되지 않는다. 그런데 화면은 "아직 맡은 적이
 * 없어요. 다음 뽑기에서 먼저 후보로 올라갑니다"라고 말한다. 같은 기간으로
 * 계산하면 그 문장이 거짓이 된다.
 */

import 'server-only';
import { db } from '../supabase';
import { HISTORY_WINDOW_DAYS } from './assignments';
import { loadMembers, loadRoles, toRoleView } from './teams';
import type { AssignmentItemRow, TeamRow } from './rows';
import { addDays, daysBetween, todayKst, type DateStr } from '@/shared/date';
import { averagePerStudiedDay } from '@/shared/history';
import { initialOf } from '@/shared/names';
import { creditedSec, type TimerSession } from '@/shared/timer';
import type { HistoryRow, HistoryView, MemberRef, NeverHeldRole } from '@/shared/types';

/** 기본 기간. v1에서 필터는 만들지 않는다 (PRD §6 S8) */
export const DEFAULT_HISTORY_DAYS = 14;
export const MAX_HISTORY_DAYS = 90;

interface SessionRow {
  assignment_id: string;
  kind: string;
  planned_sec: number;
  started_at: string;
  paused_at: string | null;
  paused_total_sec: number;
  ended_at: string | null;
}

export async function loadHistoryView(
  team: TeamRow,
  today: DateStr,
  days: number = DEFAULT_HISTORY_DAYS,
  nowMs: number = Date.now(),
): Promise<HistoryView> {
  const client = db();
  const from = addDays(today, -(days - 1));

  const [members, roleRows] = await Promise.all([loadMembers(team.id), loadRoles(team.id)]);
  const activeMembers = members.filter((row) => row.active);
  const roles = roleRows.map(toRoleView);

  // 전체 기간의 배정을 한 번에 읽고, 표는 그중 최근 구간만 쓴다
  const { data: assignmentRows, error } = await client
    .from('assignments')
    .select('id, date')
    .eq('team_id', team.id)
    .gte('date', addDays(today, -HISTORY_WINDOW_DAYS))
    .lte('date', today)
    .order('date', { ascending: true });

  if (error) throw error;

  const all = (assignmentRows ?? []) as { id: string; date: string }[];
  const dateById = new Map(all.map((row) => [row.id, row.date]));
  const windowIds = all.filter((row) => row.date >= from).map((row) => row.id);

  const items = all.length === 0 ? [] : await loadItems([...dateById.keys()]);

  // ─── 표: 이 기간에 몇 번 맡았나 ────────────────────────────────
  const countsByMember = new Map<string, Record<string, number>>();
  /** 전체 기간에 한 번이라도 맡았는가 */
  const everHeld = new Set<string>();

  const windowIdSet = new Set(windowIds);
  for (const item of items) {
    everHeld.add(`${item.member_id}:${item.role_id}`);
    if (!windowIdSet.has(item.assignment_id)) continue;

    let counts = countsByMember.get(item.member_id);
    if (!counts) {
      counts = {};
      countsByMember.set(item.member_id, counts);
    }
    counts[item.role_id] = (counts[item.role_id] ?? 0) + 1;
  }

  const refOf = (name: string, id: string): MemberRef => ({
    id,
    name,
    initial: initialOf(name),
  });

  const rows: HistoryRow[] = activeMembers.map((member) => ({
    member: refOf(member.name, member.id),
    counts: countsByMember.get(member.id) ?? {},
  }));

  // ─── 아직 한 번도 맡지 않은 그루 (전체 기간) ────────────────────
  const neverHeld: NeverHeldRole[] = roles
    .filter((role) => !role.isDefault)
    .map((role) => ({
      role,
      members: activeMembers
        .filter((member) => !everHeld.has(`${member.id}:${role.id}`))
        .map((member) => refOf(member.name, member.id)),
    }))
    .filter((entry) => entry.members.length > 0);

  // ─── 학습 통계 ─────────────────────────────────────────────────
  const study = await loadStudyStats(windowIds, dateById, nowMs);

  return {
    days,
    from,
    to: today,
    recordedDays: windowIds.length,
    teamAgeDays: daysSinceCreated(team, today),
    roles,
    rows,
    neverHeld,
    study,
  };
}

/** 만든 날을 1일째로 센다. 날짜 계산은 shared/date.ts 만 통과한다 (PRD §14) */
function daysSinceCreated(team: TeamRow, today: DateStr): number {
  return daysBetween(todayKst(new Date(team.created_at)), today) + 1;
}

async function loadItems(assignmentIds: string[]): Promise<AssignmentItemRow[]> {
  const { data, error } = await db()
    .from('assignment_items')
    .select('assignment_id, role_id, member_id')
    .in('assignment_id', assignmentIds);

  if (error) throw error;
  return (data ?? []) as AssignmentItemRow[];
}

/**
 * 학습 통계.
 *
 * 누적은 세션이 속한 배정 기준으로 센다. 자정을 넘겨 학습해도 끊기지 않는다 (PRD §14).
 * 한 세션이 채운 시간은 계획한 길이를 넘지 않는다 — 방치한 시간이 부풀지 않게.
 */
async function loadStudyStats(
  assignmentIds: string[],
  dateById: Map<string, string>,
  nowMs: number,
): Promise<HistoryView['study']> {
  if (assignmentIds.length === 0) {
    return { totalSec: 0, studiedDays: 0, averageSec: 0, best: null };
  }

  const { data, error } = await db()
    .from('timer_sessions')
    .select('assignment_id, kind, planned_sec, started_at, paused_at, paused_total_sec, ended_at')
    .in('assignment_id', assignmentIds);

  if (error) throw error;

  const byDate = new Map<string, { sec: number; sessions: number }>();

  for (const row of (data ?? []) as SessionRow[]) {
    if (row.kind !== 'study') continue;
    const date = dateById.get(row.assignment_id);
    if (!date) continue;

    const session: TimerSession = {
      id: '',
      kind: 'study',
      plannedSec: row.planned_sec,
      startedAt: row.started_at,
      pausedAt: row.paused_at,
      pausedTotalSec: row.paused_total_sec,
      endedAt: row.ended_at,
    };

    const entry = byDate.get(date) ?? { sec: 0, sessions: 0 };
    entry.sec += creditedSec(session, nowMs);
    entry.sessions += 1;
    byDate.set(date, entry);
  }

  const totalSec = [...byDate.values()].reduce((sum, entry) => sum + entry.sec, 0);
  const studiedDays = byDate.size;

  // 가장 많이 한 날. 세션 수가 같으면 시간이 긴 쪽
  let best: HistoryView['study']['best'] = null;
  for (const [date, entry] of byDate) {
    if (
      best === null ||
      entry.sessions > best.sessions ||
      (entry.sessions === best.sessions && entry.sec > best.sec)
    ) {
      best = { date, sessions: entry.sessions, sec: entry.sec };
    }
  }

  return {
    totalSec,
    studiedDays,
    averageSec: averagePerStudiedDay(totalSec, studiedDays),
    best,
  };
}

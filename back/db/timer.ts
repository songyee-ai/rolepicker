/**
 * 타이머 세션. (PRD §8, §10)
 *
 * 핵심 규칙: **서버가 started_at 을 확정한다.** 클라이언트는 그 값으로
 * 남은 시간을 계산할 뿐이고, 자기 시계로 세지 않는다 (PRD §10).
 *
 * 여기서 신경 쓰는 것
 *   진행 중인 세션은 한 배정에 하나 (DB 인덱스가 보장, 0002_timer.sql)
 *   시간이 다 됐는데 아무도 안 넘긴 세션은 읽을 때 정리한다 (PRD §10)
 *   시작한 지 24시간이 지난 세션은 끝난 것으로 본다 (PRD §14)
 */

import 'server-only';
import { ApiError } from '../errors';
import { db, isUniqueViolation } from '../supabase';
import { findAssignment } from './assignments';
import {
  isOverdue,
  isStale,
  scheduledEndMs,
  studySessionCount,
  totalStudySec,
  type SessionKind,
  type TimerSession,
} from '@/shared/timer';
import type { DateStr } from '@/shared/date';
import type { TimerStateView, TimerSummary } from '@/shared/types';

interface SessionRow {
  id: string;
  assignment_id: string;
  kind: string;
  planned_sec: number;
  started_at: string;
  paused_at: string | null;
  paused_total_sec: number;
  ended_at: string | null;
}

const COLUMNS = 'id, assignment_id, kind, planned_sec, started_at, paused_at, paused_total_sec, ended_at';

function toSession(row: SessionRow): TimerSession {
  return {
    id: row.id,
    kind: row.kind === 'break' ? 'break' : 'study',
    plannedSec: row.planned_sec,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    pausedTotalSec: row.paused_total_sec,
    endedAt: row.ended_at,
  };
}

async function loadSessions(assignmentId: string): Promise<TimerSession[]> {
  const { data, error } = await db()
    .from('timer_sessions')
    .select(COLUMNS)
    .eq('assignment_id', assignmentId)
    .order('started_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as SessionRow[]).map(toSession);
}

/** 끝나지 않은 세션. DB 인덱스 덕분에 최대 하나다 */
async function loadActive(assignmentId: string): Promise<TimerSession | null> {
  const { data, error } = await db()
    .from('timer_sessions')
    .select(COLUMNS)
    .eq('assignment_id', assignmentId)
    .is('ended_at', null)
    .maybeSingle();

  if (error) throw error;
  return data ? toSession(data as SessionRow) : null;
}

async function closeAt(sessionId: string, endedAtMs: number): Promise<void> {
  const { error } = await db()
    .from('timer_sessions')
    .update({ ended_at: new Date(endedAtMs).toISOString(), paused_at: null })
    .eq('id', sessionId)
    .is('ended_at', null); // 이미 끝난 세션은 건드리지 않는다
  if (error) throw error;
}

/**
 * 읽기 전에 뒤처진 세션을 정리한다.
 *
 * 아무도 화면을 보고 있지 않으면 단계 전환을 알려줄 클라이언트가 없다.
 * 그래서 다음 접속 때 여기서 보정한다 (PRD §10). 다음 단계를 자동으로
 * 시작하지는 않는다 — 몇 시간을 방치했는데 그 사이 세션이 여러 번
 * 돌아간 것처럼 꾸미면 기록이 거짓이 된다. 예정 시각에 끝난 것으로만 두고,
 * 다음 단계는 화면을 연 사람이 시작한다.
 */
async function reconcileActive(active: TimerSession | null, nowMs: number): Promise<void> {
  if (!active) return;

  // 시작한 지 24시간이 지났다 — 일시정지한 채로 하루를 넘긴 경우 (PRD §14)
  if (isStale(active, nowMs)) {
    await closeAt(active.id, Date.parse(active.startedAt) + active.plannedSec * 1000);
    return;
  }

  // 예정 시각이 지났다 — 아무도 넘기지 않았다
  if (isOverdue(active, nowMs)) {
    await closeAt(active.id, scheduledEndMs(active, nowMs));
  }
}

async function loadPlan(assignmentId: string): Promise<TimerStateView['plan']> {
  const { data, error } = await db()
    .from('assignments')
    .select('study_sec, break_sec')
    .eq('id', assignmentId)
    .single();

  if (error) throw error;
  const row = data as { study_sec: number | null; break_sec: number | null };
  if (row.study_sec === null || row.break_sec === null) return null;
  return { studySec: row.study_sec, breakSec: row.break_sec };
}

/** 타이머 화면이 필요한 모든 것. 읽으면서 뒤처진 세션을 정리한다 */
export async function loadTimerState(
  assignmentId: string,
  nowMs: number = Date.now(),
): Promise<TimerStateView> {
  await reconcileActive(await loadActive(assignmentId), nowMs);

  const sessions = await loadSessions(assignmentId);
  const current = sessions.find((session) => session.endedAt === null) ?? null;

  return {
    plan: await loadPlan(assignmentId),
    sessions,
    current,
    totalStudySec: totalStudySec(sessions, nowMs),
    studyCount: studySessionCount(sessions),
    // 클라이언트 시계가 틀어져 있어도 화면이 맞도록 서버 시각을 함께 보낸다
    serverNow: new Date(nowMs).toISOString(),
  };
}

/** 오늘 배정을 찾는다. 없으면 타이머를 켤 수 없다 */
export async function requireAssignmentId(teamId: string, date: DateStr): Promise<string> {
  const assignment = await findAssignment(teamId, date);
  if (!assignment) {
    throw new ApiError(
      'NO_ASSIGNMENT',
      '오늘 역할을 아직 안 뽑았어요. 먼저 역할을 뽑고 타이머를 켜주세요.',
    );
  }
  return assignment.id;
}

/** 시간지키미가 정한 약속을 저장한다. 조 전체가 같은 값을 본다 */
export async function savePlan(
  assignmentId: string,
  studySec: number,
  breakSec: number,
): Promise<void> {
  const { error } = await db()
    .from('assignments')
    .update({ study_sec: studySec, break_sec: breakSec })
    .eq('id', assignmentId);
  if (error) throw error;
}

/**
 * 다음 세션을 시작한다.
 *
 * 이미 진행 중인 세션이 있으면 새로 만들지 않고 그것을 돌려준다.
 * 여러 화면이 동시에 "다음 단계"를 알려도 결과가 하나여야 한다 (PRD §10).
 */
export async function startSession(
  assignmentId: string,
  kind: SessionKind,
  plannedSec: number,
  nowMs: number = Date.now(),
): Promise<TimerSession> {
  const active = await loadActive(assignmentId);
  await reconcileActive(active, nowMs);

  // 정리 후에도 살아 있는 세션이 있으면 그것이 지금 진행 중인 세션이다
  const stillActive = await loadActive(assignmentId);
  if (stillActive) return stillActive;

  const { data, error } = await db()
    .from('timer_sessions')
    .insert({ assignment_id: assignmentId, kind, planned_sec: plannedSec })
    .select(COLUMNS)
    .single();

  if (error) {
    // 같은 순간에 다른 화면이 먼저 만들었다. 그것을 돌려준다
    if (isUniqueViolation(error)) {
      const winner = await loadActive(assignmentId);
      if (winner) return winner;
    }
    throw error;
  }

  return toSession(data as SessionRow);
}

async function requireSession(sessionId: string, assignmentId: string): Promise<TimerSession> {
  const { data, error } = await db()
    .from('timer_sessions')
    .select(COLUMNS)
    .eq('id', sessionId)
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new ApiError('NO_ASSIGNMENT', '그 타이머를 찾을 수 없어요. 화면을 새로 열어주세요.');
  }
  return toSession(data as SessionRow);
}

export type SessionAction = 'pause' | 'resume' | 'end';

/**
 * 일시정지 · 재개 · 종료.
 *
 * 같은 동작을 두 번 보내도 결과가 같다. 조원 둘이 동시에 일시정지를 눌러도
 * 멈춘 시간이 두 배로 쌓이지 않는다.
 */
export async function patchSession(
  assignmentId: string,
  sessionId: string,
  action: SessionAction,
  nowMs: number = Date.now(),
): Promise<TimerSession> {
  const session = await requireSession(sessionId, assignmentId);

  if (session.endedAt !== null) return session; // 이미 끝났다. 아무것도 하지 않는다

  const client = db();
  let patch: Record<string, unknown>;

  if (action === 'pause') {
    if (session.pausedAt !== null) return session; // 이미 멈춰 있다
    patch = { paused_at: new Date(nowMs).toISOString() };
  } else if (action === 'resume') {
    if (session.pausedAt === null) return session; // 이미 돌아가고 있다
    const pausedFor = Math.max(0, Math.round((nowMs - Date.parse(session.pausedAt)) / 1000));
    patch = { paused_at: null, paused_total_sec: session.pausedTotalSec + pausedFor };
  } else {
    // 지금 끝낸다. 멈춰 있었다면 그만큼을 합계에 넣고 끝낸다
    const pausedFor =
      session.pausedAt === null
        ? 0
        : Math.max(0, Math.round((nowMs - Date.parse(session.pausedAt)) / 1000));
    patch = {
      paused_at: null,
      paused_total_sec: session.pausedTotalSec + pausedFor,
      ended_at: new Date(nowMs).toISOString(),
    };
  }

  const { data, error } = await client
    .from('timer_sessions')
    .update(patch)
    .eq('id', sessionId)
    .is('ended_at', null)
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw error;
  // 그사이 다른 화면이 끝냈다면 지금 상태를 그대로 읽어 돌려준다
  return data ? toSession(data as SessionRow) : requireSession(sessionId, assignmentId);
}

/**
 * 지금 타이머가 돌고 있는지만 가볍게 본다.
 *
 * 결과 화면이 "타이머 준비하기"와 "타이머 보기" 중 무엇을 보여줄지 정하는 데 쓴다.
 * 남은 시간은 담지 않는다 — 결과 화면은 시계가 아니고, 시계로 만들면
 * 매초 다시 그려야 한다.
 */
export async function loadTimerSummary(assignmentId: string): Promise<TimerSummary | null> {
  const active = await loadActive(assignmentId);
  if (!active) return null;

  // 예정 시각이 지났거나 하루가 지난 세션은 돌고 있는 것이 아니다
  const now = Date.now();
  if (isOverdue(active, now) || isStale(active, now)) return null;

  return { kind: active.kind, paused: active.pausedAt !== null };
}

/**
 * 바꾼 시간을 지금 돌아가는 세션에도 적용한다.
 *
 * "학습 시간을 30분으로 다시 정했는데 화면의 남은 시간이 그대로"면
 * 안 먹힌 것처럼 보인다. 그래서 진행 중인 세션의 길이도 함께 바꾼다.
 *
 * 이미 지난 시간보다 짧게 바꾸면 그 세션은 곧 끝난 것으로 정리된다.
 * 놀랄 수 있는 동작이라 준비 화면이 미리 알려준다.
 */
export async function applyPlanToActive(
  assignmentId: string,
  plan: { studySec: number; breakSec: number },
): Promise<void> {
  const active = await loadActive(assignmentId);
  if (!active) return;

  const nextPlanned = active.kind === 'study' ? plan.studySec : plan.breakSec;
  if (nextPlanned === active.plannedSec) return;

  const { error } = await db()
    .from('timer_sessions')
    .update({ planned_sec: nextPlanned })
    .eq('id', active.id)
    .is('ended_at', null);
  if (error) throw error;
}

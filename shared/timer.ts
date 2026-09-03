/**
 * 타이머 시간 계산. (PRD §10, §14)
 *
 * 이 파일은 순수 함수만 담는다. 현재 시각도 인자로 받는다.
 * 그래서 자정을 넘기는 경우, 일시정지한 채로 하루를 넘긴 경우처럼
 * 실제로 재현하기 어려운 상황을 검사로 만들 수 있다.
 *
 * 지켜야 하는 규칙
 *   남은 시간은 **서버가 확정한 started_at 에서 매번 다시 계산한다.**
 *   1초마다 변수를 하나 줄이는 방식을 쓰지 않는다. 백그라운드 탭에서는
 *   setInterval 이 1초를 지켜주지 않고 (PRD §14), 여러 명이 각자 세는
 *   숫자가 서로 벌어진다.
 */

const MS = 1000;
const MIN = 60;

/** 학습 시간 범위 (PRD §6 S6) */
export const STUDY_MIN = 5;
export const STUDY_MAX = 120;
export const STUDY_DEFAULT = 40;
export const STUDY_PRESETS = [25, 30, 40, 50] as const;

/** 쉬는 시간 범위 (PRD §6 S6) */
export const BREAK_MIN = 0;
export const BREAK_MAX = 30;
export const BREAK_DEFAULT = 10;
export const BREAK_PRESETS = [5, 10, 15] as const;

/** −/+ 는 5분 단위 (PRD §6 S6) */
export const STEP_MINUTES = 5;

/** 이 시간을 넘기면 "집중이 잘 되는 구간은 30~40분" 안내로 바꾼다 (PRD §6 S6) */
export const LONG_STUDY_MINUTES = 60;

/**
 * 세션을 시작한 지 이만큼 지나면 죽은 세션으로 본다. (PRD §14)
 * 일시정지한 채로 자정을 넘기고 다음 날 재개하면 남은 시간이 음수가 될 수 있다.
 */
export const STALE_HOURS = 24;

export type SessionKind = 'study' | 'break';

export interface TimerSession {
  id: string;
  kind: SessionKind;
  plannedSec: number;
  /** 서버 시각. 클라이언트 시계를 쓰지 않는다 (PRD §10) */
  startedAt: string;
  /** 지금 일시정지 중이면 그 시각, 아니면 null */
  pausedAt: string | null;
  /** 지금까지 멈춰 있던 시간의 합 */
  pausedTotalSec: number;
  endedAt: string | null;
}

const ms = (iso: string) => new Date(iso).getTime();

export const isPaused = (session: TimerSession): boolean =>
  session.pausedAt !== null && session.endedAt === null;

export const isEnded = (session: TimerSession): boolean => session.endedAt !== null;

/** 지금 진행 중인 이번 멈춤의 길이 (초) */
function currentPauseSec(session: TimerSession, nowMs: number): number {
  if (!isPaused(session)) return 0;
  return Math.max(0, (nowMs - ms(session.pausedAt!)) / MS);
}

/** 멈춘 시간을 뺀, 실제로 흐른 초 */
function runningSec(session: TimerSession, nowMs: number): number {
  const until = session.endedAt ? ms(session.endedAt) : nowMs;
  const raw = (until - ms(session.startedAt)) / MS;
  return Math.max(0, raw - session.pausedTotalSec - currentPauseSec(session, nowMs));
}

/**
 * 이 세션이 끝날 시각 (밀리초).
 * 멈춘 만큼 뒤로 밀린다. 일시정지 중이면 계속 밀리므로 화면에는
 * 종료 예정 시각 대신 '일시정지'라고 적는다.
 */
export function scheduledEndMs(session: TimerSession, nowMs: number): number {
  const pushed = session.pausedTotalSec + currentPauseSec(session, nowMs);
  return ms(session.startedAt) + (session.plannedSec + pushed) * MS;
}

/** 남은 초. 0보다 작아지지 않는다 */
export function remainingSec(session: TimerSession, nowMs: number): number {
  if (isEnded(session)) return 0;
  return Math.max(0, Math.round(session.plannedSec - runningSec(session, nowMs)));
}

/** 예정된 시각이 지났는가. 아무도 보고 있지 않았던 경우다 (PRD §10) */
export function isOverdue(session: TimerSession, nowMs: number): boolean {
  return !isEnded(session) && !isPaused(session) && remainingSec(session, nowMs) === 0;
}

/**
 * 시작한 지 24시간이 지난 세션. 일시정지한 채로 하루를 넘긴 경우다.
 * 그대로 재개하면 남은 시간이 이상해지므로 끝난 것으로 처리한다 (PRD §14).
 */
export function isStale(session: TimerSession, nowMs: number): boolean {
  if (isEnded(session)) return false;
  return nowMs - ms(session.startedAt) > STALE_HOURS * 3600 * MS;
}

/**
 * 이 세션이 채운 시간 (초).
 * 계획한 길이를 넘지 않는다. 아무도 안 보는 사이 두 시간이 지났어도
 * 40분 세션은 40분만 채운 것이다. 그러지 않으면 누적 학습시간이 부풀려진다.
 */
export function creditedSec(session: TimerSession, nowMs: number): number {
  return Math.min(session.plannedSec, Math.round(runningSec(session, nowMs)));
}

/** 진행률 0~1 */
export function progress(session: TimerSession, nowMs: number): number {
  if (session.plannedSec <= 0) return 1;
  return Math.min(1, Math.max(0, creditedSec(session, nowMs) / session.plannedSec));
}

/**
 * 오늘 누적 학습 시간 (초).
 *
 * 자정을 넘겨 학습하는 경우가 있다. 23:50에 뽑고 00:10에 타이머를 켜면
 * 날짜가 바뀌는데, 세션은 배정에 붙어 있으므로 **세션이 속한 배정 기준으로
 * 집계한다.** "오늘"로 집계하면 끊긴다 (PRD §14).
 * 그래서 이 함수는 날짜를 보지 않는다. 한 배정의 세션 목록만 받는다.
 */
export function totalStudySec(sessions: TimerSession[], nowMs: number): number {
  return sessions
    .filter((session) => session.kind === 'study')
    .reduce((sum, session) => sum + creditedSec(session, nowMs), 0);
}

/** 몇 번째 세션인가. 화면 위쪽에 '두 번째 세션'으로 쓴다 */
export function studySessionCount(sessions: TimerSession[]): number {
  return sessions.filter((session) => session.kind === 'study').length;
}

// ─── 화면에 쓰는 형태 ─────────────────────────────────────────────

/** 'MM:SS'. 한 시간을 넘기면 'H:MM:SS' */
export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / MIN);
  const seconds = safe % MIN;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** '1시간 3분' / '25분' / '0분' */
export function formatDuration(totalSec: number): string {
  const minutes = Math.floor(Math.max(0, totalSec) / MIN);
  const hours = Math.floor(minutes / MIN);
  const rest = minutes % MIN;
  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
}

const KST_OFFSET_MS = 9 * 3600 * MS;

/** 한국 시간 '10:58'. 시계는 KST로 보여준다 (PRD §8) */
export function formatKstTime(atMs: number): string {
  const shifted = new Date(atMs + KST_OFFSET_MS);
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ─── 입력 다루기 ──────────────────────────────────────────────────

export function clampMinutes(minutes: number, kind: SessionKind): number {
  const [min, max] = kind === 'study' ? [STUDY_MIN, STUDY_MAX] : [BREAK_MIN, BREAK_MAX];
  if (!Number.isFinite(minutes)) return kind === 'study' ? STUDY_DEFAULT : BREAK_DEFAULT;
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

/**
 * −/+ 로 5분씩 옮긴다.
 * 프리셋으로 5의 배수가 아닌 값이 되어 있어도 다음 5의 배수로 붙게 만든다.
 */
export function stepMinutes(minutes: number, direction: 1 | -1, kind: SessionKind): number {
  const stepped =
    direction > 0
      ? (Math.floor(minutes / STEP_MINUTES) + 1) * STEP_MINUTES
      : (Math.ceil(minutes / STEP_MINUTES) - 1) * STEP_MINUTES;
  return clampMinutes(stepped, kind);
}

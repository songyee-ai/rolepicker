/**
 * 날짜 계산은 전부 이 파일만 통과한다. (PRD §8, §14)
 *
 * 서버는 UTC로 돌기 때문에 `new Date().toISOString().slice(0,10)`을 그대로 쓰면
 * 한국 시간 오전 9시 이전에는 하루가 어긋난다. 그래서 이 모듈 밖에서는
 * Date 객체로 직접 날짜를 만들지 않는다.
 *
 * 한국은 1988년 이후 서머타임이 없고 고정 UTC+9이므로 오프셋 상수로 계산한다.
 */

/** 'YYYY-MM-DD' 형태의 KST 기준 날짜 */
export type DateStr = string;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 지금 시각의 KST 기준 날짜 */
export function todayKst(now: Date = new Date()): DateStr {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' 형식인지 검사하고, 아니면 던진다 */
export function assertDateStr(value: string): DateStr {
  if (!DATE_STR.test(value)) {
    throw new Error(`날짜 형식이 YYYY-MM-DD가 아닙니다: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`존재하지 않는 날짜입니다: ${value}`);
  }
  return value;
}

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== 'string') return false;
  try {
    assertDateStr(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * from에서 to까지 며칠인가. to가 더 미래면 양수.
 * 두 값 모두 UTC 자정으로 해석하므로 시차가 끼어들 여지가 없다.
 */
export function daysBetween(from: DateStr, to: DateStr): number {
  const a = new Date(`${assertDateStr(from)}T00:00:00.000Z`).getTime();
  const b = new Date(`${assertDateStr(to)}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

export function addDays(date: DateStr, days: number): DateStr {
  const base = new Date(`${assertDateStr(date)}T00:00:00.000Z`).getTime();
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** KST 하루의 시작·끝을 UTC 시각으로. 타임스탬프 범위 조회에 쓴다 */
export function kstDayRangeUtc(date: DateStr): { start: Date; end: Date } {
  const base = new Date(`${assertDateStr(date)}T00:00:00.000Z`).getTime();
  return {
    start: new Date(base - KST_OFFSET_MS),
    end: new Date(base - KST_OFFSET_MS + MS_PER_DAY),
  };
}

/** 화면에 쓰는 '3월 12일 수요일' */
export function formatKstDateLabel(date: DateStr): string {
  const d = new Date(`${assertDateStr(date)}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS_KO[d.getUTCDay()]}요일`;
}

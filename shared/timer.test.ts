import { describe, expect, it } from 'vitest';
import {
  BREAK_DEFAULT,
  BREAK_MAX,
  clampMinutes,
  creditedSec,
  formatClock,
  formatDuration,
  formatKstTime,
  isEnded,
  isOverdue,
  isPaused,
  isStale,
  progress,
  remainingSec,
  scheduledEndMs,
  STEP_MINUTES,
  stepMinutes,
  STUDY_DEFAULT,
  STUDY_MAX,
  STUDY_MIN,
  studySessionCount,
  totalStudySec,
  type SessionKind,
  type TimerSession,
} from './timer';

// ─────────────────────────────────────────────────────────────
// 공통 준비물
// ─────────────────────────────────────────────────────────────

/** 한국시간 10:00 = UTC 01:00 */
const T0 = Date.parse('2026-09-04T01:00:00.000Z');
const at = (offsetSec: number) => T0 + offsetSec * 1000;
const MINUTE = 60;

function session(overrides: Partial<TimerSession> = {}): TimerSession {
  return {
    id: 's1',
    kind: 'study',
    plannedSec: 40 * MINUTE,
    startedAt: new Date(T0).toISOString(),
    pausedAt: null,
    pausedTotalSec: 0,
    endedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────

describe('남은 시간은 서버 시작 시각에서 매번 계산한다 (PRD §10)', () => {
  it('시작 직후에는 계획한 시간이 그대로 남아 있다', () => {
    expect(remainingSec(session(), T0)).toBe(40 * MINUTE);
  });

  it('16분 46초가 지나면 23분 14초가 남는다 — 목업 08번 화면의 숫자', () => {
    const passed = 16 * MINUTE + 46;
    expect(formatClock(remainingSec(session(), at(passed)))).toBe('23:14');
  });

  it('시간이 다 되면 0이고, 더 지나도 음수가 되지 않는다', () => {
    expect(remainingSec(session(), at(40 * MINUTE))).toBe(0);
    expect(remainingSec(session(), at(99 * MINUTE))).toBe(0);
  });

  it('★ 탭을 닫았다 열어도 남은 시간이 이어진다 — 계산에 쓰는 것이 시작 시각뿐이다', () => {
    // 탭을 닫은 사이 화면은 아무것도 세지 않았다. 그래도 결과가 같다
    const reopened = session();
    expect(remainingSec(reopened, at(30 * MINUTE))).toBe(10 * MINUTE);
  });

  it('★ 백그라운드 탭에서 tick을 몇 번 놓쳐도 결과가 같다', () => {
    // 1초마다 변수를 줄이는 방식이면 놓친 만큼 어긋난다. 우리는 매번 다시 계산한다
    const s = session();
    const everySecond = [1, 2, 3].map((n) => remainingSec(s, at(n)));
    const jumped = remainingSec(s, at(300)); // 5분을 한 번에 건너뜀
    expect(everySecond).toEqual([40 * MINUTE - 1, 40 * MINUTE - 2, 40 * MINUTE - 3]);
    expect(jumped).toBe(40 * MINUTE - 300);
  });

  it('끝난 세션은 남은 시간이 0이다', () => {
    const ended = session({ endedAt: new Date(at(10 * MINUTE)).toISOString() });
    expect(isEnded(ended)).toBe(true);
    expect(remainingSec(ended, at(11 * MINUTE))).toBe(0);
  });
});

describe('일시정지 (PRD §10 — 질문이 길어질 때 생각보다 자주 쓴다)', () => {
  it('멈춰 있는 동안 남은 시간이 줄지 않는다', () => {
    // 10분 진행하고 멈췄다
    const paused = session({ pausedAt: new Date(at(10 * MINUTE)).toISOString() });
    expect(isPaused(paused)).toBe(true);

    // 멈춘 뒤 5분이 지나도, 30분이 지나도 남은 시간은 30분
    expect(remainingSec(paused, at(15 * MINUTE))).toBe(30 * MINUTE);
    expect(remainingSec(paused, at(40 * MINUTE))).toBe(30 * MINUTE);
  });

  it('재개하면 멈춘 만큼 뒤로 밀린다', () => {
    // 10분 진행 -> 5분 멈춤 -> 재개. 지금은 시작 후 20분
    const resumed = session({ pausedTotalSec: 5 * MINUTE, pausedAt: null });
    expect(remainingSec(resumed, at(20 * MINUTE))).toBe(25 * MINUTE);
  });

  it('여러 번 멈췄다 재개해도 합계가 반영된다', () => {
    const resumed = session({ pausedTotalSec: 3 * MINUTE + 7 * MINUTE });
    expect(remainingSec(resumed, at(30 * MINUTE))).toBe(20 * MINUTE);
  });

  it('종료 예정 시각도 멈춘 만큼 밀린다', () => {
    const clean = session();
    expect(formatKstTime(scheduledEndMs(clean, T0))).toBe('10:40'); // 10:00 + 40분

    const resumed = session({ pausedTotalSec: 8 * MINUTE });
    expect(formatKstTime(scheduledEndMs(resumed, at(20 * MINUTE)))).toBe('10:48');
  });

  it('멈춰 있는 동안에도 종료 예정 시각이 계속 밀린다 — 그래서 화면에는 안 띄운다', () => {
    const paused = session({ pausedAt: new Date(at(10 * MINUTE)).toISOString() });
    const endA = scheduledEndMs(paused, at(15 * MINUTE));
    const endB = scheduledEndMs(paused, at(25 * MINUTE));
    expect(endB - endA).toBe(10 * MINUTE * 1000);
  });

  it('일시정지 중에는 시간이 다 된 것으로 보지 않는다', () => {
    const paused = session({ pausedAt: new Date(at(5 * MINUTE)).toISOString() });
    expect(isOverdue(paused, at(999 * MINUTE))).toBe(false);
  });
});

describe('★ 일시정지 상태로 자정을 넘김 (PRD §14)', () => {
  it('시작한 지 24시간이 지나면 죽은 세션으로 본다', () => {
    const paused = session({ pausedAt: new Date(at(10 * MINUTE)).toISOString() });

    expect(isStale(paused, at(23 * 3600))).toBe(false);
    expect(isStale(paused, at(25 * 3600))).toBe(true);
  });

  it('죽은 세션에서도 남은 시간이 음수가 되지 않는다', () => {
    const paused = session({ pausedAt: new Date(at(10 * MINUTE)).toISOString() });
    // 다음 날 재개했다고 가정해도 값이 이상해지지 않는다
    expect(remainingSec(paused, at(30 * 3600))).toBe(30 * MINUTE);
    expect(remainingSec(paused, at(30 * 3600))).toBeGreaterThanOrEqual(0);
  });

  it('이미 끝난 세션은 오래돼도 죽은 세션이 아니다', () => {
    const ended = session({ endedAt: new Date(at(40 * MINUTE)).toISOString() });
    expect(isStale(ended, at(100 * 3600))).toBe(false);
  });
});

describe('아무도 보고 있지 않았을 때 (PRD §10)', () => {
  it('예정 시각이 지났으면 넘겨야 할 상태로 잡는다', () => {
    const s = session();
    expect(isOverdue(s, at(39 * MINUTE))).toBe(false);
    expect(isOverdue(s, at(40 * MINUTE))).toBe(true);
    expect(isOverdue(s, at(200 * MINUTE))).toBe(true);
  });

  it('★ 두 시간을 방치해도 40분 세션은 40분만 채운 것으로 센다', () => {
    // 실제로 흐른 시간으로 세면 누적 학습시간이 부풀려진다
    const s = session();
    expect(creditedSec(s, at(120 * MINUTE))).toBe(40 * MINUTE);
    expect(progress(s, at(120 * MINUTE))).toBe(1);
  });
});

describe('누적 학습시간은 배정 기준으로 센다 (PRD §14 — 자정을 넘겨 학습하는 경우)', () => {
  it('학습 세션만 더한다. 쉬는 시간은 빼고', () => {
    const sessions: TimerSession[] = [
      session({ id: 'a', kind: 'study', endedAt: new Date(at(40 * MINUTE)).toISOString() }),
      session({
        id: 'b',
        kind: 'break',
        plannedSec: 10 * MINUTE,
        startedAt: new Date(at(40 * MINUTE)).toISOString(),
        endedAt: new Date(at(50 * MINUTE)).toISOString(),
      }),
      session({
        id: 'c',
        kind: 'study',
        startedAt: new Date(at(50 * MINUTE)).toISOString(),
        endedAt: new Date(at(73 * MINUTE)).toISOString(),
      }),
    ];

    expect(totalStudySec(sessions, at(80 * MINUTE))).toBe(63 * MINUTE);
    expect(formatDuration(totalStudySec(sessions, at(80 * MINUTE)))).toBe('1시간 3분');
    expect(studySessionCount(sessions)).toBe(2);
  });

  it('★ 날짜가 바뀌어도 끊기지 않는다 — 이 함수는 날짜를 아예 보지 않는다', () => {
    // 23:50에 뽑고 00:10에 타이머를 켠 상황
    const lateNight = Date.parse('2026-09-04T14:50:00.000Z'); // KST 23:50
    const sessions: TimerSession[] = [
      {
        id: 'a',
        kind: 'study',
        plannedSec: 40 * MINUTE,
        startedAt: new Date(lateNight).toISOString(),
        pausedAt: null,
        pausedTotalSec: 0,
        endedAt: new Date(lateNight + 40 * MINUTE * 1000).toISOString(), // KST 00:30, 날짜가 바뀜
      },
    ];
    expect(totalStudySec(sessions, lateNight + 60 * MINUTE * 1000)).toBe(40 * MINUTE);
  });

  it('진행 중인 세션도 흐른 만큼 더해진다', () => {
    const sessions = [session()];
    expect(totalStudySec(sessions, at(12 * MINUTE))).toBe(12 * MINUTE);
  });

  it('세션이 없으면 0', () => {
    expect(totalStudySec([], T0)).toBe(0);
    expect(formatDuration(0)).toBe('0분');
  });
});

describe('화면 표기', () => {
  it('MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(9)).toBe('00:09');
    expect(formatClock(60)).toBe('01:00');
    expect(formatClock(23 * MINUTE + 14)).toBe('23:14');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('한 시간을 넘기면 시간까지 보여준다', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3600 + 5 * MINUTE + 3)).toBe('1:05:03');
  });

  it('누적은 사람이 읽는 말로', () => {
    expect(formatDuration(25 * MINUTE)).toBe('25분');
    expect(formatDuration(60 * MINUTE)).toBe('1시간');
    expect(formatDuration(63 * MINUTE)).toBe('1시간 3분');
    expect(formatDuration(3 * 3600 + 12 * MINUTE)).toBe('3시간 12분');
  });

  it('시각은 한국 시간으로 (PRD §8)', () => {
    // UTC 01:00 = KST 10:00
    expect(formatKstTime(T0)).toBe('10:00');
    // UTC 15:00 = 다음 날 KST 00:00
    expect(formatKstTime(Date.parse('2026-09-04T15:00:00.000Z'))).toBe('00:00');
  });
});

describe('시간 고르기 (PRD §6 S6)', () => {
  it('기본값은 학습 40분, 쉬는 시간 10분', () => {
    expect(STUDY_DEFAULT).toBe(40);
    expect(BREAK_DEFAULT).toBe(10);
  });

  it('범위를 벗어나면 붙여준다', () => {
    expect(clampMinutes(3, 'study')).toBe(STUDY_MIN);
    expect(clampMinutes(500, 'study')).toBe(STUDY_MAX);
    expect(clampMinutes(-1, 'break')).toBe(0);
    expect(clampMinutes(99, 'break')).toBe(BREAK_MAX);
  });

  it('숫자가 아니면 기본값', () => {
    expect(clampMinutes(Number.NaN, 'study')).toBe(STUDY_DEFAULT);
    expect(clampMinutes(Number.POSITIVE_INFINITY, 'break')).toBe(BREAK_DEFAULT);
  });

  it('− / + 는 5분 단위로 움직인다', () => {
    expect(STEP_MINUTES).toBe(5);
    expect(stepMinutes(40, 1, 'study')).toBe(45);
    expect(stepMinutes(40, -1, 'study')).toBe(35);
  });

  it('5의 배수가 아닌 값에서는 다음 5의 배수로 붙는다', () => {
    // 프리셋 25에서 +를 누르면 30, 이후로는 5씩
    expect(stepMinutes(25, 1, 'study')).toBe(30);
    expect(stepMinutes(23, 1, 'study')).toBe(25);
    expect(stepMinutes(23, -1, 'study')).toBe(20);
  });

  it('범위 끝에서 더 눌러도 넘어가지 않는다', () => {
    expect(stepMinutes(STUDY_MAX, 1, 'study')).toBe(STUDY_MAX);
    expect(stepMinutes(STUDY_MIN, -1, 'study')).toBe(STUDY_MIN);
    expect(stepMinutes(0, -1, 'break')).toBe(0);
    expect(stepMinutes(BREAK_MAX, 1, 'break')).toBe(BREAK_MAX);
  });

  it('쉬는 시간은 0분도 된다 — 안 쉬는 조도 있다', () => {
    expect(clampMinutes(0, 'break')).toBe(0);
  });

  it('어떤 값을 넣어도 범위 안에 들어온다 — 무작위 500회', () => {
    for (let i = 0; i < 500; i++) {
      const raw = Math.random() * 400 - 100;
      for (const kind of ['study', 'break'] as SessionKind[]) {
        const result = clampMinutes(raw, kind);
        const [min, max] = kind === 'study' ? [STUDY_MIN, STUDY_MAX] : [0, BREAK_MAX];
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });
});

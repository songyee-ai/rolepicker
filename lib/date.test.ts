import { describe, expect, it } from 'vitest';
import {
  addDays,
  assertDateStr,
  daysBetween,
  formatKstDateLabel,
  isDateStr,
  kstDayRangeUtc,
  todayKst,
} from './date';

describe('todayKst — 서버가 UTC라도 한국 날짜가 나와야 한다 (PRD §14)', () => {
  it('한국시간 오전 9시 이전에도 날짜가 하루 어긋나지 않는다', () => {
    // UTC 2026-03-11 23:30 = KST 2026-03-12 08:30
    const utc = new Date('2026-03-11T23:30:00.000Z');
    expect(utc.toISOString().slice(0, 10)).toBe('2026-03-11'); // 그냥 쓰면 하루 밀린다
    expect(todayKst(utc)).toBe('2026-03-12'); // 유틸을 쓰면 맞다
  });

  it('한국시간 자정 직전과 직후를 가른다', () => {
    expect(todayKst(new Date('2026-03-11T14:59:59.999Z'))).toBe('2026-03-11'); // KST 23:59:59
    expect(todayKst(new Date('2026-03-11T15:00:00.000Z'))).toBe('2026-03-12'); // KST 00:00:00
  });

  it('월말과 연말을 넘길 때도 맞다', () => {
    expect(todayKst(new Date('2026-02-28T15:00:00.000Z'))).toBe('2026-03-01');
    expect(todayKst(new Date('2026-12-31T15:00:00.000Z'))).toBe('2027-01-01');
  });

  it('Intl이 계산한 서울 날짜와 항상 같다', () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    for (let i = 0; i < 400; i++) {
      const at = new Date(Date.UTC(2026, 0, 1) + i * 7 * 3600 * 1000);
      expect(todayKst(at)).toBe(formatter.format(at));
    }
  });
});

describe('daysBetween', () => {
  it('앞뒤 순서와 부호가 맞다', () => {
    expect(daysBetween('2026-03-10', '2026-03-12')).toBe(2);
    expect(daysBetween('2026-03-12', '2026-03-10')).toBe(-2);
    expect(daysBetween('2026-03-12', '2026-03-12')).toBe(0);
  });

  it('월·연·윤년을 넘어도 맞다', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // 2028은 윤년
  });
});

describe('addDays', () => {
  it('경계를 넘어간다', () => {
    expect(addDays('2026-03-12', 1)).toBe('2026-03-13');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-12', 0)).toBe('2026-03-12');
  });

  it('daysBetween과 서로 맞물린다', () => {
    for (let i = -60; i <= 60; i++) {
      expect(daysBetween('2026-03-12', addDays('2026-03-12', i))).toBe(i);
    }
  });
});

describe('kstDayRangeUtc — 타임스탬프 범위 조회용', () => {
  it('KST 하루는 UTC 전날 15시에 시작한다', () => {
    const { start, end } = kstDayRangeUtc('2026-03-12');
    expect(start.toISOString()).toBe('2026-03-11T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-12T15:00:00.000Z');
  });
});

describe('날짜 형식 검사', () => {
  it('형식이 틀리면 던진다', () => {
    expect(() => assertDateStr('2026-3-12')).toThrow();
    expect(() => assertDateStr('20260312')).toThrow();
    expect(() => assertDateStr('')).toThrow();
  });

  it('존재하지 않는 날짜를 거른다', () => {
    expect(() => assertDateStr('2026-02-30')).toThrow();
    expect(() => assertDateStr('2026-13-01')).toThrow();
    expect(isDateStr('2026-02-29')).toBe(false); // 2026은 윤년이 아니다
    expect(isDateStr('2028-02-29')).toBe(true);
  });
});

describe('formatKstDateLabel', () => {
  it('화면 문구 형태로 만든다', () => {
    expect(formatKstDateLabel('2026-03-12')).toBe('3월 12일 목요일');
    expect(formatKstDateLabel('2026-01-01')).toBe('1월 1일 목요일');
  });
});

import { describe, expect, it } from 'vitest';
import { averagePerStudiedDay, densityTiers, spread } from './history';
import { formatDuration } from './timer';

describe('색 농도 — 표를 훑으면 고루 돌았는지가 보여야 한다 (PRD §6 S8)', () => {
  it('★ 0회는 다른 단계와 구분되는 자기 단계를 갖는다', () => {
    // 이 화면의 목적이 "0이 보이는 것"이다
    expect(densityTiers([0, 2, 3, 4])[0]).toBe(0);
  });

  it('고루 돌았으면 색이 균일하다', () => {
    // 다섯 명이 두 번씩. 쏠린 곳이 없다는 것이 한눈에 보여야 한다
    expect(densityTiers([2, 2, 2, 2, 2])).toEqual([2, 2, 2, 2, 2]);
  });

  it('쏠렸으면 진한 곳과 연한 곳이 갈린다', () => {
    const tiers = densityTiers([1, 2, 3, 4]);
    expect(tiers[0]).toBe(1); // 가장 적게 맡은 사람
    expect(tiers[3]).toBe(3); // 가장 많이 맡은 사람
    expect(tiers[0]).toBeLessThan(tiers[3]);
  });

  it('한 명만 맡았어도 0회와는 구분된다', () => {
    expect(densityTiers([0, 0, 1, 0])).toEqual([0, 0, 2, 0]);
  });

  it('아무도 안 맡았으면 전부 0단계', () => {
    expect(densityTiers([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('빈 표에서도 터지지 않는다', () => {
    expect(densityTiers([])).toEqual([]);
  });

  it('절대 숫자로 자르지 않는다 — 조마다 횟수의 크기가 다르다', () => {
    // 적게 쌓인 조와 많이 쌓인 조가 같은 모양으로 읽혀야 한다
    const small = densityTiers([1, 2, 3]);
    const large = densityTiers([10, 20, 30]);
    expect(small).toEqual(large);
  });

  it('단계는 항상 0~3 안에 있다 — 무작위 300회', () => {
    for (let i = 0; i < 300; i++) {
      const size = 1 + Math.floor(Math.random() * 12);
      const counts = Array.from({ length: size }, () => Math.floor(Math.random() * 40));
      for (const tier of densityTiers(counts)) {
        expect(tier).toBeGreaterThanOrEqual(0);
        expect(tier).toBeLessThanOrEqual(3);
      }
    }
  });

  it('많이 맡은 사람이 적게 맡은 사람보다 연해지지 않는다 — 무작위 300회', () => {
    for (let i = 0; i < 300; i++) {
      const counts = Array.from({ length: 8 }, () => Math.floor(Math.random() * 20));
      const tiers = densityTiers(counts);
      for (let a = 0; a < counts.length; a++) {
        for (let b = 0; b < counts.length; b++) {
          if (counts[a] > counts[b]) expect(tiers[a]).toBeGreaterThanOrEqual(tiers[b]);
        }
      }
    }
  });
});

describe('최대-최소 차이 (PRD §16)', () => {
  it('0회인 사람을 포함해서 센다', () => {
    expect(spread([0, 2, 2, 2])).toBe(2);
  });

  it('고루 돌았으면 0', () => {
    expect(spread([3, 3, 3])).toBe(0);
  });

  it('빈 목록은 0', () => {
    expect(spread([])).toBe(0);
  });
});

describe('하루 평균 학습 시간', () => {
  it('★ 기간 전체가 아니라 타이머를 켠 날로만 나눈다', () => {
    // 14일 중 8일만 썼다. 14로 나누면 실제보다 훨씬 짧게 보인다
    const total = 8 * 3 * 3600; // 8일 동안 하루 3시간씩
    expect(formatDuration(averagePerStudiedDay(total, 8))).toBe('3시간');
    expect(formatDuration(averagePerStudiedDay(total, 14))).toBe('1시간 42분');
  });

  it('목업 09의 숫자를 만든다', () => {
    // 하루 평균 3시간 12분
    const total = 5 * (3 * 3600 + 12 * 60);
    expect(formatDuration(averagePerStudiedDay(total, 5))).toBe('3시간 12분');
  });

  it('켠 날이 없으면 0', () => {
    expect(averagePerStudiedDay(0, 0)).toBe(0);
    expect(averagePerStudiedDay(5000, 0)).toBe(0);
  });
});

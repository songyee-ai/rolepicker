/**
 * 지난 기록의 계산. (PRD §6 S8)
 *
 * 이 화면의 목적은 하나다 — **0이 보이는 것.**
 * 표를 훑었을 때 "고루 돌았나"가 색으로 읽혀야 한다.
 *
 * 순수 함수만 담는다. DB도 현재 시각도 만지지 않는다.
 */

/** 셀 색의 단계. 0 = 아직 한 번도 (다른 단계와 다르게 그린다) */
export type DensityTier = 0 | 1 | 2 | 3;

/**
 * 한 열(역할)의 횟수들을 색 단계로 바꾼다.
 *
 * 절대 숫자로 자르지 않는다. 조 인원과 기간에 따라 횟수의 크기가 달라지므로
 * "3회 이상이면 진하게" 같은 기준은 어떤 조에서는 전부 진하고 어떤 조에서는
 * 전부 연해진다.
 *
 * 대신 **그 열 안에서의 퍼짐**을 본다.
 *   0회               -> 0단계. 색이 아니라 빈 칸으로 그린다
 *   전부 같은 횟수      -> 모두 2단계. 고루 돌았다는 뜻이므로 균일하게 보인다
 *   퍼져 있으면        -> 적은 쪽 1단계, 많은 쪽 3단계
 *
 * 그래서 표를 훑었을 때 **색이 균일하면 고루 돌았고, 진하고 연한 것이 섞여
 * 있으면 쏠렸다**는 것이 바로 읽힌다.
 */
export function densityTiers(counts: number[]): DensityTier[] {
  const held = counts.filter((count) => count > 0);
  if (held.length === 0) return counts.map(() => 0);

  const low = Math.min(...held);
  const high = Math.max(...held);

  return counts.map((count) => {
    if (count === 0) return 0;
    if (high === low) return 2;
    const ratio = (count - low) / (high - low);
    return (1 + Math.round(ratio * 2)) as DensityTier;
  });
}

/** 최대 - 최소. PRD §16의 "고루 돌았나"를 한 숫자로 (0회도 포함해서 센다) */
export function spread(counts: number[]): number {
  if (counts.length === 0) return 0;
  return Math.max(...counts) - Math.min(...counts);
}

/**
 * 하루 평균 학습 시간 (초).
 *
 * 기간 전체가 아니라 **타이머를 켠 날로만** 나눈다.
 * 14일 중 8일만 썼는데 14로 나누면 실제보다 훨씬 짧게 보이고,
 * 그 숫자로는 "우리 조가 하루에 얼마나 하나"를 알 수 없다.
 */
export function averagePerStudiedDay(totalSec: number, studiedDayCount: number): number {
  if (studiedDayCount <= 0) return 0;
  return Math.round(totalSec / studiedDayCount);
}

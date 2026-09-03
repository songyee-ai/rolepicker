/**
 * 난수.
 *
 * 실제 서비스는 Math.random을 쓰고, 테스트는 시드를 고정한 난수를 주입한다.
 * 시드를 고정하면 같은 입력에 항상 같은 결과가 나오므로,
 * "이유 없이 가끔 실패하는 검사"가 생기지 않는다.
 */

/** 0 이상 1 미만의 실수를 돌려주는 함수 */
export type Rng = () => number;

export const systemRng: Rng = () => Math.random();

/** mulberry32 — 짧고 분포가 고른 시드 난수 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

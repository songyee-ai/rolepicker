/**
 * 화면에 그대로 나가는 고정 문구. (PRD §4)
 * 화면과 서버가 같은 문장을 써야 하므로 shared에 둔다.
 */

/** 뽑기 대기 화면에 노출하는 그라운드 룰 (PRD §4, §6 S4) */
export const GROUND_RULES = [
  '카메라는 켜두기',
  '조용한 그루에게 먼저 말 걸기',
  '모르면 옆 그루에게 물어보기',
] as const;

/**
 * 사용법 화면의 역할 카드. (PRD §6 S1)
 * 결과 화면의 긴 설명(back/roles.ts)과 달리 한 줄로 줄인 것이다.
 */
export const DEFAULT_ROLE_GUIDE = [
  { emoji: '🎯', name: '이끄미', short: '범위·쉬는시간·학습법을 정하고 토의를 이끌어요' },
  { emoji: '⏱️', name: '시간지키미', short: '학습시간과 쉬는시간을 챙겨요' },
] as const;

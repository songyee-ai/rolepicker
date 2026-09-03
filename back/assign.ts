/**
 * 역할 배정. (PRD §7)
 *
 * 이 파일은 순수 함수만 담는다. DB도, 현재 시각도, Math.random도 직접 만지지 않는다.
 * 전부 인자로 받기 때문에 화면 없이 수만 번 돌려볼 수 있다.
 *
 * 규칙 요약
 *   1. 참여자만 후보. 빈자리는 제외
 *   2. 역할을 priority 순으로 처리 (이끄미 -> 시간지키미)
 *   3. 최근 COOLDOWN_DAYS일 안에 같은 역할을 맡은 사람은 후보에서 제외
 *   4. 남은 후보의 가중치 = 그 역할을 마지막으로 맡은 날로부터 지난 일수
 *      한 번도 맡지 않은 사람은 NEVER_WEIGHT
 *   5. 가중치 비례 랜덤으로 한 명. 뽑힌 사람은 이후 역할 후보에서 빠진다 (겸임 없음)
 *   6. 남은 사람은 모두 그루
 */

import { daysBetween, type DateStr } from '@/shared/date';
import { systemRng, type Rng } from './rng';

/** 최근 며칠 안에 같은 역할을 맡았으면 후보에서 빼는가 (PRD §7) */
export const COOLDOWN_DAYS = 3;

/** 그 역할을 한 번도 맡지 않은 사람의 가중치 (PRD §7) */
export const NEVER_WEIGHT = 999;

export interface Role {
  id: string;
  key: string;
  /** 낮을수록 먼저 배정한다 */
  priority: number;
  /** 그루처럼 뽑지 않는 기본 역할 */
  isDefault: boolean;
}

export interface HistoryEntry {
  /** KST 기준 날짜 */
  date: DateStr;
  roleId: string;
  memberId: string;
}

export interface Pick {
  roleId: string;
  memberId: string;
}

export type AssignErrorCode = 'NO_PARTICIPANTS' | 'NO_ROLES';

/** 배정을 만들 수 없는 경우. 라우트 핸들러가 code를 보고 응답을 정한다 */
export class AssignError extends Error {
  constructor(
    readonly code: AssignErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssignError';
  }
}

export interface AssignInput {
  /** 오늘 참여하는 그루. 빈자리는 여기 들어오지 않는다 */
  presentMemberIds: string[];
  roles: Role[];
  /** 지난 배정 기록. 오늘 날짜 기록이 섞여 있어도 무시한다 */
  history: HistoryEntry[];
  today: DateStr;
  /**
   * 다시 뽑기일 때만 넘긴다. 덮어쓰기 전 배정.
   * 각 역할의 직전 당첨자를 그 역할 후보에서 뺀다.
   * 안 그러면 5명 조에서는 절반 가까이 같은 사람이 다시 나와서 버튼이 아무 일도 안 한 것처럼 보인다.
   */
  previousPicks?: Pick[];
  rng?: Rng;
  cooldownDays?: number;
  neverWeight?: number;
}

/** 왜 그렇게 뽑혔는지. 테스트와 디버깅용이며 화면에는 쓰지 않는다 */
export interface RoleTrace {
  roleId: string;
  /** 겸임 제외 후 남은 사람 */
  poolIds: string[];
  /** 쿨다운·다시뽑기 제외까지 끝난 최종 후보 */
  candidateIds: string[];
  weights: number[];
  /** 실제로 적용된 쿨다운 일수. 후보가 0명이 되어 줄였다면 원래 값보다 작다 */
  cooldownUsed: number;
  /** 다시 뽑기로 후보에서 뺀 사람 */
  excludedPreviousId: string | null;
  /** 다시 뽑기 제외를 적용하면 후보가 0명이 되어 되돌렸는가 */
  previousExclusionReverted: boolean;
}

export interface AssignResult {
  picks: Pick[];
  /** 뽑히지 않은 참여자 전원 (PRD §7-5) */
  grooMemberIds: string[];
  /** 사람이 부족해서 비운 역할 (PRD §7 예외) */
  unfilledRoleIds: string[];
  explain: RoleTrace[];
}

export function assign(input: AssignInput): AssignResult {
  const {
    today,
    history,
    previousPicks = [],
    rng = systemRng,
    cooldownDays = COOLDOWN_DAYS,
    neverWeight = NEVER_WEIGHT,
  } = input;

  // 1. 참여자만 후보에 넣는다. 빈자리는 제외 (PRD §7-1)
  const present = dedupe(input.presentMemberIds);

  // 참여 인원 0명 -> 배정 거부 (PRD §7 예외)
  if (present.length === 0) {
    throw new AssignError(
      'NO_PARTICIPANTS',
      '참여하는 그루가 없어요. 명단에서 참여로 바꾼 뒤 다시 뽑아주세요.',
    );
  }

  // 2. 뽑는 역할만 priority 순으로 (PRD §7-2). 그루는 뽑지 않는다 (PRD §4)
  const pickableRoles = input.roles
    .filter((role) => !role.isDefault)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  if (pickableRoles.length === 0) {
    throw new AssignError('NO_ROLES', '뽑을 역할이 없어요.');
  }

  const lastHeldAt = buildLastHeldIndex(history, today);
  const previousByRole = new Map(previousPicks.map((p) => [p.roleId, p.memberId]));

  const picks: Pick[] = [];
  const unfilledRoleIds: string[] = [];
  const explain: RoleTrace[] = [];
  const takenToday = new Set<string>();

  for (const role of pickableRoles) {
    // 겸임 없음. 오늘 이미 뽑힌 사람은 빠진다 (PRD §7-4)
    const pool = present.filter((memberId) => !takenToday.has(memberId));

    // 참여 인원 < 역할 수 -> priority 높은 역할만 채우고 나머지는 비운다 (PRD §7 예외)
    // 참여 1명이면 이 규칙에 따라 자연히 이끄미만 배정된다
    if (pool.length === 0) {
      unfilledRoleIds.push(role.id);
      continue;
    }

    const lastByMember = lastHeldAt.get(role.id);
    const daysSince = (memberId: string): number | null => {
      const last = lastByMember?.get(memberId);
      return last === undefined ? null : daysBetween(last, today);
    };

    // 다시 뽑기: 직전 당첨자를 뺀다. 단 그러면 후보가 0명이 되는 조(예: 2명 조)에서는 되돌린다
    const previousId = previousByRole.get(role.id) ?? null;
    let basePool = pool;
    let excludedPreviousId: string | null = null;
    let previousExclusionReverted = false;
    if (previousId !== null && pool.includes(previousId)) {
      const withoutPrevious = pool.filter((memberId) => memberId !== previousId);
      if (withoutPrevious.length > 0) {
        basePool = withoutPrevious;
        excludedPreviousId = previousId;
      } else {
        previousExclusionReverted = true;
      }
    }

    // 3. 쿨다운. 후보가 0명이면 1일씩 줄여가며 재시도하고, 그래도 0이면 쿨다운을 무시한다
    //    (PRD §7 예외 — 쿨다운 때문에 후보가 0명이 되는 경우)
    let candidateIds: string[] = [];
    let cooldownUsed = cooldownDays;
    for (let cooldown = cooldownDays; cooldown >= 0; cooldown--) {
      candidateIds = basePool.filter((memberId) => {
        const since = daysSince(memberId);
        return since === null || since > cooldown;
      });
      cooldownUsed = cooldown;
      if (candidateIds.length > 0) break;
    }
    if (candidateIds.length === 0) {
      // 여기까지 오면 안 되지만, 오더라도 배정은 나와야 한다
      candidateIds = basePool;
      cooldownUsed = -1;
    }

    // 4. 가중치 = 그 역할을 마지막으로 맡은 날로부터 지난 일수. 미경험자는 NEVER_WEIGHT
    const weights = candidateIds.map((memberId) => {
      const since = daysSince(memberId);
      return since === null ? neverWeight : Math.max(1, since);
    });

    // 5. 가중치 비례 랜덤. 가중치가 높아도 반드시 뽑히는 건 아니다 (PRD §7 — 완전 결정론 금지)
    const pickedId = pickWeighted(candidateIds, weights, rng);

    takenToday.add(pickedId);
    picks.push({ roleId: role.id, memberId: pickedId });
    explain.push({
      roleId: role.id,
      poolIds: pool,
      candidateIds,
      weights,
      cooldownUsed,
      excludedPreviousId,
      previousExclusionReverted,
    });
  }

  // 6. 남은 사람은 모두 그루 (PRD §7-5)
  const grooMemberIds = present.filter((memberId) => !takenToday.has(memberId));

  return { picks, grooMemberIds, unfilledRoleIds, explain };
}

/**
 * 역할별로 "각 사람이 그 역할을 마지막으로 맡은 날"을 만든다.
 *
 * 오늘 날짜 기록은 무시한다. 하루 배정은 한 줄이고 다시 뽑기는 그 줄을 덮어쓰므로
 * (PRD §3-5), 오늘 기록을 가중치에 넣으면 다시 뽑기가 직전 결과를 두 번 처벌한다.
 * 미래 날짜도 같은 이유로 무시한다.
 */
function buildLastHeldIndex(
  history: HistoryEntry[],
  today: DateStr,
): Map<string, Map<string, DateStr>> {
  const index = new Map<string, Map<string, DateStr>>();
  for (const entry of history) {
    if (daysBetween(entry.date, today) <= 0) continue;
    let byMember = index.get(entry.roleId);
    if (!byMember) {
      byMember = new Map();
      index.set(entry.roleId, byMember);
    }
    const known = byMember.get(entry.memberId);
    // 'YYYY-MM-DD'는 문자열 비교만으로 날짜 순서가 맞는다
    if (known === undefined || known < entry.date) {
      byMember.set(entry.memberId, entry.date);
    }
  }
  return index;
}

function pickWeighted(ids: string[], weights: number[], rng: Rng): string {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = rng() * total;
  for (let i = 0; i < ids.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return ids[i];
  }
  // rng()가 1에 아주 가까울 때의 부동소수점 오차 대비
  return ids[ids.length - 1];
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

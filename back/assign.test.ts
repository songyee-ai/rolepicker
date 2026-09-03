import { describe, expect, it } from 'vitest';
import {
  assign,
  AssignError,
  COOLDOWN_DAYS,
  NEVER_WEIGHT,
  type AssignInput,
  type HistoryEntry,
  type Role,
} from './assign';
import { addDays } from '@/shared/date';
import { seededRng, type Rng } from './rng';

// ─────────────────────────────────────────────────────────────
// 공통 준비물
// ─────────────────────────────────────────────────────────────

const LEAD: Role = { id: 'lead', key: 'lead', priority: 0, isDefault: false };
const KEEPER: Role = { id: 'keeper', key: 'keeper', priority: 1, isDefault: false };
const GROO: Role = { id: 'groo', key: 'groo', priority: 2, isDefault: true };
const ROLES = [LEAD, KEEPER, GROO];

const TODAY = '2026-03-12';

/** n일 전에 memberId가 roleId를 맡았다는 기록 */
function heldAgo(memberId: string, roleId: string, daysAgo: number): HistoryEntry {
  return { date: addDays(TODAY, -daysAgo), roleId, memberId };
}

type PartialInput = Partial<AssignInput> & Pick<AssignInput, 'presentMemberIds'>;

function run(input: PartialInput) {
  return assign({
    roles: ROLES,
    history: [],
    today: TODAY,
    rng: seededRng(42),
    ...input,
  });
}

/** 같은 입력을 시드만 바꿔 여러 번 돌린다 */
function runMany(times: number, input: PartialInput) {
  return Array.from({ length: times }, (_, i) =>
    assign({ roles: ROLES, history: [], today: TODAY, rng: seededRng(i + 1), ...input }),
  );
}

type Result = ReturnType<typeof assign>;

const pickedFor = (result: Result, roleId: string) =>
  result.picks.find((p) => p.roleId === roleId)?.memberId ?? null;

const traceFor = (result: Result, roleId: string) => {
  const trace = result.explain.find((t) => t.roleId === roleId);
  if (!trace) throw new Error(roleId + ' 배정 기록이 없습니다');
  return trace;
};

function tally(values: (string | null)[]): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

// ─────────────────────────────────────────────────────────────

describe('기본 배정', () => {
  it('5명이면 이끄미 1명, 시간지키미 1명, 나머지는 모두 그루 (PRD §7-5)', () => {
    const result = run({ presentMemberIds: ['a', 'b', 'c', 'd', 'e'] });

    expect(result.picks).toHaveLength(2);
    expect(result.grooMemberIds).toHaveLength(3);
    expect(result.unfilledRoleIds).toEqual([]);

    // 뽑힌 2명 + 그루 3명 = 참여자 5명. 빠지거나 겹치는 사람이 없다
    const everyone = [...result.picks.map((p) => p.memberId), ...result.grooMemberIds];
    expect([...everyone].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('그루는 뽑지 않는다 — is_default 역할은 배정 대상이 아니다 (PRD §4)', () => {
    const result = run({ presentMemberIds: ['a', 'b', 'c'] });
    expect(result.picks.map((p) => p.roleId)).toEqual(['lead', 'keeper']);
    expect(result.picks.some((p) => p.roleId === 'groo')).toBe(false);
  });

  it('빈자리는 절대 뽑히지 않는다 (PRD §7-1)', () => {
    // 이서연(e)은 오늘 빈자리라서 참여자 목록에 없다
    const results = runMany(200, { presentMemberIds: ['a', 'b', 'c', 'd'] });
    for (const result of results) {
      expect(result.picks.map((p) => p.memberId)).not.toContain('e');
      expect(result.grooMemberIds).not.toContain('e');
    }
  });

  it('priority가 낮은 역할을 먼저 배정한다 (PRD §7-2)', () => {
    const shuffled = [KEEPER, GROO, LEAD]; // 일부러 순서를 섞어서 넣는다
    const result = run({ presentMemberIds: ['a', 'b', 'c'], roles: shuffled });
    expect(result.picks.map((p) => p.roleId)).toEqual(['lead', 'keeper']);
  });

  it('참여자 목록에 같은 사람이 중복돼도 한 명으로 센다', () => {
    const result = run({ presentMemberIds: ['a', 'a', 'b', 'b', 'c'] });
    const everyone = [...result.picks.map((p) => p.memberId), ...result.grooMemberIds];
    expect([...everyone].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('겸임 없음 (PRD §7-4)', () => {
  it('이끄미와 시간지키미가 같은 사람인 경우는 없다', () => {
    const results = runMany(300, { presentMemberIds: ['a', 'b', 'c', 'd', 'e'] });
    for (const result of results) {
      expect(pickedFor(result, 'lead')).not.toBe(pickedFor(result, 'keeper'));
    }
  });

  it('인원이 딱 2명일 때도 겸임하지 않는다', () => {
    const results = runMany(200, { presentMemberIds: ['a', 'b'] });
    for (const result of results) {
      const pair = [pickedFor(result, 'lead'), pickedFor(result, 'keeper')].sort();
      expect(pair).toEqual(['a', 'b']);
    }
  });

  it('이끄미로 뽑힌 사람은 시간지키미 후보 목록에서 아예 빠진다', () => {
    const result = run({ presentMemberIds: ['a', 'b', 'c', 'd'] });
    const lead = pickedFor(result, 'lead');
    expect(traceFor(result, 'keeper').poolIds).not.toContain(lead);
  });

  it('그루 목록에도 뽑힌 사람이 들어가지 않는다', () => {
    const results = runMany(100, { presentMemberIds: ['a', 'b', 'c', 'd'] });
    for (const result of results) {
      for (const pick of result.picks) {
        expect(result.grooMemberIds).not.toContain(pick.memberId);
      }
    }
  });
});

describe('한 번도 맡지 않은 사람이 섞여 있을 때 (PRD §7-3)', () => {
  it('미경험자가 압도적으로 먼저 뽑힌다', () => {
    // a, b, c는 이끄미 경험자. d만 한 번도 안 해봤다
    const history = [
      heldAgo('a', 'lead', 5),
      heldAgo('b', 'lead', 8),
      heldAgo('c', 'lead', 11),
    ];
    const leads = runMany(1000, { presentMemberIds: ['a', 'b', 'c', 'd'], history }).map((r) =>
      pickedFor(r, 'lead'),
    );

    const counts = tally(leads);
    // 가중치 999 대 (5 + 8 + 11) = 999 : 24 이므로 이론값 97.7%
    expect((counts.get('d') ?? 0) / 1000).toBeGreaterThan(0.95);
  });

  it('미경험자가 여러 명이면 그 사람들 사이에서 나온다', () => {
    const history = [heldAgo('a', 'lead', 2), heldAgo('b', 'lead', 9)];
    const leads = runMany(1000, { presentMemberIds: ['a', 'b', 'c', 'd'], history }).map((r) =>
      pickedFor(r, 'lead'),
    );

    const counts = tally(leads);
    const neverPicked = (counts.get('c') ?? 0) + (counts.get('d') ?? 0);
    expect(neverPicked / 1000).toBeGreaterThan(0.97);
    // 미경험자끼리는 가중치가 같으니 한쪽으로 쏠리지 않는다
    expect(counts.get('c') ?? 0).toBeGreaterThan(300);
    expect(counts.get('d') ?? 0).toBeGreaterThan(300);
  });

  it('전원이 미경험이면 아무도 배제되지 않는다 — 첫날 상황', () => {
    const members = ['a', 'b', 'c', 'd', 'e'];
    const result = run({ presentMemberIds: members });
    const trace = traceFor(result, 'lead');

    expect(trace.candidateIds).toEqual(members);
    expect(trace.weights).toEqual(members.map(() => NEVER_WEIGHT));

    // 1000번 돌리면 5명 모두가 이끄미로 나온다
    const leads = runMany(1000, { presentMemberIds: members }).map((r) => pickedFor(r, 'lead'));
    const counts = tally(leads);
    for (const member of members) {
      expect(counts.get(member) ?? 0).toBeGreaterThan(120); // 완전 균등이면 200
    }
  });

  it('가중치가 높아도 반드시 뽑히는 건 아니다 (PRD §7 — 완전 결정론 금지)', () => {
    // a는 10일 전(가중치 10), b는 4일 전(가중치 4). 둘 다 쿨다운은 지났다
    const history = [heldAgo('a', 'lead', 10), heldAgo('b', 'lead', 4)];
    const leads = runMany(1000, { presentMemberIds: ['a', 'b'], history }).map((r) =>
      pickedFor(r, 'lead'),
    );
    const counts = tally(leads);

    // 불리한 b도 분명히 뽑힌다
    expect(counts.get('b') ?? 0).toBeGreaterThan(150);
    // 그러면서도 가중치 비율(10:4 = 71.4%)을 대체로 따른다
    const ratioForA = (counts.get('a') ?? 0) / 1000;
    expect(ratioForA).toBeGreaterThan(0.65);
    expect(ratioForA).toBeLessThan(0.78);
  });
});

describe('쿨다운 ' + COOLDOWN_DAYS + '일 (PRD §7-3)', () => {
  it('어제 이끄미였던 사람은 오늘 후보에서 빠진다', () => {
    const result = run({
      presentMemberIds: ['a', 'b', 'c', 'd'],
      history: [heldAgo('a', 'lead', 1)],
    });
    expect(traceFor(result, 'lead').candidateIds).toEqual(['b', 'c', 'd']);
  });

  it('3일 전은 빠지고 4일 전은 들어온다 — 경계', () => {
    const result = run({
      presentMemberIds: ['a', 'b', 'c', 'd'],
      history: [heldAgo('a', 'lead', 3), heldAgo('b', 'lead', 4)],
    });
    const candidates = traceFor(result, 'lead').candidateIds;
    expect(candidates).not.toContain('a'); // 3일 전 = 쿨다운 안
    expect(candidates).toContain('b'); // 4일 전 = 쿨다운 밖
  });

  it('역할별로 따로 센다 — 이끄미 기록이 시간지키미 쿨다운에 영향을 주지 않는다', () => {
    // a는 어제 이끄미였다. 시간지키미로는 한 번도 안 했으니 시간지키미 후보여야 한다
    const result = run({
      presentMemberIds: ['a', 'b'],
      history: [heldAgo('a', 'lead', 1)],
    });
    expect(traceFor(result, 'lead').candidateIds).not.toContain('a');
    expect(pickedFor(result, 'lead')).toBe('b');
    expect(pickedFor(result, 'keeper')).toBe('a');
  });

  it('그루 기록은 아무 영향이 없다 — 그루는 뽑는 역할이 아니다', () => {
    const withGrooHistory = run({
      presentMemberIds: ['a', 'b', 'c'],
      history: ['a', 'b', 'c'].flatMap((m) => [1, 2, 3].map((d) => heldAgo(m, 'groo', d))),
    });
    const withoutHistory = run({ presentMemberIds: ['a', 'b', 'c'] });
    expect(withGrooHistory.picks).toEqual(withoutHistory.picks);
  });

  // ★ PRD §7이 "버그가 나는 지점"으로 지목한 케이스
  it('쿨다운 때문에 후보가 0명이 되면, 쿨다운을 1일씩 줄여가며 재시도한다', () => {
    // 3명 전원이 최근 3일 안에 이끄미를 했다 → 쿨다운 3으로는 후보가 0명
    const result = run({
      presentMemberIds: ['a', 'b', 'c'],
      history: [heldAgo('a', 'lead', 1), heldAgo('b', 'lead', 2), heldAgo('c', 'lead', 3)],
    });

    const trace = traceFor(result, 'lead');
    expect(trace.cooldownUsed).toBe(2); // 3 → 2로 줄여서 후보가 생겼다
    expect(trace.candidateIds).toEqual(['c']); // 가장 오래 전에 맡은 사람
    expect(pickedFor(result, 'lead')).toBe('c');
  });

  it('쿨다운을 0까지 줄여야 하는 경우 — 참여자가 전원 어제 맡은 상황', () => {
    // 하루 한 명이라 현실에서는 안 나오지만, 데이터가 이래도 배정은 나와야 한다
    const result = run({
      presentMemberIds: ['a', 'b', 'c'],
      history: ['a', 'b', 'c'].map((m) => heldAgo(m, 'lead', 1)),
    });

    const trace = traceFor(result, 'lead');
    expect(trace.cooldownUsed).toBe(0); // 쿨다운을 사실상 무시했다
    expect(trace.candidateIds).toEqual(['a', 'b', 'c']);
    expect(result.picks).toHaveLength(2);
  });

  it('참여자가 1명뿐이고 그 사람이 어제 이끄미였어도 배정은 나온다', () => {
    const result = run({
      presentMemberIds: ['a'],
      history: [heldAgo('a', 'lead', 1)],
    });
    expect(pickedFor(result, 'lead')).toBe('a');
    expect(traceFor(result, 'lead').cooldownUsed).toBe(0);
  });

  it('히스토리가 어떻게 생겼든 참여자가 있으면 배정이 나온다 — 무작위 300회', () => {
    const members = ['a', 'b', 'c', 'd', 'e'];
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seededRng(seed);

      // 지난 30일치를 마구잡이로 만든다
      const history: HistoryEntry[] = [];
      for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
        for (const roleId of ['lead', 'keeper', 'groo']) {
          const who = members[Math.floor(rng() * members.length)];
          history.push(heldAgo(who, roleId, daysAgo));
        }
      }

      const present = members.filter(() => rng() > 0.35);
      if (present.length === 0) continue;

      const result = assign({
        presentMemberIds: present,
        roles: ROLES,
        history,
        today: TODAY,
        rng,
      });

      expect(result.picks.length).toBeGreaterThanOrEqual(1);
      for (const pick of result.picks) {
        expect(present).toContain(pick.memberId); // 참여자 중에서만 뽑았다
      }
      // 겸임이 없다
      expect(new Set(result.picks.map((p) => p.memberId)).size).toBe(result.picks.length);
    }
  });
});

describe('참여 인원이 역할 수보다 적을 때 (PRD §7 예외)', () => {
  it('2명 — 두 역할이 다 차고 그루는 0명', () => {
    const result = run({ presentMemberIds: ['a', 'b'] });
    expect(result.picks).toHaveLength(2);
    expect(result.grooMemberIds).toEqual([]);
    expect(result.unfilledRoleIds).toEqual([]);
  });

  it('1명 — 이끄미만 배정하고 시간지키미는 비운다', () => {
    const result = run({ presentMemberIds: ['a'] });
    expect(result.picks).toEqual([{ roleId: 'lead', memberId: 'a' }]);
    expect(result.unfilledRoleIds).toEqual(['keeper']);
    expect(result.grooMemberIds).toEqual([]);
  });

  it('0명 — 배정을 거부하고, 사과하는 대신 무엇을 하면 되는지 알려준다 (PRD §17)', () => {
    expect(() => run({ presentMemberIds: [] })).toThrow(AssignError);

    try {
      run({ presentMemberIds: [] });
      expect.unreachable('에러가 나야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(AssignError);
      const assignError = error as AssignError;
      expect(assignError.code).toBe('NO_PARTICIPANTS');
      expect(assignError.message).not.toMatch(/죄송|미안/);
      expect(assignError.message).toContain('명단');
    }
  });

  it('뽑을 역할이 없으면 거부한다', () => {
    try {
      run({ presentMemberIds: ['a', 'b'], roles: [GROO] });
      expect.unreachable('에러가 나야 한다');
    } catch (error) {
      expect((error as AssignError).code).toBe('NO_ROLES');
    }
  });

  it('역할이 3개인데 참여자가 2명이면 우선순위 높은 둘만 채운다', () => {
    const extra: Role = { id: 'snack', key: 'snack', priority: 2, isDefault: false };
    const result = run({ presentMemberIds: ['a', 'b'], roles: [...ROLES, extra] });
    expect(result.picks.map((p) => p.roleId)).toEqual(['lead', 'keeper']);
    expect(result.unfilledRoleIds).toEqual(['snack']);
  });
});

describe('다시 뽑기 — 직전 당첨자를 후보에서 뺀다', () => {
  const present = ['a', 'b', 'c', 'd', 'e'];
  const previousPicks = [
    { roleId: 'lead', memberId: 'a' },
    { roleId: 'keeper', memberId: 'b' },
  ];

  it('직전 이끄미는 다시 뽑기에서 나오지 않는다', () => {
    const results = runMany(300, { presentMemberIds: present, previousPicks });
    for (const result of results) {
      expect(pickedFor(result, 'lead')).not.toBe('a');
      expect(pickedFor(result, 'keeper')).not.toBe('b');
      expect(traceFor(result, 'lead').excludedPreviousId).toBe('a');
    }
  });

  it('직전 시간지키미가 이끄미로 뽑히는 것은 막지 않는다 — 역할이 바뀌면 다시 뽑은 것이다', () => {
    const leads = runMany(300, { presentMemberIds: present, previousPicks }).map((r) =>
      pickedFor(r, 'lead'),
    );
    expect(leads).toContain('b');
  });

  it('2명 조 — 이끄미에서 직전 당첨자를 빼면 상대가 뽑힌다', () => {
    const result = run({ presentMemberIds: ['a', 'b'], previousPicks });

    expect(traceFor(result, 'lead').excludedPreviousId).toBe('a');
    expect(pickedFor(result, 'lead')).toBe('b');

    // 시간지키미 차례에는 a만 남는다. a는 직전 시간지키미가 아니므로 그냥 배정된다
    expect(pickedFor(result, 'keeper')).toBe('a');
    expect(result.unfilledRoleIds).toEqual([]);
  });

  it('1명 조 — 뺄 수 없으니 되돌리고 그 사람을 다시 배정한다', () => {
    const result = run({
      presentMemberIds: ['a'],
      previousPicks: [{ roleId: 'lead', memberId: 'a' }],
    });
    const trace = traceFor(result, 'lead');
    expect(trace.previousExclusionReverted).toBe(true);
    expect(trace.excludedPreviousId).toBeNull();
    expect(pickedFor(result, 'lead')).toBe('a');
  });

  it('직전 당첨자가 오늘 빈자리면 아무 영향이 없다', () => {
    const result = run({
      presentMemberIds: ['b', 'c', 'd'],
      previousPicks: [{ roleId: 'lead', memberId: 'a' }], // a는 오늘 빈자리
    });
    expect(traceFor(result, 'lead').excludedPreviousId).toBeNull();
    expect(traceFor(result, 'lead').candidateIds).toEqual(['b', 'c', 'd']);
  });

  it('previousPicks를 주지 않으면 첫 뽑기와 똑같이 동작한다', () => {
    const first = run({ presentMemberIds: present });
    const again = run({ presentMemberIds: present, previousPicks: [] });
    expect(again.picks).toEqual(first.picks);
  });
});

describe('오늘 기록은 가중치에 넣지 않는다 (PRD §3-5)', () => {
  it('오늘 날짜로 남아 있는 배정은 무시한다 — 다시 뽑기가 직전 결과를 두 번 처벌하지 않게', () => {
    const withTodayRow = run({
      presentMemberIds: ['a', 'b', 'c'],
      history: [{ date: TODAY, roleId: 'lead', memberId: 'a' }],
    });
    const withoutTodayRow = run({ presentMemberIds: ['a', 'b', 'c'] });

    expect(traceFor(withTodayRow, 'lead').candidateIds).toContain('a');
    expect(withTodayRow.picks).toEqual(withoutTodayRow.picks);
  });

  it('미래 날짜 기록도 무시한다', () => {
    const result = run({
      presentMemberIds: ['a', 'b', 'c'],
      history: [{ date: addDays(TODAY, 5), roleId: 'lead', memberId: 'a' }],
    });
    expect(traceFor(result, 'lead').candidateIds).toContain('a');
  });

  it('같은 사람의 기록이 여러 날 있으면 가장 최근 날짜만 본다', () => {
    const result = run({
      presentMemberIds: ['a', 'b'],
      history: [heldAgo('a', 'lead', 20), heldAgo('a', 'lead', 2), heldAgo('a', 'lead', 9)],
    });
    // 가장 최근이 2일 전이라 쿨다운에 걸린다. 20일 전을 봤다면 후보로 남았을 것이다
    expect(traceFor(result, 'lead').candidateIds).toEqual(['b']);
  });
});

// ─────────────────────────────────────────────────────────────
// 2주 시뮬레이션 (PRD §16 — 이끄미 경험 횟수 최대-최소 차이 1 이하)
//
// 시드를 고정하므로 결과가 매번 같다. 이유 없이 가끔 실패하는 검사가 아니다.
// 아래 숫자는 PRD §7 알고리즘 그대로의 실측값이다. 차이가 2가 되는 경우가
// 남아 있는 것은 PRD §7의 "완전 결정론적으로 만들지 말 것"과 맞바꾼 결과이고,
// 결과 화면의 '다시 뽑기'가 사람이 개입하는 보정 장치다.
// ─────────────────────────────────────────────────────────────

interface SimResult {
  leadCounts: number[];
  keeperCounts: number[];
}

function simulateDays(memberCount: number, days: number, rng: Rng): SimResult {
  const members = Array.from({ length: memberCount }, (_, i) => 'm' + (i + 1));
  const history: HistoryEntry[] = [];
  const leadCount = new Map(members.map((m) => [m, 0]));
  const keeperCount = new Map(members.map((m) => [m, 0]));

  for (let day = 0; day < days; day++) {
    const today = addDays('2026-03-02', day);
    const result = assign({ presentMemberIds: members, roles: ROLES, history, today, rng });

    for (const pick of result.picks) {
      history.push({ date: today, roleId: pick.roleId, memberId: pick.memberId });
      const counter = pick.roleId === 'lead' ? leadCount : keeperCount;
      counter.set(pick.memberId, (counter.get(pick.memberId) ?? 0) + 1);
    }
    // 실제 DB와 같게 그루도 기록에 넣는다. 가중치에는 영향이 없어야 한다
    for (const memberId of result.grooMemberIds) {
      history.push({ date: today, roleId: 'groo', memberId });
    }
  }

  return {
    leadCounts: members.map((m) => leadCount.get(m) ?? 0),
    keeperCounts: members.map((m) => keeperCount.get(m) ?? 0),
  };
}

const gapOf = (counts: number[]) => Math.max(...counts) - Math.min(...counts);

/** 시드 1..seedCount를 돌려 차이의 분포를 낸다 */
function gapDistribution(memberCount: number, days: number, seedCount: number) {
  const leadGaps: number[] = [];
  const keeperGaps: number[] = [];
  for (let seed = 1; seed <= seedCount; seed++) {
    const sim = simulateDays(memberCount, days, seededRng(seed));
    leadGaps.push(gapOf(sim.leadCounts));
    keeperGaps.push(gapOf(sim.keeperCounts));
  }
  return {
    leadGaps,
    leadWithin1: leadGaps.filter((gap) => gap <= 1).length,
    leadWorst: Math.max(...leadGaps),
    keeperWorst: Math.max(...keeperGaps),
  };
}

describe('12명 조 2주 시뮬레이션 (PRD §16)', () => {
  const SEEDS = 200;

  it('고정 시드에서 이끄미 횟수 최대-최소 차이가 1 이하다', () => {
    const sim = simulateDays(12, 14, seededRng(1));
    // 12명이 14일이면 10명은 1번, 2명은 2번 → 차이 1이 산수적 최선
    expect(gapOf(sim.leadCounts)).toBeLessThanOrEqual(1);
    expect(sim.leadCounts.reduce((a, b) => a + b, 0)).toBe(14);
  });

  it('시드 200개 중 195개 이상에서 차이가 1 이하다 (실측 199/200)', () => {
    expect(gapDistribution(12, 14, SEEDS).leadWithin1).toBeGreaterThanOrEqual(195);
  });

  it('어떤 시드에서도 차이가 2를 넘지 않는다 (실측 최악 2)', () => {
    const { leadWorst, keeperWorst } = gapDistribution(12, 14, SEEDS);
    expect(leadWorst).toBeLessThanOrEqual(2);
    expect(keeperWorst).toBeLessThanOrEqual(2);
  });

  it('2주 뒤 이끄미를 한 번도 못 해본 사람이 생기는 시드는 200개 중 2개 이하다 (실측 1개)', () => {
    // 12명 조는 14일에 14번만 뽑으므로 원리적으로 0번인 사람이 생길 수 있다.
    // 상한 12명이 배정 감각의 한계라는 PRD §11의 설명이 여기서 숫자로 확인된다.
    let seedsWithZero = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      if (Math.min(...simulateDays(12, 14, seededRng(seed)).leadCounts) === 0) seedsWithZero++;
    }
    expect(seedsWithZero).toBeLessThanOrEqual(2);
  });
});

describe('실제로 가장 많은 5명 조 · 7명 조 (알고리즘의 약점을 기록해둔다)', () => {
  const SEEDS = 200;

  it('5명 조 2주 — 200개 중 160개 이상에서 차이 1 이하 (실측 162/200, 최악 3)', () => {
    const { leadWithin1, leadWorst } = gapDistribution(5, 14, SEEDS);
    // 5명이 14일이면 4명은 3번, 1명은 2번 → 차이 1이 산수적 최선
    expect(leadWithin1).toBeGreaterThanOrEqual(160);
    expect(leadWorst).toBeLessThanOrEqual(3);
  });

  it('7명 조 2주 — 14일을 7명이 나누면 차이가 1인 결과는 존재할 수 없다', () => {
    // 합이 14이고 7명이므로 전원 2번(차이 0)이거나, 누군가 3번·누군가 1번(차이 2)이다.
    // "차이 1 이하"라는 기준이 7명에서는 곧 "완벽"과 같은 뜻이 된다
    const { leadGaps, leadWorst } = gapDistribution(7, 14, SEEDS);
    expect(leadGaps.every((gap) => gap === 0 || gap >= 2)).toBe(true);
    expect(leadWorst).toBeLessThanOrEqual(3);
  });

  it('11명 이하 조에서는 2주 뒤 0번인 사람이 단 한 번도 생기지 않는다 — PRD §1이 든 문제', () => {
    // "3주 동안 한 번도 이끄미를 안 해본 사람이 생긴다"가 이 서비스를 만든 이유다.
    // 3~11명 × 시드 200개 = 1800회 전부 통과한다
    for (let memberCount = 3; memberCount <= 11; memberCount++) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const sim = simulateDays(memberCount, 14, seededRng(seed));
        expect(Math.min(...sim.leadCounts)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

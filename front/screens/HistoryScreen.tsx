/**
 * S8. 지난 기록 — /t/[slug]/history (PRD §6 S8)
 *
 * 이 화면의 목적은 하나다 — **0이 보이는 것.**
 * 그래서 0회 칸만 다른 방식으로 그린다. 색을 옅게 칠하는 게 아니라
 * 점선 빈 칸으로 둔다. 채워진 칸들 사이에서 구멍처럼 보여야 한다.
 *
 * 나머지 칸은 그 열 안에서의 퍼짐으로 농도를 정한다 (shared/history.ts).
 * 색이 균일하면 고루 돌았고, 진하고 연한 것이 섞여 있으면 쏠렸다는 뜻이다.
 */

import { BackLink, Lede, Screen, Title, TopBar } from '@/front/ui/kit';
import { densityTiers, spread, type DensityTier } from '@/shared/history';
import { formatKstDateLabel } from '@/shared/date';
import { formatDuration } from '@/shared/timer';
import type { HistoryView, RoleView, TeamView } from '@/shared/types';

/** 역할 열의 색 계열. 이끄미는 라임, 시간지키미는 스카이 (PRD §13) */
const RAMPS: Record<string, string[]> = {
  lime: ['', 'bg-[#EEF9CE] text-lime-deep', 'bg-[#DEF4A0] text-lime-deep', 'bg-lime text-lime-deep'],
  sky: ['', 'bg-[#EAF5FF] text-sky-deep', 'bg-[#CDE8FF] text-sky-deep', 'bg-sky text-sky-deep'],
  // 그루는 뽑는 역할이 아니라 나머지다. 강조할 이유가 없다 (목업 09)
  plain: [
    '',
    'bg-rule-soft text-ink-35',
    'bg-rule-soft text-ink-35',
    'bg-rule-soft text-ink-35',
  ],
};

function rampFor(role: RoleView, index: number): string[] {
  if (role.isDefault) return RAMPS.plain;
  if (role.key === 'keeper' || index === 1) return RAMPS.sky;
  if (role.key === 'lead' || index === 0) return RAMPS.lime;
  return RAMPS.plain;
}

export default function HistoryScreen({
  team,
  history,
}: {
  team: TeamView;
  history: HistoryView;
}) {
  const { roles, rows, study, neverHeld } = history;

  // 열마다 농도를 따로 계산한다. 이끄미 3회와 그루 6회는 비교 대상이 아니다
  const tiersByRole = new Map<string, DensityTier[]>(
    roles.map((role) => [role.id, densityTiers(rows.map((row) => row.counts[role.id] ?? 0))]),
  );

  const leadRole = roles.find((role) => role.key === 'lead') ?? roles[0];
  const leadSpread = leadRole
    ? spread(rows.map((row) => row.counts[leadRole.id] ?? 0))
    : 0;

  const empty = history.recordedDays === 0;

  return (
    <Screen>
      <TopBar
        left={<BackLink href={`/t/${team.slug}`}>오늘의 역할</BackLink>}
        right={<span>이 조에서 {history.teamAgeDays}일</span>}
      />

      <Title>역할이 고루 돌았나</Title>
      <Lede>
        맡은 횟수를 보면 다음 뽑기가 왜 그렇게
        <br />
        나왔는지 알 수 있어요.
      </Lede>

      {empty ? (
        /* 빈 상태는 다음 행동을 권한다 (PRD §14, §17) */
        <div className="mt-4 rounded-[12px] border border-dashed border-[#D5D4CC] px-3 py-5 text-center">
          <p className="text-[13px] font-medium">아직 뽑은 기록이 없어요</p>
          <p className="mt-[6px] text-[11.5px] font-light leading-[1.6] text-ink-60">
            오늘 역할을 뽑으면 여기에 쌓입니다.
            <br />
            며칠 지나면 누가 덜 맡았는지가 보여요.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-[14px] text-[11.5px] font-medium text-ink-60">
            지난 {history.days}일 · 뽑은 날 {history.recordedDays}일
          </p>

          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className="pb-[6px] text-left" />
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="pb-[6px] text-center text-[10px] font-medium text-ink-60"
                  >
                    {role.emoji} {shortName(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.member.id}>
                  <td className="py-[3px] pr-[6px] text-left text-[12px] font-medium">
                    {row.member.name}
                  </td>
                  {roles.map((role, roleIndex) => {
                    const count = row.counts[role.id] ?? 0;
                    const tier = tiersByRole.get(role.id)?.[rowIndex] ?? 0;
                    return (
                      <td key={role.id} className="px-[2px] py-[3px] text-center">
                        <Cell count={count} tier={tier} ramp={rampFor(role, roleIndex)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/*
            안내 문장. 이 목록은 표(지난 14일)와 달리 **전체 기간** 기준이다.
            14일 안에만 0이고 그 전에 맡았다면 다음 뽑기에서 먼저 후보가 되지
            않으므로, 같은 기간으로 계산하면 이 문장이 거짓이 된다.
          */}
          {neverHeld.length > 0 ? (
            neverHeld.map((entry) => (
              <p
                key={entry.role.id}
                className="mt-[15px] border-l-2 border-lime py-[2px] pl-[11px] text-[11.5px] font-light leading-[1.65] text-ink-60"
              >
                <b className="font-semibold text-ink">
                  {entry.members.map((member) => member.name).join(', ')}
                </b>{' '}
                그루는 아직 {entry.role.emoji} {entry.role.name} 역할을 맡은 적이 없어요. 다음
                뽑기에서 먼저 후보로 올라갑니다.
              </p>
            ))
          ) : (
            <p className="mt-[15px] border-l-2 border-rule py-[2px] pl-[11px] text-[11.5px] font-light leading-[1.65] text-ink-60">
              모두 한 번씩은 맡아봤어요.
              {leadRole ? (
                <>
                  {' '}
                  이끄미 횟수 차이는 <b className="font-semibold text-ink">{leadSpread}</b>예요.
                </>
              ) : null}{' '}
              이제부터는 오래 안 맡은 그루가 먼저 후보가 됩니다.
            </p>
          )}

          <p className="mt-[13px] text-[11px] font-light leading-[1.6] text-ink-60">
            {study.studiedDays > 0 ? (
              <>
                하루 평균 학습{' '}
                <b className="font-mono font-medium text-ink">
                  {formatDuration(study.averageSec)}
                </b>
                {study.best ? (
                  <>
                    <br />
                    가장 많이 한 날{' '}
                    <b className="font-mono font-medium text-ink">{study.best.sessions}세션</b> ·{' '}
                    {formatKstDateLabel(study.best.date).replace(/ [월화수목금토일]요일$/, '')}
                  </>
                ) : null}
              </>
            ) : (
              '아직 타이머를 쓴 날이 없어요. 역할을 뽑고 타이머를 켜면 학습 시간이 쌓입니다.'
            )}
          </p>
        </>
      )}
    </Screen>
  );
}

/** 표 머리글은 좁다. '시간지키미'는 '지키미'로 줄인다 (목업 09) */
function shortName(role: RoleView): string {
  if (role.key === 'keeper') return '지키미';
  return role.name;
}

function Cell({ count, tier, ramp }: { count: number; tier: DensityTier; ramp: string[] }) {
  // 0회만 다른 방식으로 그린다. 색을 옅게 칠하면 다른 낮은 값과 섞여 안 보인다
  if (tier === 0) {
    return (
      <span className="grid place-items-center rounded-[6px] border border-dashed border-[#CFCEC6] py-[4px] font-mono text-[11.5px] font-semibold text-ink">
        0
      </span>
    );
  }
  return (
    <span
      className={[
        'grid place-items-center rounded-[6px] py-[5px] font-mono text-[11.5px] font-medium',
        ramp[tier],
      ].join(' ')}
    >
      {count}
    </span>
  );
}

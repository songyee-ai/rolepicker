'use client';

/**
 * S3. 조원 확인 (PRD §6 S3)
 *
 * 두 가지 상태가 있다.
 *
 * (1) 오늘 아직 안 뽑았다 — 참여/빈자리를 정하고 `역할 뽑기`
 * (2) 오늘 이미 뽑았다 — 이 화면은 채팅방 링크로는 뜨지 않는다.
 *     링크(`/t/[slug]`)를 열면 결과로 바로 간다 (PRD §6 S3).
 *     최근 목록에서 들어오거나 명단을 고치고 저장했을 때만 이 상태로 온다.
 *     주 버튼은 `오늘 결과 보기`이고, 빈자리를 고치면 그때 주 버튼이
 *     `다시 뽑기`로 바뀐다. 무심코 눌러서 남의 결과를 덮어쓰지 않게 하려는 것이다
 *     (PRD §16 — 조원 전원이 같은 결과를 본다).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  BackLink,
  FooterNote,
  Button,
  ButtonLink,
  CountRow,
  Notice,
  RoleLabel,
  Screen,
  StickyFooter,
  StickyHeader,
  Title,
  TopBar,
} from '@/front/ui/kit';
import LinkBanner from '@/front/ui/LinkBanner';
import { api, messageOf } from '@/front/lib/api';
import { rememberTeam } from '@/front/lib/recent-teams';
import { formatKstDateLabel, todayKst } from '@/shared/date';
import type { TeamView } from '@/shared/types';

/** 참여가 2명 미만이면 뽑을 수 없다 (PRD §6 S3) */
const MIN_PRESENT = 2;

const keyOf = (ids: Iterable<string>) => [...ids].sort().join(',');

export default function RosterScreen({ team }: { team: TeamView }) {
  const router = useRouter();
  const drawn = team.today;

  /**
   * 이미 뽑은 날이면 그날의 참여 상태를 그대로 가져온다.
   * 전원 참여로 초기화하면 화면이 오늘의 빈자리를 잊어버린다.
   */
  const baseline = useMemo(
    () =>
      drawn
        ? [...drawn.assigned.map((entry) => entry.member.id), ...drawn.groos.map((m) => m.id)]
        : team.members.map((member) => member.id),
    [drawn, team.members],
  );

  const [present, setPresent] = useState<Set<string>>(() => new Set(baseline));
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const absent = team.members.filter((member) => !present.has(member.id));
  const presentCount = present.size;
  const canDraw = presentCount >= MIN_PRESENT;

  /** 이미 뽑은 날에 빈자리를 건드렸는가 */
  const touched = drawn !== null && keyOf(present) !== keyOf(baseline);

  function toggle(memberId: string) {
    setPresent((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  /**
   * 먼저 서버에 배정을 요청하고, 응답을 받은 뒤 연출을 시작한다.
   * 연출은 결과를 만들지 않는다 (PRD §6 S4).
   */
  async function draw() {
    setError('');
    setWorking(true);
    try {
      const assignment = drawn
        ? await api.reroll(team.slug, [...present])
        : await api.assign(team.slug, [...present]);

      rememberTeam({
        slug: team.slug,
        lastUsedAt: todayKst(),
        lastLeadName: assignment.assigned[0]?.member.name ?? null,
        memberNames: team.members.map((member) => member.name),
      });

      router.push(`/t/${team.slug}/draw`);
    } catch (caught) {
      setError(messageOf(caught));
      setWorking(false);
    }
  }

  const leadName = drawn?.assigned.find((entry) => entry.role.key === 'lead')?.member.name ?? null;

  /**
   * 첫 화면의 최근 목록은 브라우저에만 있어서, 다른 사람이 다시 뽑으면
   * 내 목록의 이끄미 이름이 옛 값으로 남는다. 이 화면을 열 때 맞춰준다.
   */
  useEffect(() => {
    rememberTeam({
      slug: team.slug,
      lastUsedAt: todayKst(),
      lastLeadName: leadName,
      memberNames: team.members.map((member) => member.name),
    });
  }, [team.slug, team.members, leadName]);

  return (
    <Screen>
      <TopBar
        left={<BackLink href="/">처음으로</BackLink>}
        right={<span>{formatKstDateLabel(todayKst())}</span>}
      />

      {/* 만든 날에만 링크 배너를 띄운다. 이후에는 '명단 고치기' 하단에 상시 노출된다 */}
      {team.createdToday ? <LinkBanner slug={team.slug} code={team.code} /> : null}

      <Title>오늘 함께할 그루</Title>

      {/* 이미 뽑은 날이라는 것을 먼저 알린다 */}
      {drawn ? (
        <div className="mt-[10px] rounded-[12px] border border-rule bg-white px-[11px] py-[9px]">
          <p className="text-[11px] font-medium text-ink-60">오늘은 이미 뽑았어요</p>
          {leadName ? (
            <p className="mt-[5px] flex items-center gap-[6px]">
              <RoleLabel>🎯 이끄미</RoleLabel>
              <span className="text-[13px] font-semibold">{leadName}</span>
            </p>
          ) : null}
          <p className="mt-[6px] text-[10.5px] font-light leading-[1.5] text-ink-60">
            빈자리가 달라졌으면 아래에서 고치고 다시 뽑을 수 있어요.
          </p>
        </div>
      ) : null}

      <StickyHeader>
        <CountRow
          left={`참여 ${presentCount}명`}
          right={
            /* 빈자리는 인원수가 아니라 이름으로 (PRD §6 S3) */
            absent.length === 0 ? (
              <span className="font-light text-ink-35">빈자리 없음</span>
            ) : (
              <span>빈자리 · {absent.map((member) => member.name).join(', ')}</span>
            )
          }
        />
      </StickyHeader>

      <ul>
        {team.members.map((member) => {
          const here = present.has(member.id);
          return (
            <li
              key={member.id}
              className={[
                'mb-[5px] flex items-center gap-[9px] rounded-[11px] border px-[9px] py-2',
                here ? 'border-rule bg-paper' : 'border-dashed border-[#D5D4CC] bg-transparent',
              ].join(' ')}
            >
              <Avatar initial={member.initial} name={member.name} tone={here ? 'lead' : 'add'} />
              <span
                className={[
                  'flex-1 text-[13px] font-medium',
                  here ? '' : 'text-ink-35 line-through decoration-1',
                ].join(' ')}
              >
                {member.name}
              </span>
              <button
                type="button"
                onClick={() => toggle(member.id)}
                aria-pressed={here}
                className={[
                  'flex-none rounded-[7px] border px-[7px] py-[3px] text-[10.5px] font-medium',
                  here ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink-60',
                ].join(' ')}
              >
                {here ? '참여' : '빈자리'}
              </button>
            </li>
          );
        })}
      </ul>

      <Notice>{error}</Notice>

      <div className="mt-[13px]">
        <Link
          href={`/t/${team.slug}/members`}
          className="block w-full rounded-[12px] border border-rule px-3 py-[13px] text-center text-[13.5px] font-medium text-ink-60"
        >
          명단 고치기 · 지난 기록
        </Link>
      </div>

      <StickyFooter>
        {!canDraw ? (
          /* 회색으로만 만들지 말고 왜 못 누르는지 알린다 (PRD §14) */
          <FooterNote>
            참여가 {MIN_PRESENT}명부터 뽑을 수 있어요. 지금은 {presentCount}명이에요.
          </FooterNote>
        ) : null}

        {drawn === null ? (
          <Button onClick={draw} disabled={!canDraw || working}>
            {working ? '뽑고 있어요…' : '역할 뽑기'}
          </Button>
        ) : (
          <>
            {/*
              버튼 문구는 상태에 따라 바꾸지 않는다. 무엇이 달라졌는지는 이 한 줄이
              알리고, 버튼은 무슨 일이 일어나는지만 그대로 적는다 (PRD §17).
              '빈자리 반영'처럼 쓰면 전원 참여로 고친 경우에 말이 안 맞는다.
            */}
            {touched ? (
              <FooterNote>참여를 고쳤어요. 다시 뽑으면 반영돼요.</FooterNote>
            ) : null}

            {/* 고친 사람에게는 다시 뽑기가, 보러 온 사람에게는 결과 보기가 주 버튼이 된다 */}
            {touched ? (
              <>
                <Button onClick={draw} disabled={!canDraw || working}>
                  {working ? '다시 뽑고 있어요…' : '다시 뽑기'}
                </Button>
                <ButtonLink href={`/t/${team.slug}`} tone="quiet" className="mt-[6px]">
                  오늘 결과 보기
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href={`/t/${team.slug}`}>오늘 결과 보기</ButtonLink>
                <Button
                  tone="quiet"
                  className="mt-[6px]"
                  onClick={draw}
                  disabled={!canDraw || working}
                >
                  {working ? '다시 뽑고 있어요…' : '다시 뽑기'}
                </Button>
              </>
            )}
          </>
        )}
      </StickyFooter>
    </Screen>
  );
}

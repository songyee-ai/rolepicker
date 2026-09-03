'use client';

/**
 * S3. 조원 확인 — /t/[slug] (PRD §6 S3)
 *
 * 오늘 배정이 이미 있으면 이 화면은 뜨지 않는다. 서버가 결과 화면으로 보낸다.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  BlockedHint,
  Button,
  CountRow,
  Notice,
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

export default function RosterScreen({ team }: { team: TeamView }) {
  const router = useRouter();

  // 처음에는 전원 참여. 빈자리는 눌러서 표시한다
  const [present, setPresent] = useState<Set<string>>(
    () => new Set(team.members.map((member) => member.id)),
  );
  const [error, setError] = useState('');
  const [drawing, setDrawing] = useState(false);

  const absent = team.members.filter((member) => !present.has(member.id));
  const presentCount = present.size;
  const canDraw = presentCount >= MIN_PRESENT;

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
    setDrawing(true);
    try {
      const assignment = await api.assign(team.slug, [...present]);

      rememberTeam({
        slug: team.slug,
        lastUsedAt: todayKst(),
        lastLeadName: assignment.assigned[0]?.member.name ?? null,
        memberNames: team.members.map((member) => member.name),
      });

      router.push(`/t/${team.slug}/draw`);
    } catch (caught) {
      setError(messageOf(caught));
      setDrawing(false);
    }
  }

  return (
    <Screen>
      <TopBar left={formatKstDateLabel(todayKst())} />

      {/* 만든 날에만 링크 배너를 띄운다. 이후에는 '명단 고치기' 하단에 상시 노출된다 */}
      {team.createdToday ? <LinkBanner slug={team.slug} code={team.code} /> : null}

      <Title>오늘 함께할 그루</Title>

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
              <Avatar
                initial={member.initial}
                name={member.name}
                tone={here ? 'lead' : 'add'}
              />
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
                  here
                    ? 'border-ink bg-ink text-white'
                    : 'border-rule bg-white text-ink-60',
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
        {/* 회색으로만 만들지 말고 왜 못 누르는지 알린다 (PRD §14) */}
        {!canDraw ? (
          <BlockedHint>
            참여가 {MIN_PRESENT}명부터 뽑을 수 있어요. 지금은 {presentCount}명이에요.
          </BlockedHint>
        ) : null}
        <Button onClick={draw} disabled={!canDraw || drawing}>
          {drawing ? '뽑고 있어요…' : '역할 뽑기'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}

'use client';

/**
 * S5. 결과 — /t/[slug] (PRD §6 S5)
 *
 * 인원과 무관하게 한 화면에 들어간다. 4명 이상일 때 원형만 나열하는 전환이
 * 그걸 보장한다 (PRD §11).
 *
 * 다시 뽑기 횟수는 표시하지 않는다 (PRD §6 S5).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Avatar,
  BackLink,
  Button,
  ButtonLink,
  Notice,
  RoleLabel,
  Screen,
  Title,
  TopBar,
} from '@/front/ui/kit';
import ConfirmButton from '@/front/ui/ConfirmButton';
import { api, messageOf } from '@/front/lib/api';
import { rememberTeam } from '@/front/lib/recent-teams';
import { formatKstDateLabel, todayKst } from '@/shared/date';
import type { AssignmentView, MemberRef, TeamView } from '@/shared/types';

/** 원형 24px + 세 글자 이름이면 한 줄에 셋이 한계다 (PRD §6 S5) */
const NAMES_UP_TO = 3;

export default function ResultScreen({ team }: { team: TeamView & { today: AssignmentView } }) {
  const [assignment, setAssignment] = useState<AssignmentView>(team.today);
  const [error, setError] = useState('');
  const [rerolling, setRerolling] = useState(false);

  const presentIds = [
    ...assignment.assigned.map((entry) => entry.member.id),
    ...assignment.groos.map((member) => member.id),
  ];

  /**
   * A가 결과를 보는 동안 B가 다시 뽑는 일이 있다 (PRD §14).
   * 화면이 다시 보일 때와 창이 포커스를 얻을 때 조용히 재조회한다.
   * 실시간까지는 필요 없다.
   */
  const refresh = useCallback(async () => {
    try {
      const fresh = await api.getTeam(team.slug);
      if (fresh.today && fresh.today.updatedAt !== assignment.updatedAt) {
        setAssignment(fresh.today);
      }
    } catch {
      // 조용히 실패한다. 화면에 있는 결과는 그대로 쓸 수 있다
    }
  }, [team.slug, assignment.updatedAt]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  // 첫 화면의 최근 목록에 쓸 마지막 이끄미 이름을 갱신한다
  useEffect(() => {
    rememberTeam({
      slug: team.slug,
      lastUsedAt: todayKst(),
      lastLeadName: assignment.assigned[0]?.member.name ?? null,
      memberNames: team.members.map((member) => member.name),
    });
  }, [team.slug, team.members, assignment]);

  const leadName = assignment.assigned.find((entry) => entry.role.key === 'lead')?.member.name ?? null;
  /** 아직 정해지지 않은 역할이 있으면 지울 결과가 없다. 그때는 묻지 않는다 */
  const settled = assignment.unfilledRoles.length === 0;

  async function reroll() {
    setError('');
    setRerolling(true);
    try {
      setAssignment(await api.reroll(team.slug, presentIds));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setRerolling(false);
    }
  }

  return (
    <Screen>
      <TopBar
        left={<BackLink href="/">처음으로</BackLink>}
        right={<span>{formatKstDateLabel(assignment.date)}</span>}
      />
      <Title>오늘의 역할</Title>

      {assignment.assigned.map((entry) => (
        <section
          key={entry.role.id}
          className="mt-3 border-b border-rule pb-[10px] animate-fade-up"
        >
          {/* 역할명을 타이틀로 위에 둔다 (PRD §6 S5) */}
          <RoleLabel tone={entry.role.key === 'keeper' ? 'sky' : 'lime'}>
            {entry.role.emoji} {entry.role.name}
          </RoleLabel>

          <div className="mt-[5px] flex items-center gap-2">
            <Avatar
              initial={entry.member.initial}
              name={entry.member.name}
              tone={entry.role.key === 'keeper' ? 'keeper' : 'lead'}
              size={24}
            />
            <strong className="text-[21px] font-bold tracking-[-0.03em]">
              {entry.member.name}
            </strong>
          </div>

          <p className="mt-[6px] text-[11px] font-light leading-[1.5] text-ink-60">
            {entry.role.description}
          </p>
        </section>
      ))}

      {/* 사람이 부족해 비운 역할 (PRD §7) */}
      {assignment.unfilledRoles.map((role) => (
        <section key={role.id} className="mt-3 border-b border-rule pb-[10px]">
          <RoleLabel tone="rule">
            {role.emoji} {role.name}
          </RoleLabel>
          {/*
            비는 이유가 두 가지다. 참여 인원이 역할 수보다 적었거나 (PRD §7),
            뽑은 뒤에 그 역할을 맡은 그루가 명단에서 내려갔거나.
            원인을 단정하지 않고 다음 행동을 권한다 (PRD §17).
          */}
          <p className="mt-[5px] text-[12px] font-light text-ink-35">
            아직 정해지지 않았어요. 다시 뽑으면 채워져요.
          </p>
        </section>
      ))}

      <Lineup label="🙋 그루" members={assignment.groos} />

      <SectionLabel
        label="🪑 빈자리"
        note={countNote(assignment.absent.length)}
      />
      {/* 빈자리 줄과 버튼 사이 여백 18px (PRD §6 S5) */}
      <div className="mt-[7px] mb-[18px] grid grid-cols-[1fr_92px] items-center gap-2">
        <MemberRow members={assignment.absent} empty />
        {/* 빈자리가 0명이어도 이 줄은 사라지지 않는다 — 명단으로 돌아가는 길을 유지한다 */}
        <Link
          href={`/t/${team.slug}/members`}
          className="grid place-items-center whitespace-nowrap rounded-[10px] border border-rule bg-white py-2 text-[11.5px] font-medium text-ink-60"
        >
          명단 고치기
        </Link>
      </div>

      <Notice>{error}</Notice>

      <div className="mt-auto">
        {/*
          조원 한 명이 타이머를 켜면 다른 조원 화면의 버튼이 바뀐다.
          화면을 멋대로 옮기지는 않는다 — 결과를 보고 있는 사람을 갑자기
          어두운 시계 화면으로 끌고 가지 않는다. 대신 무슨 일이 벌어지고
          있는지 알려주고, 갈지 말지는 누르는 사람이 정한다 (PRD §17).
        */}
        {assignment.timer ? (
          <p className="mb-[6px] text-center text-[11px] font-light text-ink-60">
            지금 {assignment.timer.kind === 'study' ? '학습' : '쉬는 시간'}이
            {assignment.timer.paused ? ' 멈춰 있어요' : ' 흐르고 있어요'}
          </p>
        ) : null}
        <ButtonLink href={`/t/${team.slug}/timer`} tone="lime">
          {assignment.timer ? '타이머 보기' : '타이머 준비하기'}
        </ButtonLink>
        <div className="mt-[6px]">
          {settled ? (
            <ConfirmButton
              label="다시 뽑기"
              question={
                leadName
                  ? `지금 결과를 지우고 새로 뽑아요. 🎯 이끄미 ${leadName}도 바뀔 수 있어요.`
                  : '지금 결과를 지우고 새로 뽑아요.'
              }
              confirmLabel="네, 다시 뽑기"
              busy={rerolling}
              busyLabel="다시 뽑고 있어요…"
              onConfirm={reroll}
            />
          ) : (
            <Button tone="quiet" onClick={reroll} disabled={rerolling}>
              {rerolling ? '다시 뽑고 있어요…' : '다시 뽑기'}
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}

function countNote(count: number): string {
  return `${count}명`;
}

function SectionLabel({ label, note }: { label: string; note: string }) {
  return (
    <div className="mt-[11px] flex items-baseline justify-between">
      <RoleLabel tone="rule">{label}</RoleLabel>
      <span className="text-[10px] font-light text-ink-35">{note}</span>
    </div>
  );
}

function Lineup({ label, members }: { label: string; members: MemberRef[] }) {
  const many = members.length > NAMES_UP_TO;
  return (
    <>
      <SectionLabel
        label={label}
        note={many ? `${members.length}명 · 눌러서 이름 보기` : countNote(members.length)}
      />
      <MemberRow members={members} />
    </>
  );
}

/**
 * 3명까지는 원형+이름, 4명 이상이면 원형만 나열한다 (PRD §6 S5).
 * 원형만 나열할 때는 눌러서 이름을 볼 수 있어야 한다 — 이니셜이 같은
 * 동명이인을 구분할 방법이 그것뿐이다 (PRD §14).
 */
function MemberRow({ members, empty = false }: { members: MemberRef[]; empty?: boolean }) {
  const [revealed, setRevealed] = useState<MemberRef | null>(null);

  if (members.length === 0) {
    return (
      <div className="mt-[7px] flex items-center gap-[6px]">
        <Avatar initial="·" tone="gone" size={24} />
        <span className="text-[13px] font-light text-ink-35">없어요</span>
      </div>
    );
  }

  if (members.length <= NAMES_UP_TO) {
    return (
      <div className="mt-[7px] flex flex-wrap items-center gap-x-[13px] gap-y-2">
        {members.map((member) => (
          <span key={member.id} className="flex items-center gap-[6px]">
            <Avatar
              initial={member.initial}
              name={member.name}
              tone={empty ? 'gone' : 'muted'}
              size={24}
            />
            <span className="text-[13px] font-medium">{member.name}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-[7px]">
      <div className="flex flex-wrap gap-[5px]">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            aria-label={member.name}
            onClick={() => setRevealed((current) => (current?.id === member.id ? null : member))}
            className={[
              'grid h-[31px] w-[31px] place-items-center rounded-full text-[12px] font-semibold',
              empty
                ? 'border border-dashed border-[#CFCEC6] text-ink-35'
                : 'bg-[#EDECE5] text-ink-60',
              revealed?.id === member.id ? 'ring-2 ring-ink ring-offset-1' : '',
            ].join(' ')}
          >
            {member.initial}
          </button>
        ))}
      </div>
      <p className="mt-[6px] min-h-[16px] text-[11.5px] font-medium text-ink-60">
        {revealed ? revealed.name : ''}
      </p>
    </div>
  );
}

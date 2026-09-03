'use client';

/**
 * S0. 첫 화면 — / (PRD §6 S0)
 *
 * 같은 라우트에서 브라우저에 저장된 최근 목록 유무로 두 상태가 갈린다.
 * 최근 목록은 브라우저에만 있고 서버에 없으므로, 서버에서 미리 그릴 수 없다.
 * 그래서 목록을 읽기 전에는 '처음 온 사람' 화면을 보여주고, 읽은 뒤에
 * 목록이 있으면 그것을 위에 얹는다.
 *
 * 코드 입력칸은 항상 보인다. 시크릿 모드나 기기 변경이면 목록이 비어 있고,
 * 그때 남는 유일한 통로다 (PRD §14).
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, ButtonLink, Divider, Notice, Screen } from '@/front/ui/kit';
import { api, messageOf } from '@/front/lib/api';
import {
  recentTeamsServerSnapshot,
  recentTeamsSnapshot,
  subscribeRecentTeams,
} from '@/front/lib/recent-teams';
import { formatRoster, initialOf } from '@/shared/names';

const STEPS = [
  { n: '1', title: '조원 이름을 넣고 링크를 받아요', note: '조 채팅방에 한 번만 공유하면 끝' },
  { n: '2', title: '매일 링크를 열어 역할을 뽑아요', note: '어제 맡은 그루는 잘 안 뽑혀요' },
  { n: '3', title: '뽑고 나서 타이머를 켜요', note: '학습 40분, 쉬는시간 10분이 기본' },
];

export default function LandingScreen() {
  const router = useRouter();
  const recent = useSyncExternalStore(
    subscribeRecentTeams,
    recentTeamsSnapshot,
    recentTeamsServerSnapshot,
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false);

  async function enter() {
    setError('');
    if (code.trim().length === 0) {
      setError('코드를 넣어주세요. 조 화면 아래쪽에서 확인할 수 있어요.');
      return;
    }
    setEntering(true);
    try {
      const { slug } = await api.resolve(code);
      router.push(`/t/${slug}/check`);
    } catch (caught) {
      setError(messageOf(caught));
      setEntering(false);
    }
  }

  const hasRecent = recent.length > 0;

  return (
    <Screen>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-ink-35">
        <span className="rounded-[5px] bg-lime px-[7px] py-[2px] font-sans text-[11px] font-semibold text-lime-deep">
          그루뽑기
        </span>
      </div>

      {hasRecent ? (
        <>
          <h1 className="mt-[11px] text-[20px] font-bold leading-[1.28] tracking-[-0.03em]">
            다시 오셨네요
          </h1>

          <p className="mb-[6px] mt-[14px] text-[11.5px] font-medium text-ink-60">최근 사용한 조</p>

          <ul>
            {recent.map((team, index) => (
              <li key={team.slug}>
                <Link
                  href={`/t/${team.slug}/check`}
                  className={[
                    'mb-[6px] flex items-center gap-[9px] rounded-[11px] bg-white px-[10px] py-[9px]',
                    index === 0 ? 'border-[1.5px] border-ink' : 'border border-rule',
                  ].join(' ')}
                >
                  <Avatar
                    initial={team.lastLeadName ? initialOf(team.lastLeadName) : '·'}
                    name={team.lastLeadName ?? undefined}
                    tone={index === 0 ? 'lead' : 'add'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[5px] text-[13px] font-semibold">
                      {team.lastLeadName ?? '아직 안 뽑았어요'}
                      {team.lastLeadName ? (
                        <i className="text-[10px] not-italic text-ink-35">🎯 이끄미</i>
                      ) : null}
                    </span>
                    <span className="mt-[2px] block overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-light text-ink-60">
                      {formatRoster(team.memberNames)}
                    </span>
                  </span>
                  <span className="flex-none font-mono text-[10px] text-ink-35">
                    {team.lastUsedAt.slice(5).replace('-', '월 ')}일
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* 굵은 이름이 무엇인지 알려준다 (PRD §6 S0) */}
          <p className="pt-[7px] text-[10.5px] font-light leading-[1.55] text-ink-60">
            굵은 이름은 <b className="font-semibold text-ink">마지막에 이끄미를 맡은 그루</b>예요.
            <br />
            아랫줄 조원 이름으로 내 조를 확인하세요.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-[24px] font-bold leading-[1.28] tracking-[-0.03em]">
            오늘 누가
            <br />
            이끄미인가
          </h1>
          <p className="mt-2 text-[12px] font-light leading-[1.6] text-ink-60">
            이끄미와 시간지키미를 뽑고,
            <br />
            바로 학습 타이머까지 이어져요.
          </p>

          <div className="mt-4">
            {STEPS.map((step, index) => (
              <div
                key={step.n}
                className={[
                  'flex items-start gap-[9px] border-t border-rule py-[7px]',
                  index === STEPS.length - 1 ? 'border-b' : '',
                ].join(' ')}
              >
                <b className="flex-none pt-px font-mono text-[11px] font-semibold text-lime-deep">
                  {step.n}
                </b>
                <p className="text-[11.5px] leading-[1.5]">
                  {step.title}
                  <em className="block text-[11px] font-light not-italic text-ink-60">
                    {step.note}
                  </em>
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <Divider>다른 조로 들어가기</Divider>

      <div className="flex gap-[6px]">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void enter();
          }}
          placeholder="MANGO-7B2C9F"
          aria-label="조 코드"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-[10px] border border-rule bg-white p-[10px] font-mono text-[13px] font-medium uppercase tracking-[0.04em] outline-none placeholder:text-ink-35"
        />
        <button
          type="button"
          onClick={enter}
          disabled={entering}
          className="flex-none rounded-[10px] border border-ink bg-white px-[13px] py-[10px] text-[12.5px] font-semibold disabled:opacity-45"
        >
          {entering ? '찾는 중' : '들어가기'}
        </button>
      </div>

      <Notice>{error}</Notice>

      <div className="mt-auto pt-4">
        {hasRecent ? (
          <>
            <ButtonLink href={`/t/${recent[0].slug}/check`}>
              {recent[0].lastLeadName ? `${recent[0].lastLeadName} 그루의 조 열기` : '최근 조 열기'}
            </ButtonLink>
            <ButtonLink href="/new" tone="quiet" className="mt-[6px]">
              새 조 만들기
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/new" tone="lime">
            새 조 만들기
          </ButtonLink>
        )}
      </div>
    </Screen>
  );
}

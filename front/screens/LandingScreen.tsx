'use client';

/**
 * S0. 첫 화면 — / (PRD §6 S0)
 *
 * 같은 라우트에서 브라우저에 저장된 최근 목록 유무로 두 상태가 갈린다.
 * 최근 목록은 브라우저에만 있고 서버에 없으므로 서버에서 미리 그릴 수 없다.
 * useSyncExternalStore 로 읽어서, 화면을 이어받은 뒤에 목록이 나타난다.
 *
 * 목록은 눌러도 바로 이동하지 않는다. 고른 다음 하단 버튼으로 연다.
 * 그래야 굵은 테두리와 원형 색이 "지금 고른 조"라는 뜻을 갖고,
 * 잘못 눌러서 남의 조로 들어가는 일도 없다.
 *
 * 코드 입력칸은 항상 보인다. 시크릿 모드나 기기 변경이면 목록이 비어 있고,
 * 그때 남는 유일한 통로다 (PRD §14).
 */

import { useState, useSyncExternalStore } from 'react';
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

  // 아무것도 안 골랐으면 가장 최근에 쓴 조가 골라져 있다
  const [picked, setPicked] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false);

  const hasRecent = recent.length > 0;
  const selectedSlug = picked ?? recent[0]?.slug ?? null;
  const selected = recent.find((team) => team.slug === selectedSlug) ?? null;

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

  return (
    <Screen>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-[5px] bg-lime px-[7px] py-[2px] text-[11px] font-semibold text-lime-deep">
          그루뽑기
        </span>
      </div>

      {hasRecent ? (
        <>
          <h1 className="mt-[11px] text-[20px] font-bold leading-[1.28] tracking-[-0.03em]">
            다시 오셨네요
          </h1>

          <p className="mb-[6px] mt-[14px] text-[11.5px] font-medium text-ink-60">어느 조인가요</p>

          <div role="radiogroup" aria-label="최근 사용한 조">
            {recent.map((team) => {
              const isSelected = team.slug === selectedSlug;
              return (
                <button
                  key={team.slug}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setPicked(team.slug)}
                  className={[
                    'mb-[6px] flex w-full items-center gap-[9px] rounded-[11px] bg-white px-[10px] py-[9px] text-left',
                    isSelected ? 'border-[1.5px] border-ink' : 'border border-rule',
                  ].join(' ')}
                >
                  {/* 원형 색은 '지금 고른 조'를 뜻한다. 목록 순서와는 상관이 없다 */}
                  <Avatar
                    initial={team.lastLeadName ? initialOf(team.lastLeadName) : '·'}
                    name={team.lastLeadName ?? undefined}
                    tone={isSelected ? 'lead' : 'add'}
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
                </button>
              );
            })}
          </div>

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
        {selected ? (
          <>
            <ButtonLink href={`/t/${selected.slug}/check`}>
              {selected.lastLeadName ? `${selected.lastLeadName} 그루의 조 열기` : '이 조 열기'}
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

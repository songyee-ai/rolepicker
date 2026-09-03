'use client';

/**
 * S4. 뽑는 순간 — /t/[slug]/draw (PRD §6 S4)
 *
 * 결과는 이 화면에 오기 전에 서버에서 이미 확정됐다. 연출은 연출만 맡는다.
 * 그래서 연출 중에 이탈해도 결과는 남아 있다.
 *
 * 버튼이 없다. 자동으로 결과로 넘어가고, 화면 아무 곳이나 누르면 즉시 넘어간다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Screen, TopBar } from '@/front/ui/kit';
import { GROUND_RULES } from '@/shared/content';

/** 카드 뒤집기 약 2.5~3초 (PRD §6 S4) */
const STEPS = [
  { at: 0, caption: '오늘의 역할을 뽑고 있어요' },
  { at: 900, caption: '이끄미가 정해졌어요', reveal: 1 },
  { at: 1900, caption: '시간지키미도 정해졌어요', reveal: 2 },
] as const;

const FINISH_AT = 2800;

export default function DrawScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const done = useRef(false);

  const goToResult = useCallback(() => {
    if (done.current) return;
    done.current = true;
    // 뒤로 가기로 이 연출을 다시 보게 되면 이상하다. 그래서 replace
    router.replace(`/t/${slug}`);
  }, [router, slug]);

  useEffect(() => {
    // 움직임을 원하지 않는 사용자에게는 연출을 생략하고 바로 결과로 (PRD §6 S4)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      goToResult();
      return;
    }

    const timers = STEPS.slice(1).map((entry, index) =>
      window.setTimeout(() => setStep(index + 1), entry.at),
    );
    timers.push(window.setTimeout(goToResult, FINISH_AT));

    return () => timers.forEach(window.clearTimeout);
  }, [goToResult]);

  const current = STEPS[step];
  const revealed = 'reveal' in current ? current.reveal : 0;

  return (
    <div
      onClick={goToResult}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') goToResult();
      }}
      role="button"
      tabIndex={0}
      aria-label="눌러서 결과 보기"
      className="cursor-pointer"
    >
      <Screen>
        <TopBar left="뽑는 중" />

        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <div className="flex items-end gap-[5px]" aria-hidden>
            <CardBack />
            {revealed >= 1 ? <CardFront emoji="🎯" /> : <CardBack />}
            {revealed >= 2 ? <CardFront emoji="⏱️" /> : <CardBack />}
            <CardBack />
          </div>
          <p aria-live="polite" className="text-[12.5px] text-ink-60">
            {current.caption}
          </p>
        </div>

        {/* 뽑는 동안 읽어두면 좋은 것 (PRD §4 그라운드 룰) */}
        <section className="mt-auto rounded-[13px] border border-rule bg-paper px-3 py-[11px]">
          <strong className="block text-[11.5px] font-semibold">뽑는 동안 읽어두면 좋은 것</strong>
          <ul className="mt-2 border-t border-rule">
            {GROUND_RULES.map((rule) => (
              <li
                key={rule}
                className="relative border-b border-rule py-[6px] pl-[13px] text-[11.5px] font-light leading-[1.5] text-ink-60 last:border-b-0"
              >
                <span className="absolute left-0 top-[12px] h-[5px] w-[5px] rounded-full bg-lime" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <p className="px-0 pb-[2px] pt-[11px] text-center text-[10.5px] font-light text-ink-35">
          화면을 누르면 바로 결과로 넘어가요
        </p>
      </Screen>
    </div>
  );
}

function CardBack() {
  return (
    <span className="h-[54px] w-[37px] rounded-[7px] border border-[#0E1520] bg-ink p-0">
      <span
        className="block h-full w-full rounded-[6px]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(199,240,74,.28) 5px 6px)',
        }}
      />
    </span>
  );
}

function CardFront({ emoji }: { emoji: string }) {
  return (
    <span
      className="animate-card-pop grid h-[64px] w-[44px] place-items-center rounded-[7px] border border-lime bg-lime text-[19px]"
      style={{ boxShadow: '0 8px 18px -8px rgba(94,122,0,.6)' }}
    >
      {emoji}
    </span>
  );
}

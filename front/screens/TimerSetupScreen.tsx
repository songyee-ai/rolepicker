'use client';

/**
 * S6. 타이머 준비 — /t/[slug]/timer (PRD §6 S6)
 *
 * 세션 합계 문장("40분씩 네 세션이면…")은 넣지 않는다. 세션 수를 사용자가
 * 정한 적이 없는데 임의로 가정한 문장이었다 (PRD §6 S6).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BackLink,
  Button,
  FooterNote,
  Lede,
  Notice,
  Screen,
  Title,
  TopBar,
} from '@/front/ui/kit';
import { api, messageOf } from '@/front/lib/api';
import { requestNotifyPermission, unlockAudio } from '@/front/lib/alarm';
import {
  BREAK_DEFAULT,
  BREAK_MAX,
  BREAK_MIN,
  BREAK_PRESETS,
  clampMinutes,
  LONG_STUDY_MINUTES,
  STEP_MINUTES,
  stepMinutes,
  STUDY_DEFAULT,
  STUDY_MAX,
  STUDY_MIN,
  STUDY_PRESETS,
  type SessionKind,
} from '@/shared/timer';
import type { TeamView, TimerPlan } from '@/shared/types';

export default function TimerSetupScreen({
  team,
  plan,
}: {
  team: TeamView;
  /** 오늘 이미 정해둔 약속이 있으면 그 값에서 시작한다 */
  plan: TimerPlan | null;
}) {
  const router = useRouter();
  const [study, setStudy] = useState(plan ? Math.round(plan.studySec / 60) : STUDY_DEFAULT);
  const [rest, setRest] = useState(plan ? Math.round(plan.breakSec / 60) : BREAK_DEFAULT);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const keeper =
    team.today?.assigned.find((entry) => entry.role.key === 'keeper')?.member.name ?? null;

  async function start() {
    setError('');
    setStarting(true);

    /*
      알림 권한은 이 순간에 요청한다. 진입 즉시 요청하면 대부분 거부한다 (PRD §14).
      소리도 지금 준비해둔다 — 사용자 제스처 없이는 재생이 막힌다.
    */
    await requestNotifyPermission();
    unlockAudio();

    try {
      await api.startTimerSession(team.slug, 'study', {
        studySec: study * 60,
        breakSec: rest * 60,
      });
      router.push(`/t/${team.slug}/timer/run`);
    } catch (caught) {
      setError(messageOf(caught));
      setStarting(false);
    }
  }

  return (
    <Screen>
      <TopBar
        left={<BackLink href={`/t/${team.slug}`}>오늘의 역할</BackLink>}
        right={<span>{keeper ? `⏱️ 시간지키미 · ${keeper}` : '타이머 준비'}</span>}
      />

      <Title>학습 시간 정하기</Title>
      <Lede>조원과 이야기하고 정해주세요.</Lede>

      <div className="mt-[13px]">
        <Dial
          label="학습 시간"
          range={`${STUDY_MIN}~${STUDY_MAX}분`}
          minutes={study}
          onChange={setStudy}
          presets={STUDY_PRESETS}
          kind="study"
          highlighted
        />
        <Dial
          label="쉬는 시간"
          range={`${BREAK_MIN}~${BREAK_MAX}분`}
          minutes={rest}
          onChange={setRest}
          presets={BREAK_PRESETS}
          kind="break"
        />
      </div>

      <Notice>{error}</Notice>

      <div className="mt-auto pt-4">
        {/*
          ± 버튼에 작은 글씨를 붙이지 않는다. 시작 버튼 바로 위 한 줄로 둔다 (PRD §6 S6).
          학습 시간이 길면 그 자리에 다른 안내를 넣는다. 막지는 않는다.
        */}
        {study > LONG_STUDY_MINUTES ? (
          <FooterNote>집중이 잘 되는 구간은 30~40분입니다.</FooterNote>
        ) : (
          <p className="mb-[11px] flex items-start gap-[7px] text-[11.5px] font-light leading-[1.6] text-ink-60">
            <em className="mt-px flex-none rounded-[5px] bg-rule-soft px-[5px] font-mono text-[11px] font-semibold not-italic text-ink">
              − +
            </em>
            <span>
              <b className="font-semibold text-ink">{STEP_MINUTES}분 단위</b>로 조정할 수 있어요.
              위 숫자를 눌러 바로 골라도 돼요.
            </span>
          </p>
        )}

        <Button onClick={start} disabled={starting}>
          {starting ? '시작하고 있어요…' : '시작'}
        </Button>
      </div>
    </Screen>
  );
}

function Dial({
  label,
  range,
  minutes,
  onChange,
  presets,
  kind,
  highlighted = false,
}: {
  label: string;
  range: string;
  minutes: number;
  onChange: (next: number) => void;
  presets: readonly number[];
  kind: SessionKind;
  highlighted?: boolean;
}) {
  return (
    <section
      className={[
        'mb-2 rounded-[13px] bg-paper px-3 py-[11px]',
        highlighted ? 'border-[1.5px] border-ink' : 'border border-rule',
      ].join(' ')}
    >
      <p className="flex items-baseline justify-between text-[11px] font-medium text-ink-60">
        {label}
        <em className="text-[10px] font-light not-italic text-ink-35">{range}</em>
      </p>

      <div className="mt-[5px] flex items-center justify-between">
        <Knob label={`${label} 5분 줄이기`} onClick={() => onChange(stepMinutes(minutes, -1, kind))}>
          −
        </Knob>
        <p className="font-mono text-[25px] font-semibold tracking-[-0.02em]">
          {minutes}
          <em className="ml-[3px] font-sans text-[12px] font-medium not-italic text-ink-60">분</em>
        </p>
        <Knob label={`${label} 5분 늘리기`} onClick={() => onChange(stepMinutes(minutes, 1, kind))}>
          +
        </Knob>
      </div>

      <div className="mt-2 flex gap-1">
        {presets.map((preset) => {
          const on = preset === minutes;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(clampMinutes(preset, kind))}
              aria-pressed={on}
              className={[
                'flex-1 rounded-[6px] border py-1 text-center font-mono text-[11px] font-medium',
                on
                  ? kind === 'break'
                    ? 'border-sky bg-sky text-sky-deep'
                    : 'border-lime bg-lime text-lime-deep'
                  : 'border-rule bg-white text-ink-60',
              ].join(' ')}
            >
              {preset}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Knob({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-[29px] w-[29px] place-items-center rounded-[8px] border border-rule bg-white text-[15px] text-ink-60"
    >
      {children}
    </button>
  );
}

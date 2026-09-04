'use client';

/**
 * S6. 타이머 준비 — /t/[slug]/timer (PRD §6 S6)
 *
 * 세션 합계 문장("40분씩 네 세션이면…")은 넣지 않는다. 세션 수를 사용자가
 * 정한 적이 없는데 임의로 가정한 문장이었다 (PRD §6 S6).
 *
 * 두 가지 상태가 있다.
 *   (1) 아직 안 켰다 — `시작`을 누르면 약속을 저장하고 학습을 시작한다
 *   (2) 돌아가는 중에 길이를 바꾸러 왔다 (?edit=1) — 지금 돌아가는 세션에도
 *       바로 적용한다. 남은 시간이 그대로면 안 먹힌 것처럼 보인다.
 *       그래서 버튼 문구도 `시작`이 아니라 `지금부터 적용`이다
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink, Button, FooterNote, Lede, Notice, Screen, Title, TopBar } from '@/front/ui/kit';
import { api, messageOf } from '@/front/lib/api';
import { requestNotifyPermission, unlockAudio } from '@/front/lib/alarm';
import { useTimerWatch } from '@/front/lib/use-timer-watch';
import {
  BREAK_DEFAULT,
  BREAK_MAX,
  BREAK_MIN,
  BREAK_PRESETS,
  clampMinutes,
  remainingSec,
  LONG_STUDY_MINUTES,
  STEP_MINUTES,
  stepMinutes,
  STUDY_DEFAULT,
  STUDY_MAX,
  STUDY_MIN,
  STUDY_PRESETS,
  type SessionKind,
} from '@/shared/timer';
import type { TeamView, TimerStateView } from '@/shared/types';

export default function TimerSetupScreen({ team, state }: { team: TeamView; state: TimerStateView }) {
  const plan = state.plan;
  const current = state.current;
  /** 지금 타이머가 돌아가는 중인가 (길이만 바꾸러 온 경우) */
  const running = current !== null;

  /** 지금 단계가 얼마나 지났나. 줄여서 바로 끝나는 경우를 미리 알려주려고 쓴다 */
  const elapsedMin = current
    ? Math.floor((current.plannedSec - remainingSec(current, Date.parse(state.serverNow))) / 60)
    : 0;
  const router = useRouter();
  const [study, setStudy] = useState(plan ? Math.round(plan.studySec / 60) : STUDY_DEFAULT);
  const [rest, setRest] = useState(plan ? Math.round(plan.breakSec / 60) : BREAK_DEFAULT);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  /** 이미 지난 시간보다 짧게 바꾸려는가 */
  const shortened =
    current !== null &&
    (current.kind === 'study' ? study : rest) * 60 <= current.plannedSec - remainingSec(current, Date.parse(state.serverNow));

  // 이 화면에서 기다리는 동안 다른 조원이 켜면 함께 옮겨간다
  useTimerWatch({ slug: team.slug, runningAtLoad: running, enabled: Boolean(team.today) });

  const keeper =
    team.today?.assigned.find((entry) => entry.role.key === 'keeper')?.member.name ?? null;

  async function submit() {
    setError('');
    setWorking(true);

    try {
      if (running) {
        // 지금 돌아가는 세션에도 바로 적용된다
        await api.saveTimerPlan(team.slug, { studySec: study * 60, breakSec: rest * 60 });
      } else {
        /*
          알림 권한은 이 순간에 요청한다. 진입 즉시 요청하면 대부분 거부한다 (PRD §14).
          소리도 지금 준비해둔다 — 사용자 제스처 없이는 재생이 막힌다.
        */
        await requestNotifyPermission();
        unlockAudio();
        await api.startTimerSession(team.slug, 'study', {
          studySec: study * 60,
          breakSec: rest * 60,
        });
      }
      router.push(`/t/${team.slug}/timer/run`);
    } catch (caught) {
      setError(messageOf(caught));
      setWorking(false);
    }
  }

  return (
    <Screen>
      <TopBar
        left={<BackLink href={running ? `/t/${team.slug}/timer/run` : `/t/${team.slug}`}>
          {running ? '타이머로' : '오늘의 역할'}
        </BackLink>}
        right={<span>{keeper ? `⏱️ 시간지키미 · ${keeper}` : '타이머 준비'}</span>}
      />

      <Title>{running ? '시간 다시 정하기' : '학습 시간 정하기'}</Title>
      <Lede>
        {running
          ? `지금 ${current.kind === 'study' ? '학습' : '쉬는 시간'}이 ${elapsedMin}분 지났어요. 바꾸면 바로 적용돼요.`
          : '조원과 이야기하고 정해주세요.'}
      </Lede>

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

        {/*
          다이얼 쓰는 방법을 설명하는 줄이므로 다이얼 바로 밑에 둔다.
          PRD §6 S6이 정한 것은 "± 버튼에 작은 글씨를 붙이지 않는다"이고,
          박스 아래 한 줄은 그 조건을 지킨다.
          학습 시간이 길면 이 자리가 안내로 바뀐다. 막지는 않는다.
        */}
        {study > LONG_STUDY_MINUTES ? (
          <p className="mt-[6px] px-[2px] text-[11.5px] font-light leading-[1.6] text-warn">
            집중이 잘 되는 구간은 30~40분입니다.
          </p>
        ) : (
          <p className="mt-[6px] flex items-start gap-[7px] px-[2px] text-[11.5px] font-light leading-[1.6] text-ink-60">
            <em className="mt-px flex-none rounded-[5px] bg-rule-soft px-[5px] font-mono text-[11px] font-semibold not-italic text-ink">
              − +
            </em>
            <span>
              <b className="font-semibold text-ink">{STEP_MINUTES}분 단위</b>로 조정할 수 있어요.
              위 숫자를 눌러 바로 골라도 돼요.
            </span>
          </p>
        )}
      </div>

      <Notice>{error}</Notice>

      <div className="mt-auto pt-4">
        {/*
          줄이면 이번 단계가 곧바로 끝나는 경우가 있다. 누르기 전에 알려준다.
          "왜 갑자기 쉬는 시간이 됐지"를 겪게 하면 안 된다 (PRD §17).
        */}
        {running && shortened ? (
          <p className="mb-2 rounded-[10px] bg-warn-bg px-[10px] py-2 text-[11.5px] leading-[1.55] text-warn">
            이미 {elapsedMin}분 지났어요. {current.kind === 'study' ? study : rest}분으로 줄이면
            이번 {current.kind === 'study' ? '학습' : '쉬는 시간'}은 바로 끝나요.
          </p>
        ) : null}

        {/*
          버튼 바로 위는 누르기 직전 마지막으로 읽는 자리다.
          누가 눌러야 하는지를 키컬러 말풍선으로 적어, 누르기 전에 한 번 읽게 한다.
          이름을 넣는다 — "시간지키미가 누르세요"는 규칙이고 "이하늘 그루가
          누르세요"는 지시다. 화상 통화 중이면 후자가 바로 움직이게 만든다.
        */}
        {!running ? (
          keeper ? (
            <div className="relative mb-[11px] rounded-[12px] bg-lime px-3 py-[10px] text-center">
              <p className="text-[10.5px] font-semibold tracking-[0.02em] text-lime-deep/75">
                ⏱️ 오늘의 시간지키미
              </p>
              <p className="mt-[2px] text-[14px] font-bold leading-[1.4] tracking-[-0.02em] text-lime-deep">
                {keeper} 그루가 눌러주세요
              </p>
              {/* 말풍선 꼬리. 바로 아래 버튼을 가리킨다 */}
              <span
                aria-hidden
                className="absolute left-1/2 top-full -ml-[7px] h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-lime"
              />
            </div>
          ) : (
            <FooterNote>시간을 정하고 눌러주세요.</FooterNote>
          )
        ) : null}

        <Button onClick={submit} disabled={working}>
          {working
            ? running
              ? '바꾸는 중이에요…'
              : '시작하고 있어요…'
            : running
              ? '지금부터 적용'
              : '시작'}
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

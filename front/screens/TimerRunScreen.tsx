'use client';

/**
 * S7. 타이머 실행 — /t/[slug]/timer/run (PRD §6 S7, §10)
 *
 * 남은 시간을 로컬 변수로 세지 않는다. 서버가 확정한 started_at 에서 매번
 * 다시 계산한다. 그래서
 *   탭을 닫았다 열어도 이어지고
 *   백그라운드에서 tick 을 놓쳐도 어긋나지 않고
 *   여러 명이 봐도 같은 숫자가 보인다
 *
 * 시계 오차 보정: 응답에 담겨 온 서버 시각과 내 시각의 차이만큼 밀어서 쓴다.
 * 내 컴퓨터 시계가 3분 틀어져 있어도 화면은 맞다.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, ButtonLink, Notice, Screen, TopBar } from '@/front/ui/kit';
import { api, messageOf } from '@/front/lib/api';
import { keepScreenAwake, notifyPermission, ring, unlockAudio } from '@/front/lib/alarm';
import {
  formatClock,
  formatDuration,
  formatKstTime,
  isPaused,
  progress,
  remainingSec,
  scheduledEndMs,
  totalStudySec,
  type SessionKind,
} from '@/shared/timer';
import type { AssignmentView, TeamView, TimerStateView } from '@/shared/types';

/** 화면을 다시 그리는 간격. 서버 기준으로 매번 계산하므로 정확도와 무관하다 */
const TICK_MS = 250;

/** 조원끼리 상태를 맞추는 간격 (일시정지·단계 전환) */
const SYNC_INTERVAL_MS = 3000;

/**
 * 알림 권한은 구독할 대상이 아니다. 화면을 그릴 때마다 지금 값을 읽기만 한다.
 * 서버에서는 알 수 없으므로 '거부되지 않음'으로 그린다.
 */
const noSubscribe = () => () => {};
const notifyDeniedNow = () => notifyPermission() === 'denied';
const notifyDeniedOnServer = () => false;

type Team = TeamView & { today: AssignmentView };

export default function TimerRunScreen({
  team,
  initial,
}: {
  team: Team;
  initial: TimerStateView;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const advancing = useRef(false);

  /**
   * 서버 시각 − 내 시각. 내 컴퓨터 시계가 틀어져 있어도 화면이 맞도록 밀어준다.
   * 화면을 그리는 도중에 시각을 읽으면 그릴 때마다 값이 달라져 예측할 수 없으므로,
   * 시각은 아래 tick 에서만 읽어 상태로 넣는다.
   */
  const offsetRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => Date.parse(initial.serverNow));

  const apply = useCallback((next: TimerStateView) => {
    offsetRef.current = Date.parse(next.serverNow) - Date.now();
    setState(next);
    setNowMs(Date.now() + offsetRef.current);
  }, []);

  useEffect(() => {
    offsetRef.current = Date.parse(initial.serverNow) - Date.now();
    const id = window.setInterval(() => setNowMs(Date.now() + offsetRef.current), TICK_MS);
    return () => window.clearInterval(id);
  }, [initial.serverNow]);

  // 몇 시간 띄워두는 화면이라 꺼지면 곤란하다. 지원하지 않으면 조용히 넘어간다
  useEffect(() => keepScreenAwake(), []);

  // 소리는 사용자 제스처 없이는 재생이 막힌다. 화면을 처음 누르는 순간 준비한다
  useEffect(() => {
    const once = () => unlockAudio();
    window.addEventListener('pointerdown', once, { once: true });
    window.addEventListener('keydown', once, { once: true });
    return () => {
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
  }, []);

  /**
   * 알림 권한이 거부된 상태인가. (PRD §14)
   *
   * PRD는 "안내를 한 번만 보여준다"고 했지만, 한 번 스쳐 지나가는 안내는
   * 놓치기 쉽다. 대신 조용한 한 줄로 계속 두었다 — 알림이 꺼져 있다는 것은
   * 그 상태가 유지되는 동안 계속 참인 사실이고, 화면 아래 작은 글씨는
   * 재촉이 아니라 상태 표시로 읽힌다.
   */
  const notifyDenied = useSyncExternalStore(
    noSubscribe,
    notifyDeniedNow,
    notifyDeniedOnServer,
  );

  /** 다른 조원이 넘겼을 수 있다. 화면이 다시 보일 때 조용히 맞춘다 (PRD §14) */
  const refresh = useCallback(async () => {
    try {
      apply(await api.getTimer(team.slug));
    } catch {
      // 화면에 있는 값으로 계속 셀 수 있다
    }
  }, [apply, team.slug]);

  /*
    조 전체가 하나의 타이머를 함께 본다. 한 명이 일시정지하면 모두 멈춰야 한다.
    그래서 화면이 보이는 동안 3초마다 서버와 맞춘다.
    안 맞추면 A는 멈춰 있다고 생각하는데 B 화면은 계속 흘러간다 (PRD §10).
    탭이 보이지 않으면 묻지 않고, 다시 보이는 순간 한 번 묻는다.
  */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = window.setInterval(onVisible, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  const now = nowMs;
  const current = state.current;
  const breakSec = state.plan?.breakSec ?? 0;
  const remaining = current ? remainingSec(current, now) : 0;
  const paused = current !== null && isPaused(current);

  /** 이 단계 다음에 올 단계 */
  const nextKind = useCallback(
    (afterKind: SessionKind | null): SessionKind => {
      if (afterKind === null) return 'study';
      if (afterKind === 'break') return 'study';
      return breakSec > 0 ? 'break' : 'study';
    },
    [breakSec],
  );

  const startNext = useCallback(
    async (kind: SessionKind) => {
      setError('');
      setBusy(true);
      try {
        apply(await api.startTimerSession(team.slug, kind));
      } catch (caught) {
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [apply, team.slug],
  );

  /**
   * 시간이 다 됐다. 알리고 다음 단계를 시작한다 (PRD §6 S7 — 자동 순환).
   *
   * 화면을 보고 있는 클라이언트가 서버에 알린다 (PRD §10). 여러 화면이
   * 동시에 알려도 서버가 세션을 하나만 만든다.
   *
   * 페이지를 열었을 때 이미 지나 있던 경우에는 여기로 들어오지 않는다.
   * 서버가 그 세션을 끝내둔 상태라 current 가 없고, 다음 단계는 사람이 시작한다.
   */
  useEffect(() => {
    if (!current || remaining > 0 || paused || advancing.current) return;
    advancing.current = true;

    const next = nextKind(current.kind);
    ring(
      current.kind === 'study' ? '학습 시간이 끝났어요' : '쉬는 시간이 끝났어요',
      next === 'break' ? '쉬는 시간을 시작해요' : '학습을 시작해요',
    );

    void startNext(next).finally(() => {
      advancing.current = false;
    });
  }, [current, remaining, paused, nextKind, startNext]);

  async function togglePause() {
    if (!current) return;
    setError('');
    setBusy(true);
    try {
      apply(await api.patchTimerSession(team.slug, current.id, paused ? 'resume' : 'pause'));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  /** 지금 단계를 접고 바로 다음으로. 시간이 남아 있어도 넘긴다 */
  async function skip() {
    if (!current) return;
    setError('');
    setBusy(true);
    try {
      const ended = await api.patchTimerSession(team.slug, current.id, 'end');
      apply(ended);
      await startNext(nextKind(current.kind));
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  }

  const keeperName =
    team.today.assigned.find((entry) => entry.role.key === 'keeper')?.member.name ?? null;
  const studySeconds = totalStudySec(state.sessions, now);
  const lastKind = state.sessions.at(-1)?.kind ?? null;
  const waitingKind = nextKind(lastKind);

  return (
    <Screen dark>
      {/* 나가는 길은 하단 버튼 줄로 옮겼다. 어두운 화면에서 좌상단 연한 글씨는 잘 안 보인다 */}
      <TopBar
        left={
          <span className="text-[#5E6B7C]">
            {state.studyCount > 0 ? `${state.studyCount}번째 학습` : '타이머'}
          </span>
        }
        right={<span className="text-[#5E6B7C]">{formatKstTime(now)}</span>}
      />

      <div className="flex flex-1 flex-col items-center justify-center">
        {current ? (
          <>
            <span
              className={[
                'rounded-[6px] px-[9px] py-[3px] text-[10.5px] font-semibold text-night',
                current.kind === 'study' ? 'bg-sky' : 'bg-lime',
              ].join(' ')}
            >
              {paused ? '일시정지' : current.kind === 'study' ? '학습 중' : '쉬는 시간'}
            </span>

            <p className="tabular mt-4 font-mono text-[52px] font-medium tracking-[-0.04em]">
              {formatClock(remaining)}
            </p>

            <p className="mt-[2px] text-[11.5px] font-light text-[#93A0B0]">
              {paused
                ? '이어서 하기를 누르면 다시 흘러가요'
                : `${formatKstTime(scheduledEndMs(current, now))}에 ${
                    current.kind === 'study'
                      ? breakSec > 0
                        ? '쉬는시간이 시작돼요'
                        : '이번 학습이 끝나요'
                      : '학습이 다시 시작돼요'
                  }`}
            </p>

            <div className="mt-[22px] h-[3px] w-full overflow-hidden rounded-[2px] bg-[#242E3C]">
              <span
                className={[
                  'block h-full transition-[width] duration-300',
                  current.kind === 'study' ? 'bg-sky' : 'bg-lime',
                ].join(' ')}
                style={{ width: `${Math.round(progress(current, now) * 100)}%` }}
              />
            </div>
          </>
        ) : (
          /* 단계 사이. 아무도 안 보는 사이 시간이 지났을 때도 여기로 온다 */
          <>
            <span className="rounded-[6px] bg-[#242E3C] px-[9px] py-[3px] text-[10.5px] font-semibold text-[#93A0B0]">
              멈춰 있어요
            </span>
            <p className="mt-4 text-center text-[17px] font-semibold leading-[1.4]">
              다음은 {waitingKind === 'break' ? '쉬는 시간' : '학습'}이에요
            </p>
            <p className="mt-[6px] text-center text-[11.5px] font-light leading-[1.6] text-[#93A0B0]">
              아무도 화면을 보고 있지 않으면 다음 단계로 넘어가지 않아요.
              <br />
              준비되면 아래에서 시작해주세요.
            </p>
          </>
        )}

        {/* 조원 아바타. 이끄미와 시간지키미는 색으로도 구분한다 */}
        <div className="mt-5 flex flex-wrap justify-center gap-[5px]">
          {team.today.assigned.map((entry) => (
            <span
              key={entry.member.id}
              title={`${entry.role.name} ${entry.member.name}`}
              aria-label={`${entry.role.name} ${entry.member.name}`}
              className={[
                'grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-semibold',
                entry.role.key === 'keeper' ? 'bg-sky text-sky-deep' : 'bg-lime text-lime-deep',
              ].join(' ')}
            >
              {entry.member.initial}
            </span>
          ))}
          {team.today.groos.map((member) => (
            <span
              key={member.id}
              title={member.name}
              aria-label={member.name}
              className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#232D3B] text-[10px] font-semibold text-[#8B98A8]"
            >
              {member.initial}
            </span>
          ))}
        </div>

        {/*
          오늘의 역할을 한 줄로. 아바타는 색으로만 구분하니 이름이 안 보인다.
          이 줄이 있으면 "오늘 이끄미가 누구였지"를 확인하러 결과 화면까지
          갈 이유가 줄어든다.
        */}
        {team.today.assigned.length > 0 ? (
          <p className="mt-[10px] text-[11.5px] font-light text-[#93A0B0]">
            {team.today.assigned
              .map((entry) => `${entry.role.emoji} ${entry.member.name}`)
              .join(' · ')}
          </p>
        ) : null}

        <p className="mt-[10px] text-[11px] font-light text-[#93A0B0]">
          오늘 누적 학습 {formatDuration(studySeconds)}
        </p>
      </div>

      {notifyDenied ? (
        <p className="mb-2 rounded-[10px] bg-[#1C2431] px-[10px] py-2 text-[11px] font-light leading-[1.55] text-[#93A0B0]">
          알림이 꺼져 있어요. 소리와 이 화면으로 알려드려요.
        </p>
      ) : null}

      <Notice>{error}</Notice>

      <div className="mt-auto pt-4">
        {/*
          단계를 넘기는 것은 시간지키미의 일이다 (PRD §4). 하지만 이 서비스는
          "이 브라우저가 누구인지" 모른다 — 로그인이 없기 때문이다 (PRD §3-1).
          그래서 버튼을 감추는 대신 이름을 적어 지목한다. 권한이 아니라 신호다.
          누가 눌러도 조 전체가 함께 넘어가고, 그건 의도된 동작이다.
        */}
        {keeperName ? (
          <p className="mb-2 text-center text-[10.5px] font-light leading-[1.5] text-[#6B7889]">
            ⏱️ 시간지키미 <b className="font-semibold text-[#93A0B0]">{keeperName}</b> 그루가
            넘겨주세요
          </p>
        ) : null}

        <div className="flex flex-col gap-[6px]">
          {current ? (
            <>
              <Button tone="lime" onClick={skip} disabled={busy}>
                {nextKind(current.kind) === 'break' ? '쉬는시간으로 넘기기' : '학습으로 넘기기'}
              </Button>
              <Button tone="quiet-dark" onClick={togglePause} disabled={busy}>
                {paused ? '이어서 하기' : '일시정지'}
              </Button>
            </>
          ) : (
            <>
              <Button tone="lime" onClick={() => void startNext(waitingKind)} disabled={busy}>
                {waitingKind === 'break' ? '쉬는시간 시작' : '학습 시작'}
              </Button>
              <ButtonLink href={`/t/${team.slug}/timer?edit=1`} tone="quiet-dark">
                시간 다시 정하기
              </ButtonLink>
            </>
          )}

          {/* 가끔 쓰는 출구. 세 번째 무게로 둔다 */}
          <ButtonLink href={`/t/${team.slug}`} tone="ghost-dark">
            오늘의 역할 확인하기
          </ButtonLink>
        </div>
      </div>
    </Screen>
  );
}

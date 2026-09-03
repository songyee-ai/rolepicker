'use client';

/**
 * 타이머가 켜지는 순간을 지켜본다. (조 전체가 하나의 타이머를 함께 본다)
 *
 * 조원 한 명이 `시작`을 누르면 나머지 조원 화면도 타이머로 옮겨간다.
 * 각자 누르지 않아도 같은 화면을 보게 하려는 것이다.
 *
 * ── 되돌이를 만들지 않는 규칙 ────────────────────────────────
 * "타이머가 돌고 있으면 무조건 옮긴다"로 만들면, 실행 화면에서
 * `오늘의 역할 확인하기`를 눌러 나가는 순간 곧바로 다시 끌려온다. 나갈 수가 없다.
 *
 * 그래서 **켜져 있는 상태**가 아니라 **켜지는 순간**을 본다.
 *   화면을 열었을 때 이미 돌고 있으면  -> 그대로 둔다 (일부러 온 사람이다)
 *   열어둔 동안 켜지면                -> 옮긴다 (기다리던 사람이다)
 *
 * ── 왜 폴링인가 ──────────────────────────────────────────────
 * PRD §5는 WebSocket 실시간 동기화를 만들지 않기로 했다. 몇 초마다 묻는 것은
 * 연결을 유지하지 않으므로 그 결정과 어긋나지 않는다.
 * 탭이 보이지 않으면 묻지 않는다 — 노트북을 덮어두면 요청이 0이다.
 * 다시 보이는 순간 한 번 묻기 때문에 돌아오면 바로 최신 상태가 된다.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

/** 몇 초마다 물어볼지. 3초면 "동시에"로 느껴지면서 요청도 많지 않다 */
export const WATCH_INTERVAL_MS = 3000;

export interface TimerWatchOptions {
  slug: string;
  /** 이 화면이 그려진 시점에 타이머가 돌고 있었는가 */
  runningAtLoad: boolean;
  /** 오늘 배정이 없으면 타이머 자체가 없다. 물어볼 필요가 없다 */
  enabled?: boolean;
  /**
   * 켜졌을 때 무엇을 할지. 기본은 실행 화면으로 이동.
   * 명단 고치기처럼 저장 안 한 입력이 있는 화면은 옮기지 않고 알리기만 한다.
   */
  onStart?: () => void;
}

export function useTimerWatch({
  slug,
  runningAtLoad,
  enabled = true,
  onStart,
}: TimerWatchOptions): void {
  const router = useRouter();

  // 처음 본 상태를 기준으로 삼는다. 이미 돌고 있었다면 옮기지 않는다
  const wasRunning = useRef(runningAtLoad);
  const done = useRef(false);

  /**
   * onStart 는 부르는 쪽에서 매번 새로 만들어지는 함수다. 그걸 아래
   * check 의 의존성에 넣으면 화면을 그릴 때마다 타이머가 다시 걸린다.
   * 그래서 최신 것만 담아두고 참조로 쓴다. 담는 것은 그리는 중이 아니라
   * 그린 뒤에 한다.
   */
  const handler = useRef(onStart);
  useEffect(() => {
    handler.current = onStart;
  }, [onStart]);

  const check = useCallback(async () => {
    if (done.current || document.visibilityState !== 'visible') return;

    let running = false;
    try {
      const team = await api.getTeam(slug);
      running = team.today?.timer != null;
    } catch {
      // 잠깐 실패해도 다음 차례에 다시 묻는다
      return;
    }

    if (running && !wasRunning.current) {
      done.current = true;
      if (handler.current) handler.current();
      else router.push(`/t/${slug}/timer/run`);
    }
    wasRunning.current = running;
  }, [router, slug]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => void check(), WATCH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check, enabled]);
}

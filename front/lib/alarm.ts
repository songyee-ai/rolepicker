'use client';

/**
 * 단계가 끝났을 때 알리는 방법들. (PRD §6 S7, §14)
 *
 * 셋 다 실패할 수 있다는 전제로 만든다.
 *   알림  — 권한을 거부할 수 있다
 *   소리  — 사용자 제스처 없이는 재생이 막힌다
 *   화면  — 이건 항상 된다. 그래서 최후의 수단이자 기본이다
 *
 * 어느 하나가 안 되더라도 오류를 띄우지 않는다. 타이머는 계속 돌아가야 한다.
 */

/** 알림 권한을 요청한다. `시작`을 누르는 순간에만 부른다 (PRD §14) */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// ─── 소리 ────────────────────────────────────────────────────────
//
// 사용자 제스처 없이는 재생되지 않는다 (PRD §14). 그래서 버튼을 누르는
// 시점에 오디오를 만들어 두고, 나중에 그것으로 소리를 낸다.
// 파일을 받아오지 않고 짧은 음을 직접 만든다 — 네트워크가 끊겨도 울린다.

let audio: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

/** 사용자가 화면을 누른 시점에 부른다. 실패해도 조용히 넘어간다 */
export function unlockAudio(): void {
  try {
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    audio ??= new Ctor();
    void audio.resume();
  } catch {
    audio = null;
  }
}

export function canPlaySound(): boolean {
  return audio !== null && audio.state === 'running';
}

/** 짧게 두 번 '띵'. 단계가 바뀌었다는 신호 */
function beep(): void {
  if (!audio || audio.state !== 'running') return;
  try {
    const now = audio.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.28, 1180],
    ] as const) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      // 갑자기 끊으면 '툭' 소리가 난다. 부드럽게 올렸다 내린다
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.24);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.26);
    }
  } catch {
    // 소리는 보조 수단이다. 안 나도 그만
  }
}

/** 알림과 소리를 함께. 둘 다 안 되면 화면 표시만 남는다 */
export function ring(title: string, body: string): void {
  beep();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'groo-timer', renotify: true } as NotificationOptions);
    }
  } catch {
    // 일부 브라우저는 서비스워커 없이 Notification 생성을 막는다
  }
}

// ─── 화면 꺼짐 방지 ───────────────────────────────────────────────

interface WakeLockLike {
  release: () => Promise<void>;
  released: boolean;
}

/**
 * 몇 시간 띄워두는 화면이라 꺼지면 곤란하다 (PRD §6 S7).
 * 지원하지 않는 브라우저에서는 조용히 건너뛴다. 실패를 에러로 노출하지 않는다 (PRD §14).
 *
 * 탭이 가려지면 브라우저가 잠금을 풀어버리므로, 다시 보일 때 다시 건다.
 */
export function keepScreenAwake(): () => void {
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> };
  });
  if (!nav?.wakeLock) return () => {};

  let lock: WakeLockLike | null = null;
  let stopped = false;

  const acquire = async () => {
    if (stopped || document.visibilityState !== 'visible') return;
    try {
      lock = await nav.wakeLock!.request('screen');
    } catch {
      lock = null;
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible' && (lock === null || lock.released)) void acquire();
  };

  void acquire();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => {});
  };
}

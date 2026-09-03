/**
 * 화면 조각 모음.
 *
 * 크기·색·간격은 role-picker-mockup-v9.html 에서 그대로 가져왔다.
 * 목업의 px 값이 곧 실제 값이다 (PRD §6 S5가 "원형 24px", "이름 21px",
 * "여백 18px"처럼 숫자를 직접 적어둔 것과 맞춘다).
 *
 * 여기 있는 것들은 상태를 갖지 않는 순수 마크업이라 화면 어디서든 쓸 수 있다.
 */

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// ─── 화면 껍데기 ──────────────────────────────────────────────────

/**
 * 페이지 전체 스크롤을 쓴다. 명단 영역에 별도 스크롤을 만들지 않는다 (PRD §11).
 * 스크롤 영역이 두 개면 모바일에서 손가락이 어디를 잡았는지에 따라
 * 엉뚱하게 움직이고, 명단 일부가 화면 밖에 숨는다.
 */
export function Screen({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <main
      className={[
        'mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-4 pt-5 pb-4',
        dark ? 'bg-night text-[#F2F4F7]' : 'ruled text-ink',
      ].join(' ')}
    >
      {children}
    </main>
  );
}

/** 화면 위쪽의 작은 안내줄. 목업의 status 자리 */
export function TopBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[10px] text-ink-35">
      <span className="min-w-0 truncate">{left}</span>
      {right}
    </div>
  );
}

/**
 * 되돌아갈 이유가 실제로 생기는 자리에만 명시적인 입구를 둔다 (목업 '화면 이동에 대해').
 * 채팅방 링크로 바로 들어온 사람은 브라우저 뒤로 가기로 갈 곳이 없으므로,
 * 조를 잘못 골랐을 때 첫 화면으로 가는 길이 눈에 보여야 한다.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[3px] font-sans text-[11px] font-medium text-ink-60"
    >
      <span aria-hidden>‹</span>
      {children}
    </Link>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-[19px] font-bold leading-[1.3] tracking-[-0.025em]">{children}</h1>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-[5px] text-[12px] font-light leading-[1.55] text-ink-60">{children}</p>;
}

/** 목록 위의 요약 줄 (참여 4명 / 빈자리 · 이서연) */
export function CountRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex justify-between text-[11.5px] font-medium text-ink-60">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

/**
 * 참여 인원 요약은 상단 고정 (PRD §11).
 * 아래쪽 조원이 안 보이는 상태에서도 전체 상태를 알 수 있게 한다.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-[7px] mt-[14px] bg-paper/95 px-4 py-2 backdrop-blur-sm">
      {children}
    </div>
  );
}

/**
 * 주 버튼만 하단 고정 (PRD §11). 보조 버튼은 고정하지 않고 스크롤 끝에 둔다.
 * 위쪽에 배경색에서 투명으로 가는 그라데이션을 깔아 아래에 내용이 더 있음을 알린다.
 */
export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-1 pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent to-paper"
      />
      <div className="relative bg-paper">{children}</div>
    </div>
  );
}

// ─── 버튼 ────────────────────────────────────────────────────────

type ButtonTone = 'ink' | 'lime' | 'quiet' | 'quiet-dark';

const TONE: Record<ButtonTone, string> = {
  ink: 'bg-ink text-paper font-semibold',
  lime: 'bg-lime text-ink font-semibold',
  quiet: 'border border-rule bg-transparent text-ink-60 font-medium',
  // 타이머 실행 화면은 어둡다. 같은 연한 톤을 그 배경에 맞춘 것 (목업 .dark .go.quiet)
  'quiet-dark': 'border border-[#2E3846] bg-transparent text-[#93A0B0] font-medium',
};

const BUTTON_BASE =
  'block w-full rounded-[12px] px-3 py-[13px] text-center text-[13.5px] tracking-[-0.01em]' +
  ' transition-opacity disabled:cursor-not-allowed disabled:opacity-45';

export function Button({
  tone = 'ink',
  className = '',
  ...rest
}: { tone?: ButtonTone } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={[BUTTON_BASE, TONE[tone], className].join(' ')} {...rest} />;
}

export function ButtonLink({
  href,
  tone = 'ink',
  className = '',
  children,
  replace = false,
}: {
  href: string;
  tone?: ButtonTone;
  className?: string;
  children: ReactNode;
  replace?: boolean;
}) {
  return (
    <Link href={href} replace={replace} className={[BUTTON_BASE, TONE[tone], className].join(' ')}>
      {children}
    </Link>
  );
}

// ─── 이니셜 원형 ──────────────────────────────────────────────────

export type AvatarTone = 'lead' | 'keeper' | 'muted' | 'gone' | 'warn' | 'add';

const AVATAR_TONE: Record<AvatarTone, string> = {
  lead: 'bg-lime text-lime-deep',
  keeper: 'bg-sky text-sky-deep',
  muted: 'bg-[#EDECE5] text-ink-60',
  gone: 'border border-dashed border-[#CFCEC6] bg-transparent text-ink-35',
  warn: 'bg-[#F5D9B8] text-warn',
  add: 'bg-[#E9E8E1] text-ink-35',
};

/**
 * 색만으로 정보를 전달하지 않는다 (PRD §13).
 * 역할은 이모지와 텍스트로 함께 적고, 원형은 보조 수단이다.
 *
 * 이니셜이 같은 동명이인이 있으므로 aria-label 에 전체 이름을 넣는다 (PRD §14).
 */
export function Avatar({
  initial,
  name,
  tone = 'muted',
  size = 23,
}: {
  initial: string;
  name?: string;
  tone?: AvatarTone;
  size?: number;
}) {
  return (
    <span
      aria-label={name}
      title={name}
      className={[
        'grid flex-none place-items-center rounded-full font-semibold',
        AVATAR_TONE[tone],
      ].join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      {initial}
    </span>
  );
}

// ─── 역할 라벨 ────────────────────────────────────────────────────

/** 형광펜으로 그은 것처럼 (PRD §13) */
export function RoleLabel({
  children,
  tone = 'lime',
}: {
  children: ReactNode;
  tone?: 'lime' | 'sky' | 'rule';
}) {
  const swipe = tone === 'sky' ? 'swipe-sky' : tone === 'rule' ? 'swipe-rule' : 'swipe';
  return <span className={`inline-block text-[11px] font-semibold ${swipe}`}>{children}</span>;
}

// ─── 안내와 오류 ──────────────────────────────────────────────────

/**
 * 에러 문구는 사과하지 않는다. 무엇이 잘못됐고 어떻게 하면 되는지 알려준다 (PRD §17).
 * 문구 자체는 서버가 만들어 보낸 것을 그대로 쓴다.
 */
export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'plain' }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={[
        'mt-2 rounded-[10px] px-[10px] py-2 text-[11.5px] leading-[1.55]',
        tone === 'warn' ? 'bg-warn-bg text-warn' : 'bg-rule-soft text-ink-60',
      ].join(' ')}
    >
      {children}
    </p>
  );
}

/**
 * 하단 버튼 위의 한 줄 안내.
 * 왜 버튼을 못 누르는지, 또는 무엇이 달라졌는지를 짧게 적는다.
 * 버튼을 회색으로만 만들고 이유를 안 알려주면 안 된다 (PRD §14).
 */
export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="pb-2 text-center text-[10.5px] font-light leading-[1.5] text-ink-60">
      {children}
    </p>
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  return (
    <div className="my-[15px] flex items-center gap-[9px] text-[11px] text-ink-35">
      <span className="h-px flex-1 bg-rule" />
      {children}
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}

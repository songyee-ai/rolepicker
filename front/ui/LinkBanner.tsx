'use client';

/**
 * 링크 배너. (PRD §6 S3)
 *
 * 만든 날에만 이 화면 위쪽에 뜬다. 그 뒤로는 '명단 고치기' 화면 하단에
 * 상시 노출된다 — 이 처리를 빼면 링크를 잃은 사용자가 복구 불가능해진다 (PRD §14).
 */

import { useState } from 'react';

export default function LinkBanner({
  slug,
  code,
  variant = 'banner',
}: {
  slug: string;
  code: string;
  /** banner = 만든 날 상단, quiet = 명단 고치기 하단 상시 노출 */
  variant?: 'banner' | 'quiet';
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? `/t/${slug}` : `${window.location.origin}/t/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드를 막아둔 브라우저도 있다. 주소가 화면에 보이니 직접 고를 수 있다
      setCopied(false);
    }
  }

  const quiet = variant === 'quiet';

  return (
    <section
      className={[
        'mb-3 rounded-[12px] px-[11px] py-[10px]',
        quiet ? 'border border-rule bg-white' : 'border-[1.5px] border-lime bg-[#FBFFEF]',
      ].join(' ')}
    >
      <p className={['text-[11px] font-medium', quiet ? 'text-ink-60' : 'text-lime-deep'].join(' ')}>
        {quiet ? '이 조의 링크와 코드' : '이 링크를 조 채팅방에 공유하세요'}
      </p>

      <div className="mt-[6px] flex items-center gap-[6px]">
        <code
          className={[
            'flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[7px] border bg-white px-[7px] py-[6px] font-mono text-[11.5px] font-medium',
            quiet ? 'border-rule' : 'border-[#DCEBB2]',
          ].join(' ')}
        >
          {url.replace(/^https?:\/\//, '')}
        </code>
        <button
          type="button"
          onClick={copy}
          className={[
            'flex-none rounded-[7px] px-[9px] py-[6px] text-[11px] font-semibold',
            quiet ? 'border border-rule text-ink-60' : 'bg-lime text-lime-deep',
          ].join(' ')}
        >
          {copied ? '복사됐어요' : '복사'}
        </button>
      </div>

      <small className="mt-[7px] block font-mono text-[10px] text-ink-60">코드 {code}</small>
    </section>
  );
}

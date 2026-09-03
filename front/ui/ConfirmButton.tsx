'use client';

/**
 * 한 번 묻고 실행하는 버튼.
 *
 * PRD §3-7은 "매일 하는 일에 확인 절차를 붙이지 않는다"고 정해뒀다.
 * 그래서 첫 뽑기에는 쓰지 않는다. **이미 완성된 오늘 결과를 덮어쓸 때만** 쓴다.
 * 링크를 아는 사람은 누구나 다시 뽑을 수 있으므로 (PRD §3-1), 실수로 눌러
 * 남이 보고 있는 결과가 바뀌는 것만 막는다.
 *
 * 브라우저 기본 confirm 창을 쓰지 않는다. 생김새가 화면과 어긋나고,
 * 문구를 우리 말투로 쓸 수 없다 (PRD §17).
 */

import { useState } from 'react';
import { Button, FooterNote } from './kit';

export default function ConfirmButton({
  label,
  question,
  confirmLabel,
  cancelLabel = '그만두기',
  onConfirm,
  disabled = false,
  busy = false,
  busyLabel,
  tone = 'quiet',
}: {
  label: string;
  question: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel: string;
  tone?: 'ink' | 'lime' | 'quiet';
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button tone={tone} disabled={disabled || busy} onClick={() => setAsking(true)}>
        {busy ? busyLabel : label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-[6px]">
      <FooterNote>{question}</FooterNote>
      <Button
        tone="ink"
        disabled={disabled || busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {busy ? busyLabel : confirmLabel}
      </Button>
      <Button tone="quiet" onClick={() => setAsking(false)}>
        {cancelLabel}
      </Button>
    </div>
  );
}

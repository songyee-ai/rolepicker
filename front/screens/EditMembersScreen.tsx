'use client';

/**
 * 명단 고치기 — /t/[slug]/members (PRD §6 S3 보조, §14)
 *
 * 이 화면 하단에 링크와 코드를 상시 노출한다. 링크 배너는 만든 날에만 뜨는데,
 * 그러면 이후에 코드를 확인할 방법이 사라진다. 이 처리를 빼면 링크를 잃은
 * 사용자가 복구 불가능해진다 (PRD §14).
 *
 * 지우는 것은 곧바로 확정하지 않는다. 되돌리기가 몇 초간 떠 있다 (PRD §14).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BlockedHint,
  Button,
  CountRow,
  Lede,
  Notice,
  Screen,
  StickyFooter,
  StickyHeader,
  Title,
  TopBar,
} from '@/front/ui/kit';
import LinkBanner from '@/front/ui/LinkBanner';
import { api, messageOf } from '@/front/lib/api';
import {
  cleanName,
  findDuplicateNames,
  initialOf,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
} from '@/shared/names';
import type { TeamView } from '@/shared/types';

const UNDO_SECONDS = 6;

interface Row {
  key: number;
  /** 기존 조원이면 id, 새로 추가한 조원이면 없음 */
  id?: string;
  name: string;
}

let nextKey = 0;

export default function EditMembersScreen({ team }: { team: TeamView }) {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>(() =>
    team.members.map((member) => ({ key: nextKey++, id: member.id, name: member.name })),
  );
  const [removed, setRemoved] = useState<{ row: Row; at: number } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pendingFocus = useRef<number | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  // 새 칸이 그려진 뒤에 커서를 옮긴다. 상태를 쓰지 않으므로 다시 그리지 않는다
  useEffect(() => {
    const key = pendingFocus.current;
    if (key === null) return;
    pendingFocus.current = null;
    const input = inputs.current.get(key);
    input?.focus();
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [rows]);

  // 되돌리기는 몇 초 뒤 사라진다. 사라지면 저장할 때 확정된다
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  const names = rows.map((row) => cleanName(row.name)).filter((name) => name.length > 0);
  const duplicates = findDuplicateNames(rows.map((row) => row.name));
  const duplicateIndexes = new Set(duplicates.flatMap((group) => group.indexes));
  const tooMany = names.length > MAX_MEMBERS;
  const empty = names.length === 0;

  function setName(index: number, name: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, name } : row)));
  }

  function addRow() {
    const row: Row = { key: nextKey++, name: '' };
    pendingFocus.current = row.key;
    setRows((current) => [...current, row]);

  }

  function remove(index: number) {
    const row = rows[index];
    setRows((current) => current.filter((_, i) => i !== index));
    setRemoved({ row, at: index });
  }

  function undo() {
    if (!removed) return;
    setRows((current) => {
      const next = [...current];
      next.splice(Math.min(removed.at, next.length), 0, removed.row);
      return next;
    });
    setRemoved(null);
  }

  async function save() {
    setError('');
    if (empty) {
      setError('조원이 한 명도 없어요. 이름을 하나 이상 남겨주세요.');
      return;
    }
    if (tooMany) {
      setError(`한 조는 ${MAX_MEMBERS}명까지예요. 조를 나누는 게 좋아요.`);
      return;
    }

    setSaving(true);
    try {
      await api.saveMembers(
        team.slug,
        rows
          .map((row) => ({ id: row.id, name: cleanName(row.name) }))
          .filter((row) => row.name.length > 0),
      );
      // 결과 화면으로 바로 가면 새로 넣은 그루가 오늘 배정에 없어서
      // 아무 일도 안 일어난 것처럼 보인다. 빈자리를 정하고 다시 뽑는 화면으로 보낸다
      router.push(`/t/${team.slug}/check`);
    } catch (caught) {
      setError(messageOf(caught));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TopBar
        left="명단 고치기"
        right={
          <Link href={`/t/${team.slug}`} className="text-[10px] text-ink-60">
            저장 안 하고 나가기
          </Link>
        }
      />

      <Title>명단 고치기</Title>
      <Lede>
        못 온 그루는 여기서 지우지 말고,
        <br />
        오늘 화면에서 빈자리로 바꿔주세요.
      </Lede>

      <StickyHeader>
        <CountRow
          left={`${names.length}명`}
          right={<span className="font-light text-ink-35">이름을 눌러 고칠 수 있어요</span>}
        />
      </StickyHeader>

      <ul>
        {rows.map((row, index) => {
          const trimmed = cleanName(row.name);
          const isDuplicate = duplicateIndexes.has(index);
          const filled = trimmed.length > 0;

          return (
            <li
              key={row.key}
              className={[
                'mb-[5px] flex items-center gap-[9px] rounded-[11px] border px-[9px] py-2',
                isDuplicate ? 'border-warn bg-warn-bg' : 'border-rule bg-paper',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'grid h-[23px] w-[23px] flex-none place-items-center rounded-full text-[11px] font-semibold',
                  isDuplicate
                    ? 'bg-[#F5D9B8] text-warn'
                    : filled
                      ? 'bg-lime text-lime-deep'
                      : 'bg-[#E9E8E1] text-ink-35',
                ].join(' ')}
              >
                {filled ? initialOf(trimmed) : '＋'}
              </span>

              <input
                ref={(node) => {
                  if (node) inputs.current.set(row.key, node);
                  else inputs.current.delete(row.key);
                }}
                value={row.name}
                onChange={(event) => setName(index, event.target.value)}
                maxLength={MAX_NAME_LENGTH * 2}
                placeholder="이름 입력"
                aria-label={`${index + 1}번째 그루 이름`}
                autoComplete="off"
                className="w-full flex-1 text-[13px] font-medium outline-none placeholder:font-light placeholder:text-ink-35"
              />

              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`${trimmed || '빈 칸'} 지우기`}
                className="flex-none rounded-[7px] border border-rule bg-white px-[7px] py-[3px] text-[10.5px] font-medium text-ink-60"
              >
                지우기
              </button>
            </li>
          );
        })}
      </ul>

      {duplicates.length > 0 ? (
        <p className="px-[2px] pb-[6px] pt-[2px] text-[10.5px] leading-[1.5] text-warn">
          같은 이름이 있어요. 뽑은 뒤에 누군지 알 수 있게 구분해 주세요 ({duplicates[0].name}A,{' '}
          {duplicates[0].name}B)
        </p>
      ) : null}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-[11px] border border-dashed border-[#D5D4CC] py-2 text-[12px] text-ink-60"
      >
        그루 추가
      </button>

      {/* 되돌리기 (PRD §14 — 즉시 지우면 되돌릴 수 없다) */}
      {removed ? (
        <div className="mt-2 flex items-center justify-between rounded-[10px] bg-ink px-[11px] py-[9px] text-[11.5px] text-paper">
          <span>
            {cleanName(removed.row.name) || '빈 칸'} 을 지웠어요
          </span>
          <button type="button" onClick={undo} className="font-semibold text-lime underline">
            되돌리기
          </button>
        </div>
      ) : null}

      <Notice>{error}</Notice>

      {/* 링크와 코드 상시 노출 — 이걸 빼면 링크를 잃은 사용자가 복구할 방법이 없다 */}
      <div className="mt-5">
        <LinkBanner slug={team.slug} code={team.code} variant="quiet" />
        <Link
          href={`/t/${team.slug}/history`}
          className="block w-full rounded-[12px] border border-rule px-3 py-[13px] text-center text-[13.5px] font-medium text-ink-60"
        >
          지난 기록 보기
        </Link>
      </div>

      <StickyFooter>
        {empty ? <BlockedHint>이름이 하나도 없으면 저장할 수 없어요.</BlockedHint> : null}
        {tooMany ? (
          <BlockedHint>
            한 조는 {MAX_MEMBERS}명까지예요. {names.length}명이면 조를 나누는 게 좋아요.
          </BlockedHint>
        ) : null}
        <Button onClick={save} disabled={saving || empty || tooMany}>
          {saving ? '저장하고 있어요…' : '저장하기'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}

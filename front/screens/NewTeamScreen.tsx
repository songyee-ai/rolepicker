'use client';

/**
 * S2. 새 조 만들기 — /new (PRD §6 S2)
 *
 * 화면을 넘기지 않고 한 장에서 끝낸다. 조 이름은 묻지 않는다 (PRD §3-2).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BackLink,
  FooterNote,
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
import { api, messageOf } from '@/front/lib/api';
import { rememberTeam } from '@/front/lib/recent-teams';
import { todayKst } from '@/shared/date';
import {
  cleanName,
  findDuplicateNames,
  initialOf,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  parseNameList,
} from '@/shared/names';

const INITIAL_ROWS = 5;

interface Row {
  key: number;
  value: string;
}

let nextKey = 0;
const makeRow = (value = ''): Row => ({ key: nextKey++, value });

export default function NewTeamScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => makeRow()),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  /** 새로 만든 칸으로 커서를 옮긴다. 안 그러면 아무 일도 안 일어난 것처럼 보인다 (PRD §11) */
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

  const names = rows.map((row) => cleanName(row.value)).filter((name) => name.length > 0);
  const duplicates = findDuplicateNames(rows.map((row) => row.value));
  const duplicateIndexes = new Set(duplicates.flatMap((group) => group.indexes));
  const tooMany = names.length > MAX_MEMBERS;

  function setValue(index: number, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, value } : row)));
  }

  function addRow() {
    const row = makeRow();
    pendingFocus.current = row.key;
    setRows((current) => [...current, row]);

  }

  /**
   * 여러 줄 붙여넣기 (PRD §6 S2).
   * 명단을 채팅방에서 복사해 오는 경우가 대부분이다. 줄바꿈·쉼표·탭으로 나누고
   * "1. 김민지" 같은 번호도 떼어낸다 (PRD §14).
   */
  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    const parsed = parseNameList(text);
    if (parsed.length <= 1) return; // 이름 하나면 평소대로 붙여넣게 둔다

    event.preventDefault();
    setRows((current) => {
      const next = [...current];
      parsed.forEach((name, offset) => {
        const target = index + offset;
        if (target < next.length) {
          next[target] = { ...next[target], value: name };
        } else {
          next.push(makeRow(name));
        }
      });
      return next;
    });
  }

  async function submit() {
    setError('');

    if (names.length === 0) {
      setError('조원 이름을 한 명 이상 넣어주세요.');
      return;
    }
    if (tooMany) {
      setError(`한 조는 ${MAX_MEMBERS}명까지예요. ${names.length}명이면 조를 나누는 게 좋아요.`);
      return;
    }

    setSaving(true);
    try {
      const created = await api.createTeam(names);
      rememberTeam({
        slug: created.slug,
        lastUsedAt: todayKst(),
        lastLeadName: null,
        memberNames: names,
      });
      // 뒤로 가기로 이 화면에 돌아오면 조가 또 만들어질 수 있어서 교체한다
      router.replace(`/t/${created.slug}?new=1`);
    } catch (caught) {
      setError(messageOf(caught));
      setSaving(false);
    }
  }

  return (
    <Screen>
      {/* 조가 이미 있는데 실수로 들어온 사람이 돌아갈 길이 있어야 한다 */}
      <TopBar
        left={<BackLink href="/">처음으로</BackLink>}
        right={<span>새 조 만들기</span>}
      />
      <Title>누가 함께하나요</Title>
      <Lede>
        조 이름은 안 물어봐요.
        <br />
        링크 하나가 곧 이 조입니다.
      </Lede>

      <StickyHeader>
        <CountRow
          left={`${names.length}명`}
          right={<span className="font-light text-ink-35">여러 줄 붙여넣기 가능</span>}
        />
      </StickyHeader>

      <div>
        {rows.map((row, index) => {
          const trimmed = cleanName(row.value);
          const isDuplicate = duplicateIndexes.has(index);
          const filled = trimmed.length > 0;

          return (
            <div key={row.key}>
              <div
                className={[
                  'mb-[5px] flex items-center gap-[9px] rounded-[11px] border px-[9px] py-2',
                  isDuplicate ? 'border-warn bg-warn-bg' : 'border-rule bg-paper',
                ].join(' ')}
              >
                <span
                  className={[
                    'grid h-[23px] w-[23px] flex-none place-items-center rounded-full text-[11px] font-semibold',
                    isDuplicate
                      ? 'bg-[#F5D9B8] text-warn'
                      : filled
                        ? 'bg-lime text-lime-deep'
                        : 'bg-[#E9E8E1] text-ink-35',
                  ].join(' ')}
                  aria-hidden
                >
                  {filled ? initialOf(trimmed) : '＋'}
                </span>

                <input
                  ref={(node) => {
                    if (node) inputs.current.set(row.key, node);
                    else inputs.current.delete(row.key);
                  }}
                  value={row.value}
                  onChange={(event) => setValue(index, event.target.value)}
                  onPaste={(event) => handlePaste(index, event)}
                  maxLength={MAX_NAME_LENGTH * 2}
                  placeholder="이름 입력"
                  aria-label={`${index + 1}번째 그루 이름`}
                  autoComplete="off"
                  className="w-full flex-1 text-[13px] font-medium outline-none placeholder:font-light placeholder:text-ink-35"
                />
              </div>
            </div>
          );
        })}

        {duplicates.length > 0 ? (
          <p className="px-[2px] pb-[6px] pt-[2px] text-[10.5px] leading-[1.5] text-warn">
            같은 이름이 있어요. 뽑은 뒤에 누군지 알 수 있게 구분해 주세요 (
            {duplicates[0].name}A, {duplicates[0].name}B)
          </p>
        ) : null}

        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-[11px] border border-dashed border-[#D5D4CC] py-2 text-[12px] text-ink-60"
        >
          그루 추가
        </button>
      </div>

      <Notice>{error}</Notice>

      <StickyFooter>
        {tooMany ? (
          <FooterNote>
            한 조는 {MAX_MEMBERS}명까지예요. {names.length}명이면 조를 나누는 게 좋아요.
          </FooterNote>
        ) : names.length === 0 ? (
          <FooterNote>이름을 한 명 이상 넣으면 링크를 만들 수 있어요.</FooterNote>
        ) : null}
        <Button onClick={submit} disabled={saving || tooMany || names.length === 0}>
          {saving ? '만들고 있어요…' : '만들기'}
        </Button>
      </StickyFooter>
    </Screen>
  );
}

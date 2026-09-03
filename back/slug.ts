/**
 * 링크 주소와 코드. (PRD §8, §14)
 *
 * 링크가 곧 열쇠다 (PRD §3-1). 비밀번호가 없으므로 주소를 찍어서 남의 조에
 * 들어갈 수 있으면 안 된다. 그래서
 *   - 목업의 4자리 대신 hex를 6자리로 늘린다 (PRD §14)
 *   - /api/resolve에 rate limit을 둔다 (back/rate-limit.ts)
 *
 * 조합 수 = 단어 64개 × 16^6 = 약 10억.
 *
 * slug  'mango-7b2k9f'  주소에 들어가는 소문자
 * code  'MANGO-7B2K9F'  화상 통화로 불러주는 대문자 표기. 같은 값이다
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';

/**
 * 화상 통화로 불러줄 수 있어야 하므로 짧고 읽기 쉬운 단어만 쓴다.
 * 개수는 256의 약수인 64개로 맞춰서, 한 바이트를 나눌 때 특정 단어가
 * 더 자주 나오는 쏠림이 생기지 않게 한다.
 */
const WORDS = [
  'mango', 'lemon', 'peach', 'melon', 'berry', 'grape', 'apple', 'guava',
  'olive', 'plum', 'pear', 'lime', 'fig', 'date', 'kiwi', 'cocoa',
  'basil', 'mint', 'sage', 'thyme', 'clove', 'cumin', 'chili', 'ginger',
  'maple', 'cedar', 'birch', 'aspen', 'willow', 'ivy', 'fern', 'moss',
  'river', 'lake', 'creek', 'ocean', 'coral', 'dune', 'cliff', 'ridge',
  'cloud', 'rain', 'storm', 'frost', 'ember', 'flame', 'spark', 'comet',
  'robin', 'heron', 'crane', 'finch', 'otter', 'panda', 'koala', 'lynx',
  'piano', 'cello', 'flute', 'drum', 'chord', 'tempo', 'lyric', 'waltz',
] as const;

const HEX_LENGTH = 6;
const SLUG_PATTERN = /^[a-z]{2,12}-[0-9a-f]{6}$/;
const CODE_PATTERN = /^[A-Z]{2,12}-[0-9A-F]{6}$/;

/** 테스트에서 바꿔 끼울 수 있게 밖에서 받는다 */
export type RandomBytes = (size: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (size) => nodeRandomBytes(size);

/**
 * 새 조의 slug를 만든다.
 * 추측을 막는 것이 목적이므로 Math.random이 아니라 암호용 난수를 쓴다.
 */
export function generateSlug(randomBytes: RandomBytes = defaultRandomBytes): string {
  const bytes = randomBytes(1 + HEX_LENGTH / 2);
  const word = WORDS[bytes[0] % WORDS.length];
  const hex = [...bytes.slice(1)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${word}-${hex}`;
}

/** 주소용 slug -> 불러주는 코드 */
export function slugToCode(slug: string): string {
  return slug.toUpperCase();
}

export function isSlug(value: unknown): boolean {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

export function isCode(value: unknown): boolean {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

/**
 * 사람이 입력한 코드를 slug로 바꾼다. 못 알아보면 null.
 *
 * 기기가 바뀌어 최근 목록이 없는 사람이 쓰는 유일한 통로이므로 (PRD §14)
 * 입력을 최대한 너그럽게 받는다. 대소문자, 앞뒤 공백, 하이픈 없음,
 * 하이픈 대신 공백, 하이픈 여러 개를 모두 같은 코드로 본다.
 *
 * 단어가 위 목록에 있는지는 검사하지 않는다. 목록을 나중에 늘리거나 바꿔도
 * 이미 나간 링크가 죽지 않아야 한다. 존재 여부는 DB 조회가 판단한다.
 */
export function normalizeCode(input: string): string | null {
  const compact = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact.length < 2 + HEX_LENGTH) return null;

  const hex = compact.slice(-HEX_LENGTH);
  const word = compact.slice(0, -HEX_LENGTH);

  if (!/^[0-9a-f]{6}$/.test(hex)) return null;
  if (!/^[a-z]{2,12}$/.test(word)) return null;

  return `${word}-${hex}`;
}

/** 조 링크 전체 주소. 복사 버튼과 배너에 쓴다 (PRD §6 S3) */
export function teamUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/t/${slug}`;
}

/** 목록을 늘릴 때 조합 수가 줄지 않았는지 확인하려고 내보낸다 */
export const SLUG_WORD_COUNT = WORDS.length;

import { describe, expect, it } from 'vitest';
import {
  generateSlug,
  isCode,
  isSlug,
  normalizeCode,
  slugToCode,
  SLUG_WORD_COUNT,
  teamUrl,
} from './slug';

describe('generateSlug', () => {
  it('단어 + hex 6자리 형태다 (PRD §14 — 4자리는 엔트로피가 낮다)', () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug();
      expect(slug).toMatch(/^[a-z]+-[0-9a-f]{6}$/);
      expect(isSlug(slug)).toBe(true);
    }
  });

  it('1만 개를 만들어도 겹치지 않는다', () => {
    const slugs = new Set(Array.from({ length: 10_000 }, () => generateSlug()));
    // 조합 수가 10억이므로 1만 개에서 충돌은 사실상 없다. 있어도 DB unique가 막는다
    expect(slugs.size).toBe(10_000);
  });

  it('단어가 한쪽으로 쏠리지 않는다 — 256이 단어 수로 나누어떨어져야 한다', () => {
    expect(256 % SLUG_WORD_COUNT).toBe(0);

    const words = new Set(
      Array.from({ length: 5_000 }, () => generateSlug().split('-')[0]),
    );
    expect(words.size).toBe(SLUG_WORD_COUNT); // 5천 개면 64개 단어가 모두 나온다
  });

  it('난수를 바꿔 끼우면 결과가 정해진다', () => {
    const slug = generateSlug(() => new Uint8Array([0, 0x7b, 0x2c, 0x9f]));
    expect(slug).toBe('mango-7b2c9f');
  });

  it('바이트가 0이어도 hex 자리수가 줄지 않는다', () => {
    expect(generateSlug(() => new Uint8Array([0, 0, 0, 0]))).toBe('mango-000000');
    expect(generateSlug(() => new Uint8Array([0, 1, 2, 3]))).toBe('mango-010203');
  });
});

describe('slugToCode — 화상 통화로 불러주는 표기', () => {
  it('대문자로 바꾼 같은 값이다', () => {
    expect(slugToCode('mango-7b2k9f')).toBe('MANGO-7B2K9F');
    expect(isCode(slugToCode('mango-7b2c9f'))).toBe(true);
  });

  it('코드를 다시 slug로 되돌릴 수 있다', () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug();
      expect(normalizeCode(slugToCode(slug))).toBe(slug);
    }
  });
});

describe('normalizeCode — 기기가 바뀐 사람의 유일한 통로 (PRD §14)', () => {
  it('제대로 입력한 코드를 받는다', () => {
    expect(normalizeCode('MANGO-7B2C9F')).toBe('mango-7b2c9f');
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(normalizeCode('  MANGO-7B2C9F  ')).toBe('mango-7b2c9f');
  });

  it('소문자로 입력해도 된다', () => {
    expect(normalizeCode('mango-7b2c9f')).toBe('mango-7b2c9f');
  });

  it('하이픈을 빼먹어도 알아본다', () => {
    expect(normalizeCode('MANGO7B2C9F')).toBe('mango-7b2c9f');
  });

  it('하이픈 대신 공백을 넣어도 알아본다', () => {
    expect(normalizeCode('MANGO 7B2C9F')).toBe('mango-7b2c9f');
  });

  it('하이픈을 여러 개 넣어도 알아본다', () => {
    expect(normalizeCode('MANGO--7B2C-9F')).toBe('mango-7b2c9f');
  });

  it('단어 목록에 없는 단어도 받는다 — 목록을 늘려도 옛 링크가 살아 있어야 한다', () => {
    expect(normalizeCode('BANANA-ABC123')).toBe('banana-abc123');
  });

  it('알아볼 수 없으면 null을 준다', () => {
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode('MANGO')).toBeNull(); // hex가 없다
    expect(normalizeCode('MANGO-7B2K')).toBeNull(); // 4자리는 우리 형식이 아니다
    expect(normalizeCode('MANGO-7B2K9G')).toBeNull(); // K, G는 hex가 아니다
    expect(normalizeCode('7B2C9F')).toBeNull(); // 단어가 없다
    expect(normalizeCode('!!!!!!!!')).toBeNull();
  });

  it('목업에 적힌 4자리 코드는 거부된다 — PRD §14가 6자리로 바꾸라고 했다', () => {
    expect(normalizeCode('MANGO-7B2K')).toBeNull();
  });
});

describe('teamUrl', () => {
  it('조 링크 전체 주소를 만든다', () => {
    expect(teamUrl('mango-7b2c9f', 'https://groo.app')).toBe('https://groo.app/t/mango-7b2c9f');
  });

  it('끝에 슬래시가 붙어 있어도 두 번 겹치지 않는다', () => {
    expect(teamUrl('mango-7b2c9f', 'https://groo.app/')).toBe('https://groo.app/t/mango-7b2c9f');
  });
});

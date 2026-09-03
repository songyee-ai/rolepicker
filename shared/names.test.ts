import { describe, expect, it } from 'vitest';
import {
  cleanName,
  findDuplicateNames,
  formatRoster,
  hasDuplicateNames,
  initialOf,
  MAX_NAME_LENGTH,
  parseNameList,
} from './names';

describe('cleanName — 입력 정리 (PRD §14)', () => {
  it('앞뒤 공백을 없앤다', () => {
    expect(cleanName('  김민지  ')).toBe('김민지');
  });

  it('줄바꿈과 탭을 없앤다 — 붙여넣기에 섞여 들어온다', () => {
    expect(cleanName('김민지\n')).toBe('김민지');
    expect(cleanName('\t박준혁\t')).toBe('박준혁');
    expect(cleanName('김\n민지')).toBe('김 민지');
  });

  it('이어진 공백은 하나로 줄인다', () => {
    expect(cleanName('김   민지')).toBe('김 민지');
  });

  it(MAX_NAME_LENGTH + '자를 넘으면 자른다', () => {
    const long = '가나다라마바사아자차카타파하';
    expect([...cleanName(long)]).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName(long)).toBe('가나다라마바사아자차카타');
  });

  it('공백만 있으면 빈 문자열 — 저장하지 않는다는 뜻', () => {
    expect(cleanName('   ')).toBe('');
    expect(cleanName('\n\t')).toBe('');
    expect(cleanName('')).toBe('');
  });

  it('이모지가 반토막 나지 않는다', () => {
    // 이모지 13개 -> 12개로 잘리되 깨진 글자가 남지 않는다
    const emojis = '🙋'.repeat(13);
    const cut = cleanName(emojis);
    expect([...cut]).toHaveLength(MAX_NAME_LENGTH);
    expect(cut).toBe('🙋'.repeat(MAX_NAME_LENGTH));
  });
});

describe('initialOf — 원형에 넣을 한 글자 (PRD §14)', () => {
  it('한글 3자는 두 번째 글자 — 목업의 규칙', () => {
    expect(initialOf('김민지')).toBe('민');
    expect(initialOf('박준혁')).toBe('준');
    expect(initialOf('이서연')).toBe('서');
    expect(initialOf('최태윤')).toBe('태');
    expect(initialOf('정하늘')).toBe('하');
  });

  it('한글 2자도 두 번째 글자', () => {
    expect(initialOf('김구')).toBe('구');
  });

  it('한글 1자는 그 글자', () => {
    expect(initialOf('강')).toBe('강');
  });

  it('한글 4자 이상도 두 번째 글자', () => {
    expect(initialOf('남궁민수')).toBe('궁');
    // 동명이인 구분용 접미사가 붙어도 규칙은 같다
    expect(initialOf('김민지A')).toBe('민');
  });

  it('영문은 첫 글자 대문자', () => {
    expect(initialOf('john')).toBe('J');
    expect(initialOf('John')).toBe('J');
    expect(initialOf('JOHN')).toBe('J');
    expect(initialOf('anna kim')).toBe('A');
  });

  it('숫자나 기호로 시작하면 첫 글자를 그대로', () => {
    expect(initialOf('1호')).toBe('1');
    expect(initialOf('🙋 손님')).toBe('🙋');
  });

  it('★ 어떤 입력에도 빈 문자열이 되지 않는다', () => {
    const inputs = ['', '   ', '\n', '\t\t', '김민지', 'a', '1', '🙋', '  \n  \t '];
    for (const input of inputs) {
      expect(initialOf(input).length).toBeGreaterThan(0);
    }
    expect(initialOf('')).toBe('?');
  });

  it('같은 이니셜이 나오는 경우가 실제로 있다 — 화면에서 눌러 확인하는 처리가 필수', () => {
    // PRD §14가 지적한 케이스. 원형만 나열하는 4명 이상 모드에서 구분이 안 된다
    expect(initialOf('김민지')).toBe(initialOf('이민수'));
  });
});

describe('parseNameList — 여러 줄 붙여넣기 (PRD §6 S2, §14)', () => {
  it('줄바꿈으로 나눈다', () => {
    expect(parseNameList('김민지\n박준혁\n이서연')).toEqual(['김민지', '박준혁', '이서연']);
  });

  it('쉼표와 탭도 구분자로 인정한다', () => {
    expect(parseNameList('김민지, 박준혁, 이서연')).toEqual(['김민지', '박준혁', '이서연']);
    expect(parseNameList('김민지\t박준혁')).toEqual(['김민지', '박준혁']);
  });

  it('가운뎃점도 나눈다 — 우리 화면이 조원을 그렇게 보여주므로 되붙일 수 있다', () => {
    expect(parseNameList('김민지 · 박준혁 · 이서연')).toEqual(['김민지', '박준혁', '이서연']);
  });

  it('앞에 붙은 번호를 떼어낸다', () => {
    expect(parseNameList('1. 김민지\n2. 박준혁')).toEqual(['김민지', '박준혁']);
    expect(parseNameList('1) 김민지\n2) 박준혁')).toEqual(['김민지', '박준혁']);
    expect(parseNameList('1 - 김민지')).toEqual(['김민지']);
  });

  it('불릿 기호를 떼어낸다', () => {
    expect(parseNameList('- 김민지\n- 박준혁')).toEqual(['김민지', '박준혁']);
    expect(parseNameList('• 김민지')).toEqual(['김민지']);
  });

  it('빈 줄과 공백 줄은 버린다', () => {
    expect(parseNameList('김민지\n\n\n   \n박준혁\n')).toEqual(['김민지', '박준혁']);
  });

  it('중복을 지우지 않는다 — 동명이인은 막는 게 아니라 알려주는 대상이다', () => {
    expect(parseNameList('김민지\n박준혁\n김민지')).toEqual(['김민지', '박준혁', '김민지']);
  });

  it('인원 상한을 여기서 자르지 않는다 — 몇 명이 넘었는지 화면이 알려줘야 한다', () => {
    const many = Array.from({ length: 20 }, (_, i) => '이름' + i).join('\n');
    expect(parseNameList(many)).toHaveLength(20);
  });

  it('실제로 붙여넣을 만한 지저분한 명단을 처리한다', () => {
    const pasted = `
      1. 김민지
      2. 박준혁
      3. 이서연

      4) 최태윤
      - 정하늘
    `;
    expect(parseNameList(pasted)).toEqual(['김민지', '박준혁', '이서연', '최태윤', '정하늘']);
  });

  it('아무것도 없으면 빈 목록', () => {
    expect(parseNameList('')).toEqual([]);
    expect(parseNameList('\n\n , , \t')).toEqual([]);
  });
});

describe('findDuplicateNames — 동명이인 안내 (PRD §6 S2)', () => {
  it('같은 이름의 위치를 알려준다 — 화면에서 그 행을 강조한다', () => {
    const groups = findDuplicateNames(['김민지', '박준혁', '김민지', '최태윤']);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('김민지');
    expect(groups[0].indexes).toEqual([0, 2]);
  });

  it('세 명 이상 겹쳐도 한 묶음으로', () => {
    const groups = findDuplicateNames(['김민지', '김민지', '김민지']);
    expect(groups[0].indexes).toEqual([0, 1, 2]);
  });

  it('겹치는 이름이 여러 종류면 각각 알려준다', () => {
    const groups = findDuplicateNames(['김민지', '박준혁', '김민지', '박준혁']);
    expect(groups).toHaveLength(2);
  });

  it('대소문자와 공백 차이는 같은 이름으로 본다', () => {
    expect(hasDuplicateNames(['John', 'john'])).toBe(true);
    expect(hasDuplicateNames(['김 민지', '김민지'])).toBe(true);
  });

  it('구분해서 적어주면 안내가 사라진다 — 안내가 노리는 결과', () => {
    expect(hasDuplicateNames(['김민지A', '김민지B'])).toBe(false);
  });

  it('빈 이름은 중복으로 세지 않는다 — 아직 입력하지 않은 칸이 여럿일 수 있다', () => {
    expect(findDuplicateNames(['', '', '김민지'])).toEqual([]);
  });

  it('겹치는 이름이 없으면 빈 목록', () => {
    expect(findDuplicateNames(['김민지', '박준혁', '이서연'])).toEqual([]);
  });
});

describe('formatRoster', () => {
  it('첫 화면 최근 조 목록에 쓰는 한 줄 (PRD §6 S0)', () => {
    expect(formatRoster(['김민지', '박준혁', '이서연', '정하늘'])).toBe(
      '김민지 · 박준혁 · 이서연 · 정하늘',
    );
  });
});

/**
 * 이름 다루기. (PRD §14 "이름 처리")
 *
 * 화면과 서버가 똑같은 규칙을 써야 하므로 shared에 둔다.
 * 화면에서 통과한 이름이 서버에서 거부되면 사용자는 이유를 알 수 없다.
 */

/** 이름 길이 상한 (PRD §14) */
export const MAX_NAME_LENGTH = 12;

/** 조 인원 상한. 넘기면 조를 나누라고 안내한다 (PRD §11) */
export const MAX_MEMBERS = 12;

/** 이니셜을 만들 수 없을 때 쓰는 글자. 원형이 빈칸이 되는 것만은 막는다 (PRD §14) */
const INITIAL_FALLBACK = '?';

const HANGUL_SYLLABLE = /[가-힣]/;
const LATIN_LETTER = /[A-Za-z]/;

/** 붙여넣기 구분자: 줄바꿈, 쉼표, 탭, 세미콜론, 가운뎃점 */
const SEPARATORS = /[\r\n,\t;·]+/;

/**
 * 줄 앞에 붙어 오는 번호와 기호를 떼어낸다.
 * 채팅방 명단은 "1. 김민지", "1) 김민지", "- 김민지" 같은 모양으로 온다 (PRD §14)
 */
const LEADING_MARKER = /^\s*(?:\d{1,3}\s*[.)\-:\]]\s*|[-*•‣▪]\s*)/;

/**
 * 이름 앞뒤를 정리한다.
 * - 앞뒤 공백 제거
 * - 줄바꿈·탭은 공백으로 바꾸고, 이어진 공백은 하나로 줄인다
 * - 12자를 넘으면 자른다
 *
 * 정리 결과가 빈 문자열이면 저장하지 않는다는 뜻이다.
 */
export function cleanName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  // 글자 수는 코드포인트로 센다. 이모지가 반토막 나지 않게
  const characters = [...collapsed];
  return characters.length <= MAX_NAME_LENGTH
    ? collapsed
    : characters.slice(0, MAX_NAME_LENGTH).join('');
}

/**
 * 원형에 넣을 한 글자를 뽑는다. (PRD §14)
 *
 * - 한글 2자 이상: 두 번째 글자 ("김민지" -> "민")
 * - 한글 1자: 그 글자
 * - 영문: 첫 글자 대문자
 * - 그 외: 첫 글자
 *
 * 어떤 입력에도 빈 문자열을 돌려주지 않는다.
 * "김민지"와 "이민수"처럼 이니셜이 같아지는 경우가 있으므로,
 * 원형만 나열하는 화면에서는 눌러서 이름을 볼 수 있어야 하고
 * aria-label에 전체 이름을 넣어야 한다 (PRD §14).
 */
export function initialOf(name: string): string {
  const characters = [...cleanName(name)];
  if (characters.length === 0) return INITIAL_FALLBACK;

  const first = characters[0];

  if (HANGUL_SYLLABLE.test(first)) {
    return characters.length >= 2 ? characters[1] : first;
  }
  if (LATIN_LETTER.test(first)) {
    return first.toUpperCase();
  }
  return first;
}

/**
 * 여러 줄 붙여넣기를 이름 목록으로 만든다. (PRD §5 S2, §14)
 *
 * 중복은 지우지 않는다. 동명이인은 막는 게 아니라 알려주는 대상이라서다 (PRD §6 S2).
 * 인원 상한도 여기서 자르지 않는다. 몇 명이 넘었는지 화면이 알려줘야 한다.
 */
export function parseNameList(raw: string): string[] {
  return raw
    .split(SEPARATORS)
    .map((piece) => cleanName(piece.replace(LEADING_MARKER, '')))
    .filter((name) => name.length > 0);
}

/**
 * 비교용 이름. 대소문자와 공백 차이는 같은 이름으로 본다.
 * "John"과 "john", "김 민지"와 "김민지"를 각각 한 사람으로 취급한다.
 */
function comparableName(name: string): string {
  return cleanName(name).replace(/\s+/g, '').toLowerCase();
}

export interface DuplicateNameGroup {
  /** 처음 나온 표기 그대로 */
  name: string;
  /** 입력 목록에서의 위치. 화면에서 해당 행을 강조하는 데 쓴다 */
  indexes: number[];
}

/**
 * 같은 이름이 둘 이상 있는 묶음을 찾는다. (PRD §6 S2)
 * 막지는 않고 안내만 한다. 결과 화면에 "김민지"만 뜨면 누가 이끄미인지 알 수 없어서다.
 */
export function findDuplicateNames(names: string[]): DuplicateNameGroup[] {
  const seen = new Map<string, DuplicateNameGroup>();

  names.forEach((name, index) => {
    const key = comparableName(name);
    if (key.length === 0) return;
    const group = seen.get(key);
    if (group) {
      group.indexes.push(index);
    } else {
      seen.set(key, { name: cleanName(name), indexes: [index] });
    }
  });

  return [...seen.values()].filter((group) => group.indexes.length > 1);
}

export function hasDuplicateNames(names: string[]): boolean {
  return findDuplicateNames(names).length > 0;
}

/** 조원 이름을 한 줄로. 첫 화면의 최근 조 목록에 쓴다 (PRD §6 S0) */
export function formatRoster(names: string[]): string {
  return names.join(' · ');
}

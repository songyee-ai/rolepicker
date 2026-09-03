/**
 * 최근 사용한 조 목록. 브라우저에만 저장하고 서버에는 보내지 않는다 (PRD §8).
 *
 * 시크릿 모드나 기기 변경이면 이 목록이 비어 있다. 그래서 첫 화면에는
 * 코드 입력 통로가 항상 보여야 한다 (PRD §14).
 *
 * localStorage 는 읽기와 쓰기 모두 예외를 던질 수 있다(저장 공간 차단 설정 등).
 * 전부 try/catch 로 감싸고, 실패하면 목록이 없는 것처럼 동작한다.
 */

const KEY = 'groo.recent-teams.v1';
const MAX = 5;

export interface RecentTeam {
  slug: string;
  /** 'YYYY-MM-DD' */
  lastUsedAt: string;
  /** 마지막에 이끄미를 맡은 그루 이름. 조를 구분하는 기준이다 (PRD §6 S0) */
  lastLeadName: string | null;
  memberNames: string[];
}

const EMPTY: RecentTeam[] = [];

function isRecentTeam(value: unknown): value is RecentTeam {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.slug === 'string' &&
    typeof item.lastUsedAt === 'string' &&
    Array.isArray(item.memberNames)
  );
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): RecentTeam[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const list = parsed.filter(isRecentTeam).slice(0, MAX);
    return list.length === 0 ? EMPTY : list;
  } catch {
    return EMPTY;
  }
}

export function listRecentTeams(): RecentTeam[] {
  return parse(readRaw());
}

/** 최근 사용순으로 맨 앞에 올린다. 같은 조는 하나만 남는다 */
export function rememberTeam(entry: RecentTeam): void {
  try {
    const others = listRecentTeams().filter((item) => item.slug !== entry.slug);
    window.localStorage.setItem(KEY, JSON.stringify([entry, ...others].slice(0, MAX)));
  } catch {
    // 저장하지 못해도 서비스는 그대로 돌아간다. 링크와 코드로 들어올 수 있다
  }
}

export function forgetTeam(slug: string): void {
  try {
    const next = listRecentTeams().filter((item) => item.slug !== slug);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 무시
  }
}

// ─── React가 읽는 창구 ────────────────────────────────────────────
//
// 이 목록은 브라우저에만 있어서 서버에서 미리 그릴 수 없다.
// useSyncExternalStore 로 읽으면 화면이 "서버 모양 -> 브라우저 모양"으로
// 한 번 정리되면서, 겉모습이 어긋났다는 오류가 나지 않는다.

let cachedRaw: string | null = null;
let cached: RecentTeam[] = EMPTY;

/** 내용이 같으면 같은 배열을 돌려줘야 한다. 매번 새 배열을 주면 무한히 다시 그린다 */
export function recentTeamsSnapshot(): RecentTeam[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = parse(raw);
  return cached;
}

/** 서버에서 그릴 때는 목록이 없는 상태로 본다 */
export function recentTeamsServerSnapshot(): RecentTeam[] {
  return EMPTY;
}

/** 다른 탭에서 조를 열면 이 탭의 목록도 따라 바뀐다 */
export function subscribeRecentTeams(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

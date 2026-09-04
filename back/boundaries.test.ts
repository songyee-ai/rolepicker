/**
 * 폴더 경계와 비밀값 취급을 검사한다.
 *
 * 이 파일은 로직이 아니라 구조를 지킨다. "화면 코드에서 서버 키를 만지지 말자"는
 * 약속을 사람이 기억하는 대신 검사가 기억한다. 실수로 선을 넘으면 npm test가
 * 실패하므로, 잘못된 코드가 깃허브까지 올라가지 않는다.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.css']);

function collectFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return []; // 아직 없는 폴더는 건너뛴다
  }

  return entries.flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const relative = path.join(dir, entry);
    if (statSync(path.join(ROOT, relative)).isDirectory()) {
      return collectFiles(relative);
    }
    return SOURCE_EXTENSIONS.has(path.extname(entry)) ? [relative] : [];
  });
}

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

/**
 * 주석을 걷어낸 코드만 남긴다.
 * 주석에는 "NEXT_PUBLIC_ 을 붙이지 마라" 같은 설명이 들어 있어서,
 * 그대로 검사하면 설명문이 위반으로 잡힌다.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .filter((line) => !line.trim().startsWith('*'))
    .join('\n');
}

const toPosix = (value: string) => value.split(path.sep).join('/');

describe('폴더 경계', () => {
  it('front은 back을 불러올 수 없다 — 서버 코드가 브라우저 번들에 섞이면 안 된다', () => {
    const offenders = collectFiles('front').filter((file) => {
      const source = read(file);
      return /from\s+['"](@\/back\/|\.\.\/back\/|\.\.\/\.\.\/back\/)/.test(source);
    });
    expect(offenders.map(toPosix)).toEqual([]);
  });

  it('shared는 front도 back도 불러오지 않는다 — 양쪽이 같이 쓰는 것만 둔다', () => {
    const offenders = collectFiles('shared').filter((file) => {
      const source = read(file);
      return /from\s+['"](@\/back\/|@\/front\/|\.\.\/back\/|\.\.\/front\/)/.test(source);
    });
    expect(offenders.map(toPosix)).toEqual([]);
  });

  it('app 폴더에는 로직을 두지 않는다 — 주소를 가리키는 껍데기만', () => {
    const routeFiles = collectFiles('app').filter((file) => /route\.tsx?$/.test(file));
    expect(routeFiles.length).toBeGreaterThan(0);

    for (const file of routeFiles) {
      const lines = read(file)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('//'));
      // import 몇 줄 + export 몇 줄이면 충분하다
      expect(lines.length, toPosix(file) + ' 이 너무 길다').toBeLessThanOrEqual(8);
    }
  });
});

describe('비밀값 취급 (PRD §12)', () => {
  const SECRET_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE'];

  it('서버 키는 back 폴더 밖에서 언급되지 않는다', () => {
    const outside = [
      ...collectFiles('front'),
      ...collectFiles('shared'),
      ...collectFiles('app'),
    ];

    for (const file of outside) {
      if (file.endsWith('.test.ts')) continue;
      const source = codeOnly(read(file));
      for (const secret of SECRET_NAMES) {
        expect(source, toPosix(file) + ' 에 ' + secret + ' 이 있다').not.toContain(secret);
      }
    }
  });

  it('NEXT_PUBLIC_ 이 붙은 설정값이 하나도 없다 — 붙이면 브라우저 번들에 심긴다', () => {
    const all = [
      ...collectFiles('front'),
      ...collectFiles('back'),
      ...collectFiles('shared'),
      ...collectFiles('app'),
    ];

    for (const file of all) {
      if (file.endsWith('.test.ts')) continue;
      expect(codeOnly(read(file)), toPosix(file)).not.toContain('NEXT' + '_PUBLIC_');
    }
  });

  it('.env 파일은 깃허브로 나가지 않는다', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/^\.env\*$/m);
    // 값이 비어 있는 예시 파일만 예외로 올린다
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it('예시 설정 파일에는 실제 값이 들어 있지 않다', () => {
    const example = read('.env.example');
    for (const line of example.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [, value] = line.split('=');
      expect(value.trim(), line).toBe('');
    }
  });

  it('DB 접근 파일은 server-only로 잠겨 있다', () => {
    for (const file of collectFiles('back')) {
      if (file.endsWith('.test.ts')) continue;
      const source = read(file);
      // 순수 계산만 하는 파일은 제외. DB나 설정을 만지는 파일은 반드시 잠근다
      const touchesServerStuff =
        source.includes('process.env') ||
        source.includes('@supabase/supabase-js') ||
        /from\s+['"]\.{1,2}\/(env|supabase)['"]/.test(source) ||
        /from\s+['"]\.{1,2}\/db\//.test(source);

      if (touchesServerStuff) {
        expect(source, toPosix(file) + ' 에 server-only 가 없다').toContain("import 'server-only'");
      }
    }
  });
});

describe('화면 규칙 (PRD §11, §17)', () => {
  const screens = [...collectFiles('front'), ...collectFiles('app')].filter(
    (file) => !file.endsWith('.test.ts'),
  );

  it('★ 에러 문구는 사과하지 않는다 — 무엇이 잘못됐고 어떻게 하면 되는지 적는다', () => {
    // PRD §17. 사용자가 잘못한 게 아닌데 서비스가 사과하면 원인이 흐려진다
    const sources = [...screens, ...collectFiles('back'), ...collectFiles('shared')].filter(
      (file) => !file.endsWith('.test.ts'),
    );
    for (const file of sources) {
      const code = codeOnly(read(file));
      for (const word of ['죄송', '미안', '실패했습니다', '오류가 발생']) {
        expect(code, toPosix(file) + ' 에 "' + word + '" 이 있다').not.toContain(word);
      }
    }
  });

  it('★ 명단 화면에 별도 스크롤을 만들지 않는다 (PRD §11)', () => {
    // 스크롤 영역이 두 개면 모바일에서 손가락이 어디를 잡았는지에 따라
    // 엉뚱하게 움직이고, 명단 일부가 화면 밖에 숨어 참여 상태 확인이 어려워진다
    for (const file of screens) {
      const code = codeOnly(read(file));
      for (const cls of ['overflow-auto', 'overflow-y-auto', 'overflow-scroll', 'overflow-y-scroll']) {
        expect(code, toPosix(file) + ' 에 ' + cls + ' 이 있다').not.toContain(cls);
      }
    }
  });

  it('★ 높이는 100vh 가 아니라 100dvh (PRD §11)', () => {
    // 모바일 브라우저 주소창 때문에 100vh 는 실제 화면보다 크다
    for (const file of [...screens, ...collectFiles('app')]) {
      const code = codeOnly(read(file));
      for (const cls of ['min-h-screen', 'h-screen', '100vh']) {
        expect(code, toPosix(file) + ' 에 ' + cls + ' 이 있다').not.toContain(cls);
      }
    }
    // 화면 껍데기는 dvh 를 쓴다
    expect(read('front/ui/kit.tsx')).toContain('min-h-dvh');
  });

  it('움직임을 원하지 않는 사용자를 위한 처리가 있다 (PRD §13)', () => {
    expect(read('app/globals.css')).toContain('prefers-reduced-motion');
    // 뽑기 연출은 그 설정이면 아예 생략한다 (PRD §6 S4)
    expect(read('front/screens/DrawScreen.tsx')).toContain('prefers-reduced-motion');
  });

  it('디자인 토큰 밖의 색을 함부로 만들지 않는다 (PRD §13)', () => {
    // 목업에 있던 값만 임의 색으로 허용한다. 새 색이 필요하면 먼저 물어본다
    const allowed = new Set([
      '#EEF9CE', '#DEF4A0', '#EAF5FF', '#CDE8FF', // 지난 기록 색 농도 (목업 09)
      '#EDECE5', '#E9E8E1', '#CFCEC6', '#D5D4CC', '#DCEBB2', '#F5D9B8', '#FBFFEF', // 목업 회색·강조
      '#141A24', '#0E1520', '#242E3C', '#232D3B', '#2E3846', '#1C2431', // 다크 화면 (목업 08)
      '#93A0B0', '#8B98A8', '#5E6B7C', '#6B7889', '#F2F4F7', // 다크 화면 글자
      // 아이콘과 브라우저 테마 색은 CSS 토큰을 참조할 수 없어 값으로 적는다.
      // 셋 다 PRD §13의 --ink / --lime / --paper 와 같은 값이다
      '#17202E', '#C7F04A', '#FDFCF9',
    ]);
    // globals.css 는 토큰을 정의하는 자리다. 거기 적힌 색은 검사 대상이 아니다
    const used = new Set<string>();
    for (const file of screens.filter((name) => name.endsWith('.tsx'))) {
      for (const match of codeOnly(read(file)).matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
        used.add(match[0].toUpperCase());
      }
    }
    const unknown = [...used].filter((color) => !allowed.has(color));
    expect(unknown, '목업에 없는 색이 생겼다: ' + unknown.join(', ')).toEqual([]);
  });
});

describe('SQL 스키마와 코드가 어긋나지 않는다', () => {
  const sql = read('supabase/migrations/0001_init.sql');

  it('모든 테이블에 RLS가 켜져 있다', () => {
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);

    for (const table of tables) {
      const pattern = new RegExp(`alter table public\\.${table}\\s+enable row level security`);
      expect(sql, table + ' 에 RLS가 없다').toMatch(pattern);
    }
  });

  it('브라우저 역할의 권한을 회수한다', () => {
    expect(sql).toMatch(/revoke all on all tables in schema public from anon, authenticated/);
    expect(sql).toContain('deny_browser_access');
  });

  it('하루 한 배정을 DB가 보장한다 (PRD §8)', () => {
    expect(sql).toMatch(/unique \(team_id, date\)/);
  });

  it('한 사람이 하루에 두 역할을 갖지 못하게 DB도 막는다 (PRD §7-4)', () => {
    expect(sql).toMatch(/primary key \(assignment_id, member_id\)/);
  });
});

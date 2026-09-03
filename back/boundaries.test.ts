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

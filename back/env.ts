/**
 * 서버 전용 설정값. (PRD §12)
 *
 * 첫 줄의 'server-only'가 안전장치다. 이 파일을 화면 쪽 코드에서 실수로
 * 불러오면 빌드가 그 자리에서 실패한다. 키가 브라우저로 새는 사고를
 * 사람의 주의력이 아니라 도구가 막는다.
 *
 * 키는 .env.local 에만 둔다. 그 파일은 .gitignore에 있어서 깃허브로 나가지 않는다.
 * 이름에 NEXT_PUBLIC_ 을 붙이지 않는 것도 규칙이다. 붙이면 Next.js가
 * 그 값을 브라우저 번들에 심는다.
 */

import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `설정값 ${name} 이 비어 있습니다. .env.local 파일에 채워주세요. ` +
        `보기: .env.example`,
    );
  }
  return value.trim();
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * 함수로 감싼 이유: 파일을 불러오는 순간이 아니라 실제로 DB를 쓰는 순간에
 * 검사한다. 그래야 Supabase를 아직 안 붙인 상태에서도 npm test와
 * 빌드가 돌아간다.
 */
export function supabaseConfig(): SupabaseConfig {
  return {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

/** 설정이 준비됐는지. 화면에 "DB 연결 전"이라고 알려줄 때 쓴다 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 링크 배너에 쓸 사이트 주소. 없으면 요청 헤더에서 알아낸다 */
export function siteOrigin(fallback: string): string {
  return process.env.SITE_ORIGIN?.trim() || fallback;
}

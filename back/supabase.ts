/**
 * Supabase 접속. 서버에서만 쓴다. (PRD §12)
 *
 * service_role 키는 RLS를 우회하는 열쇠다. 브라우저에 절대 내보내지 않는다.
 * DB의 모든 테이블은 RLS가 켜져 있고 브라우저 역할(anon)은 거부되므로,
 * 설령 키가 아니라 주소만 새더라도 브라우저에서 읽을 수 있는 것이 없다.
 * (supabase/migrations/0001_init.sql)
 */

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './env';

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const { url, serviceRoleKey } = supabaseConfig();
  cached = createClient(url, serviceRoleKey, {
    auth: {
      // 로그인이 없는 서비스다. 세션을 만들지도, 새로 고치지도 않는다
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}

/** Postgres unique 제약 위반 */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

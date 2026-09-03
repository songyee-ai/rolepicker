/**
 * DB 한 줄의 모양.
 *
 * Supabase는 스키마에서 타입을 자동 생성해주는 기능이 있지만, 그건 실제
 * 프로젝트에 접속해야 만들어진다. 그때까지는 supabase/migrations/0001_init.sql
 * 과 짝이 맞는 이 파일을 손으로 관리한다. SQL을 고치면 여기도 고친다.
 *
 * DB는 snake_case, 화면은 camelCase를 쓴다. 변환은 back/db 안에서만 한다.
 */

import 'server-only';

export interface TeamRow {
  id: string;
  slug: string;
  code: string;
  created_at: string;
}

export interface MemberRow {
  id: string;
  team_id: string;
  name: string;
  order_index: number;
  active: boolean;
  created_at: string;
}

export interface RoleRow {
  id: string;
  team_id: string;
  key: string;
  name: string;
  description: string;
  emoji: string;
  priority: number;
  is_default: boolean;
}

export interface AssignmentRow {
  id: string;
  team_id: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentItemRow {
  assignment_id: string;
  role_id: string;
  member_id: string;
}

export interface AttendanceRow {
  assignment_id: string;
  member_id: string;
  present: boolean;
}

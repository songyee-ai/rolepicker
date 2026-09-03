/**
 * 화면과 서버가 주고받는 값의 모양.
 *
 * 서버가 만들어 보내는 형태를 화면이 그대로 그린다. 화면에서 계산해야 하는
 * 것을 줄이는 게 목적이다. 특히 이니셜과 이름은 서버가 채워 보낸다.
 */

import type { DateStr } from './date';

/** 조원이 명단에서 지워진 뒤에도 지난 기록에 남아 있는 경우 (PRD §14) */
export const DELETED_MEMBER_NAME = '(삭제된 그루)';

export interface MemberRef {
  id: string;
  name: string;
  /** 원형에 넣는 한 글자 */
  initial: string;
}

export interface MemberView extends MemberRef {
  orderIndex: number;
  /** 조를 떠난 경우 false. 그날 빈자리와는 무관하다 */
  active: boolean;
}

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string;
  emoji: string;
  priority: number;
  isDefault: boolean;
}

export interface AssignedRole {
  role: RoleView;
  member: MemberRef;
}

export interface AssignmentView {
  date: DateStr;
  /** priority 순. 이끄미 -> 시간지키미 */
  assigned: AssignedRole[];
  /** 뽑히지 않은 참여자 (PRD §7-5) */
  groos: MemberRef[];
  /** 그날 빈자리였던 그루. 인원수가 아니라 이름으로 보여준다 (PRD §6 S3) */
  absent: MemberRef[];
  /** 사람이 부족해 비운 역할 */
  unfilledRoles: RoleView[];
  updatedAt: string;
}

export interface TeamView {
  slug: string;
  code: string;
  createdAt: string;
  /** 만든 날에만 링크 배너를 띄운다 (PRD §6 S3) */
  createdToday: boolean;
  members: MemberView[];
  roles: RoleView[];
  /** 오늘 배정. 있으면 화면이 결과(S5)로 바로 간다 (PRD §6 S3) */
  today: AssignmentView | null;
}

// ─── 요청 본문 ────────────────────────────────────────────────────

export interface CreateTeamRequest {
  names: string[];
}

export interface CreateTeamResponse {
  slug: string;
  code: string;
  url: string;
}

export interface SaveMembersRequest {
  members: {
    /** 기존 조원이면 id, 새로 추가하는 조원이면 없음 */
    id?: string;
    name: string;
  }[];
}

export interface AssignRequest {
  presentMemberIds: string[];
}

export interface ResolveResponse {
  slug: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}

/**
 * 화면과 서버가 주고받는 값의 모양.
 *
 * 서버가 만들어 보내는 형태를 화면이 그대로 그린다. 화면에서 계산해야 하는
 * 것을 줄이는 게 목적이다. 특히 이니셜과 이름은 서버가 채워 보낸다.
 */

import type { DateStr } from './date';
import type { TimerSession } from './timer';

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
  /** 타이머 세션이 이 배정에 붙는다 (PRD §8) */
  id: string;
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
  /** 지금 타이머가 돌고 있으면 그 단계. 아니면 null */
  timer: TimerSummary | null;
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

// ─── 타이머 (M2) ──────────────────────────────────────────────────

/** 그날의 학습·쉬는 시간 약속. 조 전체가 같은 값을 본다 */
export interface TimerPlan {
  studySec: number;
  breakSec: number;
}

export interface TimerStateView {
  /** 아직 타이머를 준비하지 않은 날이면 null */
  plan: TimerPlan | null;
  /** 이 배정의 모든 세션. 누적 계산에 쓴다 */
  sessions: TimerSession[];
  /** 진행 중인 세션. 없으면 다음 단계를 기다리는 상태 */
  current: TimerSession | null;
  totalStudySec: number;
  studyCount: number;
  /**
   * 서버 시각. 클라이언트 시계가 틀어져 있어도 남은 시간이 맞도록,
   * 화면은 (서버 시각 − 내 시각)만큼 보정해서 쓴다 (PRD §10).
   */
  serverNow: string;
}

export interface StartSessionRequest {
  kind: 'study' | 'break';
  /** 처음 시작할 때만 보낸다. 그날의 약속을 저장한다 */
  plan?: TimerPlan;
}

export interface PatchSessionRequest {
  action: 'pause' | 'resume' | 'end';
}

/**
 * 지금 타이머가 돌고 있는지. 결과 화면이 이걸 보고 버튼을 바꾼다.
 * 남은 시간까지 담지 않는다 — 결과 화면은 시계가 아니다.
 */
export interface TimerSummary {
  kind: 'study' | 'break';
  paused: boolean;
}

// ─── 지난 기록 (M3) ───────────────────────────────────────────────

export interface HistoryRow {
  member: MemberRef;
  /** roleId -> 이 기간에 맡은 횟수 */
  counts: Record<string, number>;
}

/** 한 번도 그 역할을 맡지 않은 그루들 */
export interface NeverHeldRole {
  role: RoleView;
  members: MemberRef[];
}

export interface StudyStats {
  totalSec: number;
  /** 타이머를 켠 날 수 */
  studiedDays: number;
  /** 켠 날로만 나눈 하루 평균 */
  averageSec: number;
  best: { date: DateStr; sessions: number; sec: number } | null;
}

export interface HistoryView {
  days: number;
  from: DateStr;
  to: DateStr;
  /** 이 기간에 뽑기 기록이 있는 날 수 */
  recordedDays: number;
  /** 이 조가 만들어진 뒤 지난 날 수 */
  teamAgeDays: number;
  roles: RoleView[];
  rows: HistoryRow[];
  /**
   * 표는 지난 14일을 보여주지만 이 목록은 **전체 기간** 기준이다.
   * 14일 안에만 0이고 그 전에 맡았다면 다음 뽑기에서 먼저 후보가 되지 않는다.
   * 화면의 안내 문장이 거짓이 되지 않게 하려는 구분이다.
   */
  neverHeld: NeverHeldRole[];
  study: StudyStats;
}

/**
 * 배정 저장과 읽기. (PRD §9 assign / reroll)
 *
 * 여기서 신경 쓰는 것 두 가지.
 *
 * 1) 멱등 (PRD §9, §14)
 *    조원 5명이 동시에 '역할 뽑기'를 누른다. DB의 unique (team_id, date)가
 *    하루 한 줄을 보장하고, 먼저 들어간 요청의 결과를 모두가 받는다.
 *    500을 내보내지 않는다.
 *
 * 2) 자기 복구
 *    줄만 만들고 내용을 못 채운 채 실패한 요청이 있으면, 다음 요청이
 *    빈 줄을 발견해서 채운다. 빈 결과 화면이 남지 않는다.
 */

import 'server-only';
import { assign, AssignError, type HistoryEntry, type Pick, type Role } from '../assign';
import { ApiError } from '../errors';
import { db } from '../supabase';
import { loadMembers, loadRoles, toRoleView } from './teams';
import type { AssignmentItemRow, AssignmentRow, AttendanceRow, MemberRow, RoleRow, TeamRow } from './rows';
import { addDays, type DateStr } from '@/shared/date';
import { initialOf } from '@/shared/names';
import { DELETED_MEMBER_NAME, type AssignmentView, type MemberRef } from '@/shared/types';

/**
 * 가중치를 계산할 때 얼마나 거슬러 올라가 볼지.
 * 배정 가중치는 "마지막으로 맡은 날로부터 지난 일수"이므로 오래된 기록도
 * 의미가 있지만, 한 번에 읽는 양에 상한을 둔다.
 */
export const HISTORY_WINDOW_DAYS = 365;

interface AssignmentDetail {
  items: AssignmentItemRow[];
  attendances: AttendanceRow[];
}

export async function findAssignment(
  teamId: string,
  date: DateStr,
): Promise<AssignmentRow | null> {
  const { data, error } = await db()
    .from('assignments')
    .select('id, team_id, date, created_at, updated_at')
    .eq('team_id', teamId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return (data as AssignmentRow | null) ?? null;
}

async function loadDetail(assignmentId: string): Promise<AssignmentDetail> {
  const client = db();

  const [itemsResult, attendancesResult] = await Promise.all([
    client
      .from('assignment_items')
      .select('assignment_id, role_id, member_id')
      .eq('assignment_id', assignmentId),
    client
      .from('attendances')
      .select('assignment_id, member_id, present')
      .eq('assignment_id', assignmentId),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (attendancesResult.error) throw attendancesResult.error;

  return {
    items: (itemsResult.data ?? []) as AssignmentItemRow[],
    attendances: (attendancesResult.data ?? []) as AttendanceRow[],
  };
}

/**
 * 지난 배정 기록. 오늘 줄은 가져오지 않는다.
 * 하루 배정은 한 줄이고 다시 뽑기가 그 줄을 덮어쓰므로, 오늘 기록을
 * 가중치에 넣으면 다시 뽑기가 직전 결과를 두 번 처벌한다 (PRD §3-5).
 */
export async function loadHistory(teamId: string, today: DateStr): Promise<HistoryEntry[]> {
  const client = db();

  const { data: assignmentRows, error } = await client
    .from('assignments')
    .select('id, date')
    .eq('team_id', teamId)
    .gte('date', addDays(today, -HISTORY_WINDOW_DAYS))
    .lt('date', today);

  if (error) throw error;

  const rows = (assignmentRows ?? []) as { id: string; date: string }[];
  if (rows.length === 0) return [];

  const dateById = new Map(rows.map((row) => [row.id, row.date]));

  const { data: itemRows, error: itemsError } = await client
    .from('assignment_items')
    .select('assignment_id, role_id, member_id')
    .in('assignment_id', [...dateById.keys()]);

  if (itemsError) throw itemsError;

  return ((itemRows ?? []) as AssignmentItemRow[]).map((item) => ({
    date: dateById.get(item.assignment_id)!,
    roleId: item.role_id,
    memberId: item.member_id,
  }));
}

// ─── 배정 만들기 ──────────────────────────────────────────────────

interface DrawContext {
  members: MemberRow[];
  activeMembers: MemberRow[];
  roleRows: RoleRow[];
  present: string[];
}

async function prepare(teamId: string, presentMemberIds: string[]): Promise<DrawContext> {
  const [members, roleRows] = await Promise.all([loadMembers(teamId), loadRoles(teamId)]);
  const activeMembers = members.filter((row) => row.active);
  const activeIds = new Set(activeMembers.map((row) => row.id));

  // 화면이 보내온 id 중 이 조에 실제로 있는 사람만 남긴다.
  // 명단 저장과 배정이 겹쳐 사라진 id가 섞여 올 수 있다 (PRD §14)
  const present = [...new Set(presentMemberIds)].filter((id) => activeIds.has(id));

  if (present.length === 0) {
    throw new ApiError(
      'NO_PARTICIPANTS',
      '참여하는 그루가 없어요. 명단에서 참여로 바꾼 뒤 다시 뽑아주세요.',
    );
  }

  return { members, activeMembers, roleRows, present };
}

function draw(context: DrawContext, date: DateStr, history: HistoryEntry[], previousPicks?: Pick[]) {
  const roles: Role[] = context.roleRows.map((row) => ({
    id: row.id,
    key: row.key,
    priority: row.priority,
    isDefault: row.is_default,
  }));

  try {
    return assign({
      presentMemberIds: context.present,
      roles,
      history,
      today: date,
      previousPicks,
    });
  } catch (error) {
    if (error instanceof AssignError) {
      throw new ApiError(error.code, error.message);
    }
    throw error;
  }
}

interface Contents {
  picks: Pick[];
  grooMemberIds: string[];
}

/**
 * 배정 내용을 쓴다.
 *
 * overwrite=false 는 첫 뽑기. 같은 줄에 이미 내용이 있으면 건드리지 않는다.
 * 동시에 누른 두 요청 중 나중 것의 결과가 앞의 것을 덮지 않게 하는 장치다.
 *
 * overwrite=true 는 다시 뽑기. 기존 내용을 지우고 새로 쓴다 (PRD §3-5).
 */
async function writeContents(
  assignmentId: string,
  contents: Contents,
  context: DrawContext,
  overwrite: boolean,
): Promise<void> {
  const client = db();
  const defaultRole = context.roleRows.find((row) => row.is_default);

  const itemRows = [
    ...contents.picks.map((pick) => ({
      assignment_id: assignmentId,
      role_id: pick.roleId,
      member_id: pick.memberId,
    })),
    // 그루도 한 줄씩 남긴다. 지난 기록 화면의 그루 횟수가 여기서 나온다
    ...(defaultRole
      ? contents.grooMemberIds.map((memberId) => ({
          assignment_id: assignmentId,
          role_id: defaultRole.id,
          member_id: memberId,
        }))
      : []),
  ];

  const presentIds = new Set(context.present);
  const attendanceRows = context.activeMembers.map((member) => ({
    assignment_id: assignmentId,
    member_id: member.id,
    present: presentIds.has(member.id),
  }));

  if (overwrite) {
    const removeItems = await client
      .from('assignment_items')
      .delete()
      .eq('assignment_id', assignmentId);
    if (removeItems.error) throw removeItems.error;

    const removeAttendances = await client
      .from('attendances')
      .delete()
      .eq('assignment_id', assignmentId);
    if (removeAttendances.error) throw removeAttendances.error;
  }

  const itemsResult = await client
    .from('assignment_items')
    .upsert(itemRows, { onConflict: 'assignment_id,member_id', ignoreDuplicates: true });
  if (itemsResult.error) throw itemsResult.error;

  const attendancesResult = await client
    .from('attendances')
    .upsert(attendanceRows, { onConflict: 'assignment_id,member_id', ignoreDuplicates: true });
  if (attendancesResult.error) throw attendancesResult.error;
}

/**
 * 오늘 배정을 확보한다. 이미 있으면 그것을 그대로 돌려준다 (PRD §9 — 멱등).
 */
export async function ensureAssignment(
  team: TeamRow,
  date: DateStr,
  presentMemberIds: string[],
): Promise<AssignmentView> {
  const client = db();
  const context = await prepare(team.id, presentMemberIds);

  // 하루 한 줄 확보. 이미 있으면 아무것도 넣지 않는다
  const { data: inserted, error: insertError } = await client
    .from('assignments')
    .upsert({ team_id: team.id, date }, { onConflict: 'team_id,date', ignoreDuplicates: true })
    .select('id, team_id, date, created_at, updated_at');

  if (insertError) throw insertError;

  const row =
    (inserted as AssignmentRow[] | null)?.[0] ??
    (await findAssignment(team.id, date));

  if (!row) {
    throw new ApiError('SERVER_ERROR', '배정을 저장하지 못했어요. 다시 눌러주세요.');
  }

  let detail = await loadDetail(row.id);

  // 내용이 비어 있을 때만 뽑는다. 앞선 요청이 줄만 만들고 실패했어도 여기서 복구된다
  if (detail.items.length === 0) {
    const history = await loadHistory(team.id, date);
    const result = draw(context, date, history);
    await writeContents(row.id, result, context, false);
    detail = await loadDetail(row.id);
  }

  return buildView(row, detail, context.members, context.roleRows);
}

/**
 * 다시 뽑기. 기존 배정을 덮어쓴다 (PRD §7).
 *
 * PRD에 없어서 정한 것: 직전 당첨자를 그 역할 후보에서 뺀다.
 * 같은 알고리즘을 그대로 재실행하면 5명 조에서 49%가 같은 사람이 다시 나와
 * 버튼이 아무 일도 안 한 것처럼 보인다.
 */
export async function rerollAssignment(
  team: TeamRow,
  date: DateStr,
  presentMemberIds: string[],
): Promise<AssignmentView> {
  const client = db();
  const existing = await findAssignment(team.id, date);

  // 오늘 배정이 없으면 다시 뽑을 것도 없다. 첫 뽑기로 처리한다
  if (!existing) {
    return ensureAssignment(team, date, presentMemberIds);
  }

  const context = await prepare(team.id, presentMemberIds);
  const before = await loadDetail(existing.id);

  const defaultRoleIds = new Set(
    context.roleRows.filter((row) => row.is_default).map((row) => row.id),
  );
  const previousPicks: Pick[] = before.items
    .filter((item) => !defaultRoleIds.has(item.role_id))
    .map((item) => ({ roleId: item.role_id, memberId: item.member_id }));

  const history = await loadHistory(team.id, date);
  const result = draw(context, date, history, previousPicks);

  await writeContents(existing.id, result, context, true);

  const { error: touchError } = await client
    .from('assignments')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (touchError) throw touchError;

  const detail = await loadDetail(existing.id);
  return buildView({ ...existing }, detail, context.members, context.roleRows);
}

/** 오늘 배정을 읽는다. 없으면 null */
export async function readAssignmentView(
  teamId: string,
  date: DateStr,
): Promise<AssignmentView | null> {
  const row = await findAssignment(teamId, date);
  if (!row) return null;

  const [detail, members, roleRows] = await Promise.all([
    loadDetail(row.id),
    loadMembers(teamId),
    loadRoles(teamId),
  ]);

  // 줄은 있는데 내용이 비어 있으면 결과 화면을 보여줄 수 없다.
  // 명단 화면으로 돌아가 다시 뽑게 한다
  if (detail.items.length === 0) return null;

  return buildView(row, detail, members, roleRows);
}

// ─── 화면에 보낼 형태로 ───────────────────────────────────────────

function buildView(
  row: AssignmentRow,
  detail: AssignmentDetail,
  members: MemberRow[],
  roleRows: RoleRow[],
): AssignmentView {
  const memberById = new Map(members.map((member) => [member.id, member]));

  /** 이름을 못 찾아도 화면이 깨지지 않게 한다 (PRD §14) */
  const refOf = (memberId: string): MemberRef => {
    const member = memberById.get(memberId);
    if (!member) {
      return { id: memberId, name: DELETED_MEMBER_NAME, initial: '?' };
    }
    return { id: member.id, name: member.name, initial: initialOf(member.name) };
  };

  const memberByRole = new Map(detail.items.map((item) => [item.role_id, item.member_id]));
  const defaultRoles = roleRows.filter((role) => role.is_default);
  const defaultRoleIds = new Set(defaultRoles.map((role) => role.id));

  const pickable = roleRows
    .filter((role) => !role.is_default)
    .sort((a, b) => a.priority - b.priority);

  const assigned = pickable
    .filter((role) => memberByRole.has(role.id))
    .map((role) => ({ role: toRoleView(role), member: refOf(memberByRole.get(role.id)!) }));

  const unfilledRoles = pickable
    .filter((role) => !memberByRole.has(role.id))
    .map(toRoleView);

  const groos = detail.items
    .filter((item) => defaultRoleIds.has(item.role_id))
    .map((item) => refOf(item.member_id));

  const absent = detail.attendances
    .filter((attendance) => !attendance.present)
    .map((attendance) => refOf(attendance.member_id));

  // 명단 순서대로 보여준다. DB가 돌려주는 순서에 기대지 않는다
  const orderOf = (ref: MemberRef) => memberById.get(ref.id)?.order_index ?? Number.MAX_SAFE_INTEGER;
  groos.sort((a, b) => orderOf(a) - orderOf(b));
  absent.sort((a, b) => orderOf(a) - orderOf(b));

  return {
    date: row.date,
    assigned,
    groos,
    absent,
    unfilledRoles,
    updatedAt: row.updated_at,
  };
}

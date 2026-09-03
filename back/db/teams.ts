/**
 * 조 만들기와 조 읽기.
 */

import 'server-only';
import { ApiError } from '../errors';
import { DEFAULT_ROLES } from '../roles';
import { generateSlug, slugToCode } from '../slug';
import { db, isUniqueViolation } from '../supabase';
import type { MemberRow, RoleRow, TeamRow } from './rows';
import { cleanName, initialOf, MAX_MEMBERS } from '@/shared/names';
import { todayKst, type DateStr } from '@/shared/date';
import type { MemberView, RoleView, TeamView } from '@/shared/types';

/** 조 생성. slug와 code를 발급한다 (PRD §9 POST /api/teams) */
export async function createTeam(rawNames: string[]): Promise<TeamRow> {
  const names = rawNames.map(cleanName).filter((name) => name.length > 0);

  if (names.length === 0) {
    throw new ApiError('NO_MEMBERS', '조원 이름을 한 명 이상 넣어주세요.');
  }
  if (names.length > MAX_MEMBERS) {
    // PRD §11 — 12명을 넘기면 막고 조를 나누라고 안내한다
    throw new ApiError(
      'TOO_MANY_MEMBERS',
      `한 조는 ${MAX_MEMBERS}명까지예요. ${names.length}명이면 조를 나누는 게 좋아요.`,
      { max: MAX_MEMBERS, given: names.length },
    );
  }

  const client = db();

  // slug가 겹칠 확률은 10억분의 1 수준이지만, 겹치면 다시 만든다
  let team: TeamRow | null = null;
  for (let attempt = 0; attempt < 5 && team === null; attempt++) {
    const slug = generateSlug();
    const { data, error } = await client
      .from('teams')
      .insert({ slug, code: slugToCode(slug) })
      .select('id, slug, code, created_at')
      .single();

    if (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    team = data as TeamRow;
  }

  if (team === null) {
    throw new ApiError('SERVER_ERROR', '링크를 만들지 못했어요. 다시 눌러주세요.');
  }

  // 역할과 조원까지 들어가야 조가 완성된다. 하나라도 실패하면 조를 지운다.
  // 역할이 없는 조가 남으면 '역할 뽑기'가 영원히 안 되는데 사용자는 이유를 알 수 없다
  try {
    const { error: rolesError } = await client.from('roles').insert(
      DEFAULT_ROLES.map((role) => ({
        team_id: team.id,
        key: role.key,
        name: role.name,
        description: role.description,
        emoji: role.emoji,
        priority: role.priority,
        is_default: role.isDefault,
      })),
    );
    if (rolesError) throw rolesError;

    const { error: membersError } = await client.from('members').insert(
      names.map((name, index) => ({
        team_id: team.id,
        name,
        order_index: index,
      })),
    );
    if (membersError) throw membersError;
  } catch (error) {
    await client.from('teams').delete().eq('id', team.id);
    throw error;
  }

  return team;
}

export async function findTeamBySlug(slug: string): Promise<TeamRow | null> {
  const { data, error } = await db()
    .from('teams')
    .select('id, slug, code, created_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return (data as TeamRow | null) ?? null;
}

/** 없으면 404. 라우트마다 같은 문구를 쓰기 위해 여기 모아둔다 */
export async function requireTeamBySlug(slug: string): Promise<TeamRow> {
  const team = await findTeamBySlug(slug);
  if (!team) {
    throw new ApiError(
      'TEAM_NOT_FOUND',
      '이 링크에 해당하는 조가 없어요. 링크를 다시 확인하거나 코드를 입력해 보세요.',
    );
  }
  return team;
}

/**
 * 조원 전체를 읽는다. 명단에서 빠진(active=false) 사람도 포함한다.
 * 지난 기록에 남은 이름을 채워야 하기 때문이다 (PRD §14).
 */
export async function loadMembers(teamId: string): Promise<MemberRow[]> {
  const { data, error } = await db()
    .from('members')
    .select('id, team_id, name, order_index, active, created_at')
    .eq('team_id', teamId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MemberRow[];
}

export async function loadRoles(teamId: string): Promise<RoleRow[]> {
  const { data, error } = await db()
    .from('roles')
    .select('id, team_id, key, name, description, emoji, priority, is_default')
    .eq('team_id', teamId)
    .order('priority', { ascending: true });

  if (error) throw error;

  const roles = (data ?? []) as RoleRow[];
  if (roles.length === 0) {
    throw new ApiError('NO_ROLES', '이 조에 역할이 없어요. 새 조를 만들어 주세요.');
  }
  return roles;
}

// ─── 화면에 보낼 형태로 바꾸기 ────────────────────────────────────

export function toMemberView(row: MemberRow): MemberView {
  return {
    id: row.id,
    name: row.name,
    initial: initialOf(row.name),
    orderIndex: row.order_index,
    active: row.active,
  };
}

export function toRoleView(row: RoleRow): RoleView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    priority: row.priority,
    isDefault: row.is_default,
  };
}

/** 만든 날에만 링크 배너를 띄운다 (PRD §6 S3) */
export function isCreatedToday(team: TeamRow, today: DateStr): boolean {
  return todayKst(new Date(team.created_at)) === today;
}

export function toTeamView(
  team: TeamRow,
  members: MemberRow[],
  roles: RoleRow[],
  today: DateStr,
  todayAssignment: TeamView['today'],
): TeamView {
  return {
    slug: team.slug,
    code: team.code,
    createdAt: team.created_at,
    createdToday: isCreatedToday(team, today),
    // 명단 화면에는 조에 남아 있는 사람만 보여준다
    members: members.filter((row) => row.active).map(toMemberView),
    roles: roles.map(toRoleView),
    today: todayAssignment,
  };
}

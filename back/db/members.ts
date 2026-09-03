/**
 * 명단 일괄 저장. (PRD §9 PUT /api/teams/[slug]/members)
 *
 * 지우는 것은 항상 soft delete다 (active = false). PRD §14가 지적한 대로
 * 즉시 지우면 되돌릴 수 없고, 지난 기록의 이름도 사라진다.
 * 빈자리는 삭제가 아니다 (PRD §3-6) — 그건 attendances가 담당한다.
 */

import 'server-only';
import { ApiError } from '../errors';
import { db } from '../supabase';
import { loadMembers } from './teams';
import type { MemberRow } from './rows';
import { cleanName, MAX_MEMBERS } from '@/shared/names';

export interface IncomingMember {
  /** 기존 조원이면 id, 새로 추가하는 조원이면 없음 */
  id?: string;
  name: string;
}

export async function saveMembers(
  teamId: string,
  incoming: IncomingMember[],
): Promise<MemberRow[]> {
  // 빈 이름은 저장하지 않는다 (PRD §14). 새 칸을 만들고 안 채운 경우다
  const cleaned = incoming
    .map((item) => ({ id: item.id, name: cleanName(item.name) }))
    .filter((item) => item.name.length > 0);

  if (cleaned.length === 0) {
    throw new ApiError('NO_MEMBERS', '조원이 한 명도 없어요. 이름을 하나 이상 남겨주세요.');
  }
  if (cleaned.length > MAX_MEMBERS) {
    throw new ApiError(
      'TOO_MANY_MEMBERS',
      `한 조는 ${MAX_MEMBERS}명까지예요. ${cleaned.length}명이면 조를 나누는 게 좋아요.`,
      { max: MAX_MEMBERS, given: cleaned.length },
    );
  }

  const client = db();
  const existing = await loadMembers(teamId);
  const existingById = new Map(existing.map((row) => [row.id, row]));

  // 남의 조 조원 id를 보내는 요청은 거부한다. 링크가 열쇠라도 조는 서로 무관하다
  for (const item of cleaned) {
    if (item.id !== undefined && !existingById.has(item.id)) {
      throw new ApiError('BAD_REQUEST', '명단이 그사이 바뀌었어요. 화면을 새로 열어주세요.');
    }
  }

  const keptIds = new Set(cleaned.filter((item) => item.id !== undefined).map((item) => item.id!));

  // 1) 기존 조원: 이름과 순서를 맞춘다. 다시 살아난 경우 active도 되돌린다
  for (const [index, item] of cleaned.entries()) {
    if (item.id === undefined) continue;
    const before = existingById.get(item.id)!;
    if (before.name === item.name && before.order_index === index && before.active) continue;

    const { error } = await client
      .from('members')
      .update({ name: item.name, order_index: index, active: true })
      .eq('id', item.id)
      .eq('team_id', teamId);
    if (error) throw error;
  }

  // 2) 새 조원
  const additions = cleaned
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.id === undefined)
    .map(({ item, index }) => ({ team_id: teamId, name: item.name, order_index: index }));

  if (additions.length > 0) {
    const { error } = await client.from('members').insert(additions);
    if (error) throw error;
  }

  // 3) 목록에서 빠진 사람: 지우지 않고 내려둔다
  const removedIds = existing
    .filter((row) => row.active && !keptIds.has(row.id))
    .map((row) => row.id);

  if (removedIds.length > 0) {
    const { error } = await client
      .from('members')
      .update({ active: false })
      .eq('team_id', teamId)
      .in('id', removedIds);
    if (error) throw error;
  }

  return loadMembers(teamId);
}

/** 되돌리기. 화면에서 몇 초 안에 누르면 방금 내린 조원이 돌아온다 (PRD §14) */
export async function restoreMember(teamId: string, memberId: string): Promise<void> {
  const { error } = await db()
    .from('members')
    .update({ active: true })
    .eq('team_id', teamId)
    .eq('id', memberId);
  if (error) throw error;
}

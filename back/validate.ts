/**
 * 요청 본문 검사.
 *
 * 링크를 아는 사람은 누구나 고칠 수 있다 (PRD §3-1). 권한 검사는 없지만
 * 형식 검사는 필요하다. 화면이 보내는 값과 사람이 손으로 만든 요청을
 * 구분할 수 없으므로, 서버는 들어온 값을 믿지 않는다.
 */

import 'server-only';
import { ApiError } from './errors';

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError('BAD_REQUEST', '요청 형식이 올바르지 않아요.');
  }
  return body as Record<string, unknown>;
}

/** 문자열 배열. 길이 상한을 둔다 */
export function stringArray(body: unknown, field: string, max: number): string[] {
  const value = asRecord(body)[field];
  if (!Array.isArray(value)) {
    throw new ApiError('BAD_REQUEST', `${field} 목록이 없어요.`);
  }
  if (value.length > max) {
    throw new ApiError('BAD_REQUEST', `${field}가 너무 많아요.`);
  }
  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new ApiError('BAD_REQUEST', `${field}에 글자가 아닌 값이 들어 있어요.`);
    }
    return item;
  });
}

export interface MemberInput {
  id?: string;
  name: string;
}

/** 명단 저장 본문: [{ id?, name }] */
export function memberArray(body: unknown, max: number): MemberInput[] {
  const value = asRecord(body).members;
  if (!Array.isArray(value)) {
    throw new ApiError('BAD_REQUEST', 'members 목록이 없어요.');
  }
  if (value.length > max) {
    throw new ApiError('BAD_REQUEST', `한 번에 ${max}명까지만 저장할 수 있어요.`);
  }

  return value.map((item) => {
    const record = asRecord(item);
    const name = record.name;
    if (typeof name !== 'string') {
      throw new ApiError('BAD_REQUEST', '조원 이름이 글자가 아니에요.');
    }
    const id = record.id;
    if (id !== undefined && typeof id !== 'string') {
      throw new ApiError('BAD_REQUEST', '조원 id가 글자가 아니에요.');
    }
    return id === undefined ? { name } : { id, name };
  });
}

/** 정해진 값 중 하나여야 하는 문자열 */
export function oneOf<T extends string>(body: unknown, field: string, allowed: readonly T[]): T {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError('BAD_REQUEST', `${field} 값이 올바르지 않아요.`);
  }
  return value as T;
}

/** 범위 안의 정수. 없으면 undefined */
export function optionalInt(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError('BAD_REQUEST', `${label}이 숫자가 아니에요.`);
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    throw new ApiError('BAD_REQUEST', `${label}이 범위를 벗어났어요.`);
  }
  return rounded;
}

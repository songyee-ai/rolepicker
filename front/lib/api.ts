/**
 * 서버에 요청 보내기.
 *
 * 오류 문구는 서버가 만든 것을 그대로 화면에 띄운다. 화면에서 문구를 다시
 * 쓰면 두 곳이 어긋나고, 사용자는 서로 다른 안내를 보게 된다.
 */

import type {
  AssignmentView,
  CreateTeamResponse,
  ResolveResponse,
  TeamView,
  TimerPlan,
  TimerStateView,
} from '@/shared/types';
import type { SessionKind } from '@/shared/timer';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const NETWORK_MESSAGE = '서버에 연결하지 못했어요. 인터넷을 확인하고 다시 눌러주세요.';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiClientError('NETWORK', NETWORK_MESSAGE, 0);
  }

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiClientError(
      error?.code ?? 'SERVER_ERROR',
      error?.message ?? '요청을 처리하지 못했어요. 다시 눌러주세요.',
      response.status,
    );
  }

  return body as T;
}

export const api = {
  createTeam(names: string[]) {
    return request<CreateTeamResponse>('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ names }),
    });
  },

  getTeam(slug: string) {
    return request<TeamView>(`/api/teams/${slug}`);
  },

  saveMembers(slug: string, members: { id?: string; name: string }[]) {
    return request<TeamView>(`/api/teams/${slug}/members`, {
      method: 'PUT',
      body: JSON.stringify({ members }),
    });
  },

  assign(slug: string, presentMemberIds: string[]) {
    return request<AssignmentView>(`/api/teams/${slug}/assign`, {
      method: 'POST',
      body: JSON.stringify({ presentMemberIds }),
    });
  },

  reroll(slug: string, presentMemberIds: string[]) {
    return request<AssignmentView>(`/api/teams/${slug}/reroll`, {
      method: 'POST',
      body: JSON.stringify({ presentMemberIds }),
    });
  },

  getTimer(slug: string) {
    return request<TimerStateView>(`/api/teams/${slug}/timer/sessions`);
  },

  /** 세션 시작. 처음 시작할 때만 plan 을 함께 보내 그날의 약속을 저장한다 */
  startTimerSession(slug: string, kind: SessionKind, plan?: TimerPlan) {
    return request<TimerStateView>(`/api/teams/${slug}/timer/sessions`, {
      method: 'POST',
      body: JSON.stringify(plan ? { kind, plan } : { kind }),
    });
  },

  patchTimerSession(slug: string, sessionId: string, action: 'pause' | 'resume' | 'end') {
    return request<TimerStateView>(`/api/teams/${slug}/timer/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  },

  resolve(code: string) {
    return request<ResolveResponse>(`/api/resolve?code=${encodeURIComponent(code)}`);
  },
};

export function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return '요청을 처리하지 못했어요. 다시 눌러주세요.';
}

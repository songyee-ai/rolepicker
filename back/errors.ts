/**
 * API 응답과 에러 형태를 한 곳에서 정한다.
 *
 * 문구 규칙 (PRD §17)
 *   - 사과하지 않는다
 *   - 무엇이 잘못됐고 어떻게 하면 되는지 적는다
 *   - 사용자를 '그루'라고 부르고, 불참은 '빈자리'라고 쓴다
 */

import 'server-only';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'TEAM_NOT_FOUND'
  | 'NO_PARTICIPANTS'
  | 'NO_ROLES'
  | 'TOO_MANY_MEMBERS'
  | 'NO_MEMBERS'
  | 'NO_ASSIGNMENT'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'SERVER_ERROR';

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  TEAM_NOT_FOUND: 404,
  NO_PARTICIPANTS: 400,
  NO_ROLES: 500,
  TOO_MANY_MEMBERS: 400,
  NO_MEMBERS: 400,
  NO_ASSIGNMENT: 404,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  SERVER_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function jsonOk<T>(body: T, init?: ResponseInit): Response {
  return Response.json(body as object, { status: 200, ...init });
}

/**
 * 어떤 에러가 나도 이 함수를 통과한다.
 * 예상한 에러는 그대로 알려주고, 예상 못 한 에러는 내부 사정을 감춘 채
 * 500으로 돌려준다. DB 오류 메시지가 브라우저로 새면 안 된다.
 */
export function jsonError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, ...error.extra } },
      { status: error.status },
    );
  }

  // 설정값이 비어 있는 경우는 개발 중에만 나온다. 원인을 알려주는 게 낫다
  if (error instanceof Error && error.message.includes('.env.local')) {
    return Response.json(
      { error: { code: 'NOT_CONFIGURED', message: error.message } },
      { status: 503 },
    );
  }

  console.error('[api] 예상하지 못한 오류', error);
  return Response.json(
    {
      error: {
        code: 'SERVER_ERROR',
        message: '서버가 응답을 만들지 못했어요. 잠시 뒤 다시 눌러주세요.',
      },
    },
    { status: 500 },
  );
}

/** 라우트 핸들러를 감싸서 에러 처리를 한 번만 쓴다 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return jsonError(error);
    }
  };
}

/** 요청 본문을 JSON으로 읽는다. 형식이 틀리면 400 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('BAD_REQUEST', '요청 형식이 올바르지 않아요.');
  }
}

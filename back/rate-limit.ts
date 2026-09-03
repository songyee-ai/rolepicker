/**
 * 아주 단순한 요청 제한. (PRD §14 "slug 무작위 대입")
 *
 * 코드는 단어 64개 × hex 6자리 = 약 10억 조합이지만, 자동으로 코드를
 * 계속 넣어보면서 남의 조를 찾는 것을 막아야 한다. /api/resolve 가 대상이다.
 *
 * 메모리에만 기록하므로 서버 인스턴스가 여러 개면 각자 센다. 그래도
 * 한 대당 한도가 걸려 있으면 대입 속도가 실용적이지 않은 수준으로 떨어진다.
 * 더 엄격하게 해야 할 이유가 생기면 Upstash 같은 외부 저장소로 옮긴다.
 */

import 'server-only';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 오래된 기록을 치운다. 메모리가 무한히 늘어나지 않게 */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** 다시 시도할 수 있게 되기까지 남은 초 */
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** 테스트에서 상태를 비운다 */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * 요청을 보낸 쪽을 구분하는 값.
 * Vercel 뒤에서는 x-forwarded-for 가 실제 주소를 담는다.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * 검색엔진에게 조 화면을 색인하지 말라고 알린다.
 *
 * 링크가 곧 열쇠인 서비스다 (PRD §3-1). 조 링크가 어딘가 공개된 곳에
 * 한 번 새면 검색으로 찾을 수 있게 되는데, 그건 링크를 잃는 것과 차원이 다르다.
 * 첫 화면과 사용법은 색인돼도 괜찮다.
 */
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/t/' },
  };
}

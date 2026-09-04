/**
 * 조 화면 전체에 "색인하지 마세요"를 붙인다.
 *
 * robots.txt 는 크롤러에게 부탁하는 것이고, 이 meta 는 페이지 자체에 붙는다.
 * 둘 다 두면 링크가 어딘가 새더라도 검색 결과에 뜰 여지가 줄어든다.
 * 이 서비스는 링크가 곧 열쇠라서 (PRD §3-1) 그 차이가 크다.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function TeamLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from 'next/font/google';
import './globals.css';

// 서체는 PRD §13 그대로. 본문은 Sans KR, 시각·타이머 숫자는 Mono
const plexKr = IBM_Plex_Sans_KR({
  variable: '--font-plex-kr',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  // subsets 를 지정하면 그 글자 묶음만 받아온다. ['latin'] 만 쓰면 한글이
  // 대체 서체로 나오고, 'korean' 은 Next의 타입 목록에 아직 없다.
  // 문서가 안내하는 방법대로 subsets 를 비우고 preload 를 끄면
  // 모든 글자 묶음을 받아오되 미리 불러오기만 생략한다.
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '그루뽑기',
  description: '이끄미와 시간지키미를 뽑고, 바로 학습 타이머까지 이어져요.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FDFCF9',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${plexKr.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

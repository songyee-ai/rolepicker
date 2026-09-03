import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from 'next/font/google';
import './globals.css';

// 서체는 PRD §13 그대로. 본문은 Sans KR, 시각·타이머 숫자는 Mono
const plexKr = IBM_Plex_Sans_KR({
  variable: '--font-plex-kr',
  // 한글 글리프를 받아오려면 korean subset이 필요하다. 빼면 대체 서체로 나온다
  subsets: ['latin', 'korean'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
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

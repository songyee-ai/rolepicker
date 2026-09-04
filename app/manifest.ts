/**
 * 홈 화면에 추가하기. (PRD §12)
 * 오프라인은 아니다 — 서비스워커를 두지 않는다. 네이티브 앱도 만들지 않는다.
 */
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '그루뽑기',
    short_name: '그루뽑기',
    description: '이끄미와 시간지키미를 뽑고, 바로 학습 타이머까지 이어져요.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDFCF9',
    theme_color: '#C7F04A',
    lang: 'ko',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}

/**
 * 홈 화면에 추가했을 때 쓰는 아이콘. (PRD §12 — PWA)
 *
 * 이미지 파일 대신 코드로 그린다. 🎯 이끄미의 과녁을 도형으로만 만들어
 * 서체나 이모지 폰트에 기대지 않는다. 색은 디자인 토큰 그대로 (PRD §13).
 */
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#C7F04A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 320,
            height: 320,
            borderRadius: '50%',
            border: '44px solid #17202E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 118,
              height: 118,
              borderRadius: '50%',
              background: '#17202E',
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}

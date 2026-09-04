/**
 * iOS 홈 화면용 아이콘. app/icon.tsx 와 같은 도형, 크기만 다르다
 *
 * 이미지 파일 대신 코드로 그린다. 🎯 이끄미의 과녁을 도형으로만 만들어
 * 서체나 이모지 폰트에 기대지 않는다. 색은 디자인 토큰 그대로 (PRD §13).
 */
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
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
            width: 112,
            height: 112,
            borderRadius: '50%',
            border: "16px solid #17202E",
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 42,
              height: 42,
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

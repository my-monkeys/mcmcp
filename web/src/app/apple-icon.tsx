import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0b0b0d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            background: 'linear-gradient(135deg, #7ec07e 0%, #2f7a2f 100%)',
            boxShadow: 'inset -10px -10px 0 rgba(0,0,0,.25)',
            border: '4px solid #0d3a0d',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size },
  );
}

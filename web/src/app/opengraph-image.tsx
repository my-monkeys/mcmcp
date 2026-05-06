import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'mcmcp — Build Minecraft schematics with AI';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0b0b0d',
          color: '#f5f3ed',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 24, color: '#9ca39c', letterSpacing: 4, textTransform: 'uppercase' }}>
          mcmcp · MCP server
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>BUILD</div>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>MINECRAFT</div>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3, display: 'flex' }}>
            WITH <span style={{ color: '#7ec07e' }}>AI.</span>
          </div>
        </div>
        <div style={{ fontSize: 28, color: '#9ca39c' }}>Claude · MCP · Three.js · .litematic</div>
      </div>
    ),
    { ...size },
  );
}

import { ImageResponse } from 'next/og';

export const alt = 'VeeValve — vee kvaliteet randades ja basseinides';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const OpenGraphImage = () => {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px 80px',
          background:
            'linear-gradient(160deg, #f2f7f5 0%, #ecf8f3 50%, #def2ea 100%)',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: '#0a8f78',
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              backgroundColor: '#0a8f78',
              display: 'flex',
            }}
          />
          VeeValve
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 66,
            lineHeight: 1.08,
            fontWeight: 700,
            maxWidth: 980,
          }}
        >
          Vee kvaliteet randades ja basseinides Eestis
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 34,
            lineHeight: 1.3,
            color: '#334155',
            maxWidth: 980,
          }}
        >
          Reaalajas staatused, otsing, filtrid ja lemmikute märguanded.
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
};

export default OpenGraphImage;

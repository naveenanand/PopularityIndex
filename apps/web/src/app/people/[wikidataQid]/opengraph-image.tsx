import { ImageResponse } from 'next/og';
import { getPersonWithScores } from '../../../lib/api';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ wikidataQid: string }>;
}

export default async function OGImage({ params }: Props) {
  const { wikidataQid } = await params;
  const data = await getPersonWithScores(wikidataQid);

  const name = data?.person.displayName ?? 'Unknown';
  const occupation = data?.person.occupationSummary?.replace(/_/g, ' ') ?? '';
  const photoUrl = data?.person.photoUrl;
  const popularity = data?.latestScore ? Math.round(data.latestScore.popularityScore) : null;
  const heat = data?.latestScore ? Math.round(data.latestScore.heatScore) : null;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '60px',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background photo blur overlay */}
        {photoUrl && (
          <img
            src={photoUrl}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top',
              opacity: 0.15,
            }}
          />
        )}

        {/* Dark gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,10,10,1) 40%, rgba(10,10,10,0.6) 100%)',
          }}
        />

        {/* Red accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '5px',
            background: '#dc2626',
          }}
        />

        {/* Content */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '40px', zIndex: 10, width: '100%' }}>
          {/* Photo */}
          {photoUrl && (
            <img
              src={photoUrl}
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                objectFit: 'cover',
                objectPosition: 'top',
                border: '4px solid #27272a',
                flexShrink: 0,
              }}
            />
          )}

          {/* Name + scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '56px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                {name}
              </div>
              {occupation && (
                <div style={{ fontSize: '24px', color: '#71717a', textTransform: 'capitalize' }}>
                  {occupation}
                </div>
              )}
            </div>

            {/* Score pills */}
            {(popularity !== null || heat !== null) && (
              <div style={{ display: 'flex', gap: '16px' }}>
                {popularity !== null && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(39,39,42,0.8)',
                      border: '1px solid #3f3f46',
                      borderRadius: '16px',
                      padding: '12px 24px',
                    }}
                  >
                    <div style={{ fontSize: '40px', fontWeight: 900, color: '#fbbf24' }}>{popularity}</div>
                    <div style={{ fontSize: '14px', color: '#71717a', marginTop: '2px' }}>Popularity</div>
                  </div>
                )}
                {heat !== null && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(39,39,42,0.8)',
                      border: '1px solid #3f3f46',
                      borderRadius: '16px',
                      padding: '12px 24px',
                    }}
                  >
                    <div style={{ fontSize: '40px', fontWeight: 900, color: '#fb923c' }}>{heat}</div>
                    <div style={{ fontSize: '14px', color: '#71717a', marginTop: '2px' }}>Heat</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Brand */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '4px',
              alignSelf: 'flex-end',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '14px', color: '#52525b' }}>popularityindex.naveenanand.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

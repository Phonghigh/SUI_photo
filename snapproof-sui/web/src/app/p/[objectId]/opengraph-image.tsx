/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { getProofById, WALRUS_AGGREGATOR_URL } from '@/lib/sui';

export const runtime = 'edge';
export const alt = 'SnapProof — verified photo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: Promise<{ objectId: string }>;
};

export default async function OGImage({ params }: Props) {
  const { objectId } = await params;
  const proof = await getProofById(objectId);

  if (!proof) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
            color: '#fff',
            fontSize: 64,
          }}
        >
          SnapProof — Proof Not Found
        </div>
      ),
      size
    );
  }

  const imageUrl = `${WALRUS_AGGREGATOR_URL}/v1/${proof.walrusBlobId}`;
  const date = new Date(proof.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const shortCreator = `${proof.creator.slice(0, 6)}…${proof.creator.slice(-4)}`;
  const shortHash = `${proof.imageHash.slice(0, 10)}…${proof.imageHash.slice(-6)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background: '#1a1a2e',
          color: '#fff',
        }}
      >
        {/* Left: photo */}
        <div
          style={{
            width: '55%',
            height: '100%',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={imageUrl}
            alt=""
            width={660}
            height={630}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>

        {/* Right: metadata card */}
        <div
          style={{
            width: '45%',
            padding: '56px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#16213e',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: '#e94560',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                ✓
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
                SnapProof
              </div>
            </div>

            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1.15,
                marginBottom: 32,
                color: '#4ecca3',
              }}
            >
              Cryptographically Verified on Sui
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Row label="Captured" value={date} />
              <Row label="Creator" value={shortCreator} mono />
              <Row label="Hash" value={shortHash} mono />
            </div>
          </div>

          <div
            style={{
              fontSize: 20,
              color: '#888',
              borderTop: '1px solid #0f3460',
              paddingTop: 20,
              display: 'flex',
            }}
          >
            snapproof.app
          </div>
        </div>
      </div>
    ),
    size
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontSize: 16,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          color: '#fff',
          fontFamily: mono ? 'monospace' : 'sans-serif',
        }}
      >
        {value}
      </div>
    </div>
  );
}

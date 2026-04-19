import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

export const SUI_NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as 'testnet' | 'devnet' | 'mainnet') ??
  'testnet';

export const WALRUS_AGGREGATOR_URL =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  'https://aggregator.walrus-testnet.walrus.space';

export const PROOF_PACKAGE_ID =
  process.env.NEXT_PUBLIC_PROOF_PACKAGE_ID ??
  '';

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface PhotoProof {
  objectId: string;
  imageHash: string;
  metadataHash: string;
  proofHash: string;
  walrusBlobId: string;
  createdAt: number;
  creator: string;
  coarseGeoHash?: string;
  txDigest?: string;
}

const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

/**
 * Fetch a PhotoProof object by its Sui object ID.
 */
export async function getProofById(objectId: string): Promise<PhotoProof | null> {
  try {
    const result = await client.getObject({
      id: objectId,
      options: {
        showContent: true,
      },
    });

    if (result.error || !result.data?.content) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (result.data.content as any).fields;

    return {
      objectId: result.data.objectId,
      imageHash: fields.image_hash,
      metadataHash: fields.metadata_hash,
      proofHash: fields.proof_hash,
      walrusBlobId: fields.walrus_blob_id,
      createdAt: Number(fields.created_at),
      creator: fields.creator,
      coarseGeoHash: fields.coarse_geo_hash,
    };
  } catch (error) {
    console.error('Failed to fetch proof by id:', error);
    return null;
  }
}

/**
 * Look up a PhotoProof by its image hash.
 *
 * Order of operations:
 *   1. Ask the backend /api/proofs/by-hash/:hash — preferred path (uses
 *      Postgres indexer when available, otherwise on-chain events).
 *   2. If the backend isn't reachable, fall back to querying Sui events
 *      directly and filtering.
 */
export async function getProofByHash(imageHash: string): Promise<PhotoProof | null> {
  const normalized = imageHash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return null;

  // 1. Preferred: backend lookup.
  try {
    const res = await fetch(`${BACKEND_URL}/api/proofs/by-hash/${normalized}`, {
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const json = (await res.json()) as { proof?: BackendProof };
      if (json.proof) return fromBackend(json.proof);
    }
  } catch (err) {
    console.warn('getProofByHash: backend unreachable, falling back to chain', err);
  }

  // 2. Fallback: on-chain event query.
  try {
    const events = await client.queryEvents({
      query: {
        MoveEventType: `${PROOF_PACKAGE_ID}::photo_proof::ProofCreated`,
      },
      limit: 50,
      order: 'descending',
    });
    for (const ev of events.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = ev.parsedJson as any;
      if (parsed?.image_hash === normalized && parsed.proof_id) {
        const proof = await getProofById(parsed.proof_id);
        if (proof) return { ...proof, txDigest: ev.id.txDigest };
      }
    }
  } catch (err) {
    console.error('getProofByHash: chain fallback failed', err);
  }
  return null;
}

/** Shape returned by the backend. Kept loose because the indexer row shape may evolve. */
type BackendProof = {
  objectId: string;
  imageHash: string;
  metadataHash?: string;
  proofHash: string;
  walrusBlobId?: string;
  createdAt: number;
  creator: string;
  coarseGeoHash?: string;
  txDigest?: string;
};

function fromBackend(p: BackendProof): PhotoProof {
  return {
    objectId: p.objectId,
    imageHash: p.imageHash,
    metadataHash: p.metadataHash ?? '',
    proofHash: p.proofHash,
    walrusBlobId: p.walrusBlobId ?? '',
    createdAt: Number(p.createdAt),
    creator: p.creator,
    coarseGeoHash: p.coarseGeoHash,
    txDigest: p.txDigest,
  };
}

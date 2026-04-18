import { SuiClient } from '@mysten/sui/client';

export const SUI_NETWORK = 'testnet';
export const WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export interface PhotoProof {
  objectId: string;
  imageHash: string;
  metadataHash: string;
  proofHash: string;
  walrusBlobId: string;
  createdAt: number;
  creator: string;
  coarseGeoHash?: string;
}

const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });

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
    console.error("Failed to fetch proof:", error);
    return null;
  }
}

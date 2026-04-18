import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import type { ProofRecord } from "../types/proof.js";

const NETWORK =
  (process.env.SUI_NETWORK as "testnet" | "devnet" | "mainnet") ?? "testnet";
const PACKAGE_ID = process.env.PROOF_PACKAGE_ID ?? "0xTODO";

let client: SuiClient | null = null;

export function getSuiClient(): SuiClient {
  if (!client) {
    client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  }
  return client;
}

/**
 * Query ProofCreated events from the contract.
 */
export async function queryProofEvents(
  limit: number = 50
): Promise<ProofRecord[]> {
  const suiClient = getSuiClient();

  const events = await suiClient.queryEvents({
    query: {
      MoveEventType: `${PACKAGE_ID}::snapproof::ProofCreated`,
    },
    limit,
    order: "descending",
  });

  return events.data.map((event) => {
    const parsed = event.parsedJson as Record<string, unknown>;
    return {
      imageHash: String(parsed.image_hash ?? ""),
      metadataHash: "",
      proofHash: String(parsed.proof_hash ?? ""),
      walrusBlobId: "",
      createdAt: Number(parsed.created_at ?? 0),
      txDigest: event.id.txDigest,
      objectId: String(parsed.proof_id ?? ""),
      creator: String(parsed.creator ?? ""),
    };
  });
}

/**
 * Fetch a PhotoProof object by its ID and return structured data.
 */
export async function getProofObject(
  objectId: string
): Promise<ProofRecord | null> {
  try {
    const suiClient = getSuiClient();
    const obj = await suiClient.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType !== "moveObject") return null;

    const fields = obj.data.content.fields as Record<string, unknown>;
    return {
      imageHash: String(fields.image_hash ?? ""),
      metadataHash: String(fields.metadata_hash ?? ""),
      proofHash: String(fields.proof_hash ?? ""),
      walrusBlobId: String(fields.walrus_blob_id ?? ""),
      createdAt: Number(fields.created_at ?? 0),
      txDigest: "",
      objectId: obj.data.objectId,
      creator: String(fields.creator ?? ""),
      coarseGeoHash: String(fields.coarse_geo_hash ?? ""),
      caseId: String(fields.case_id ?? ""),
    };
  } catch (error) {
    console.error("Failed to fetch proof object:", error);
    return null;
  }
}

/**
 * Find a proof event by image hash.
 */
export async function findProofByImageHash(
  imageHash: string
): Promise<ProofRecord | null> {
  const events = await queryProofEvents(100);
  const match = events.find((e) => e.imageHash === imageHash);

  if (match && match.objectId) {
    // Enrich with full object data
    const full = await getProofObject(match.objectId);
    if (full) {
      full.txDigest = match.txDigest;
      return full;
    }
  }

  return match ?? null;
}

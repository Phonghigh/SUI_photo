import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_NETWORK, PROOF_PACKAGE_ID } from "../config";
import { getKeypair } from "./wallet";
import { logger } from "../utils/logger";
import type { ProofData } from "../types/proof";

let client: SuiClient | null = null;

function getSuiClient(): SuiClient {
  if (!client) {
    client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
  }
  return client;
}

export const mintProof = createProofOnSui;

export interface CreateProofResult {
  txDigest: string;
  objectId: string;
}

/**
 * Create a proof record on Sui by calling the snapproof::create_proof function.
 *
 * Arguments match the Move function signature:
 *   create_proof(
 *     walrus_blob_id: String,
 *     image_hash: String,
 *     metadata_hash: String,
 *     proof_hash: String,
 *     created_at: u64,
 *     coarse_geo_hash: String,
 *     case_id: String,
 *     ctx: &mut TxContext,
 *   )
 */
export async function createProofOnSui(
  proof: ProofData
): Promise<CreateProofResult> {
  const suiClient = getSuiClient();
  const keypair = await getKeypair();

  logger.debug("SUI", "Building transaction block", proof);
  const tx = new Transaction();

  tx.moveCall({
    target: `${PROOF_PACKAGE_ID}::snapproof::create_proof`,
    arguments: [
      tx.pure.string(proof.walrusBlobId),
      tx.pure.string(proof.imageHash),
      tx.pure.string(proof.metadataHash),
      tx.pure.string(proof.proofHash),
      tx.pure.u64(proof.createdAt),
      tx.pure.string(proof.coarseGeoHash ?? ""),
      tx.pure.string(proof.caseId ?? ""),
    ],
  });

  logger.info("SUI", "Executing transaction...");
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  logger.info("SUI", "Transaction executed", { digest: result.digest });
  logger.debug("SUI", "Transaction effects", result.effects);

  // Extract the created PhotoProof object ID from effects
  let objectId = "";
  if (result.objectChanges) {
    const created = result.objectChanges.find(
      (change) =>
        change.type === "created" &&
        change.objectType?.includes("::snapproof::PhotoProof")
    );
    if (created && created.type === "created") {
      objectId = created.objectId;
    }
  }

  return {
    txDigest: result.digest,
    objectId,
  };
}

/**
 * Look up a proof object on Sui by its object ID.
 */
export async function getProofById(objectId: string): Promise<ProofData | null> {
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
      creator: String(fields.creator ?? ""),
      coarseGeoHash: String(fields.coarse_geo_hash ?? ""),
      caseId: String(fields.case_id ?? ""),
    };
  } catch (error) {
    logger.error("SUI", "Failed to fetch proof", error);
    return null;
  }
}

/**
 * Look up proofs by querying ProofCreated events.
 */
export async function lookupProofByImageHash(
  imageHash: string
): Promise<{ txDigest: string; proofId: string } | null> {
  try {
    const suiClient = getSuiClient();
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PROOF_PACKAGE_ID}::snapproof::ProofCreated`,
      },
      limit: 1,
      order: "descending",
    });

    logger.debug("SUI", "Image hash lookup results", { count: events.data.length });

    for (const event of events.data) {
      const parsed = event.parsedJson as Record<string, unknown>;
      if (parsed.image_hash === imageHash) {
        return {
          txDigest: event.id.txDigest,
          proofId: String(parsed.proof_id ?? ""),
        };
      }
    }

    return null;
  } catch (error) {
    logger.error("SUI", "Event query failed", error);
    return null;
  }
}

/**
 * Fetch recent proofs globally for this package by querying events.
 */
export async function getProofs(limit = 20): Promise<ProofData[]> {
  try {
    const suiClient = getSuiClient();
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PROOF_PACKAGE_ID}::snapproof::ProofCreated`,
      },
      limit,
      order: "descending",
    });

    const results: ProofData[] = [];
    for (const event of events.data) {
      const parsed = event.parsedJson as any;
      results.push({
        id: parsed.proof_id,
        imageHash: parsed.image_hash,
        metadataHash: parsed.metadata_hash,
        proofHash: parsed.proof_hash,
        walrusBlobId: parsed.walrus_blob_id,
        createdAt: Number(parsed.created_at || 0),
        creator: event.sender,
        coarseGeoHash: parsed.coarse_geo_hash || "",
        caseId: parsed.case_id || "",
      });
    }
    return results;
  } catch (error) {
    logger.error("SUI", "Failed to fetch proofs", error);
    return [];
  }
}

/**
 * Check wallet balance. Returns SUI balance in MIST.
 */
export async function getBalance(): Promise<bigint> {
  const suiClient = getSuiClient();
  const keypair = await getKeypair();
  const balance = await suiClient.getBalance({
    owner: keypair.toSuiAddress(),
  });
  return BigInt(balance.totalBalance);
}

/**
 * Request gas from Sui faucet (Devnet/Testnet).
 */
export async function faucet(): Promise<void> {
  try {
    const keypair = await getKeypair();
    const address = keypair.toSuiAddress();
    
    // In a real app, you might use a dedicated faucet package or service
    // For Devnet/Testnet, we can use the official faucet URL
    const faucetUrl = SUI_NETWORK === "devnet" 
      ? "https://faucet.devnet.sui.io/gas"
      : "https://faucet.testnet.sui.io/gas";
      
    const response = await fetch(faucetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ FixedAmountRequest: { recipient: address } }),
    });
    
    if (!response.ok) {
      throw new Error(`Faucet request failed: ${response.statusText}`);
    }
    
    logger.info("SUI", "Faucet request successful");
  } catch (error) {
    logger.error("SUI", "Faucet error", error);
    throw error;
  }
}


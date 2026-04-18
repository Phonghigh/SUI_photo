import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { logger } from "../utils/logger";
import { track } from "./analytics";
import {
  extractMetadata,
  hashMetadata,
  computeProofHash,
} from "../utils/hash";
import { encodeGeohash } from "../utils/geohash";
import { uploadToWalrus } from "./walrus";
import { createProofOnSui } from "./sui";
import { getAddress } from "./wallet";
import type { ProofData } from "../types/proof";

export interface OutboxItem {
  id: string;
  imageUri: string;
  exif: Record<string, any> | null;
  location: { lat: number; lng: number } | null;
  liveHash: string;
  status: "pending" | "failed" | "uploading";
  createdAt: number;
  lastError?: string;
  retryCount: number;
}

const OUTBOX_FILE = FileSystem.documentDirectory + "snapproof_outbox.json";

/**
 * Get all items in the outbox.
 */
export async function getOutboxQueue(): Promise<OutboxItem[]> {
  if (Platform.OS === "web") {
    try {
      const data = window.localStorage.getItem("snapproof_outbox");
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(OUTBOX_FILE);
    if (!info.exists) return [];
    const data = await FileSystem.readAsStringAsync(OUTBOX_FILE);
    return JSON.parse(data) as OutboxItem[];
  } catch (error) {
    logger.error("OUTBOX", "Failed to read outbox", { error });
    return [];
  }
}

/**
 * Save the entire queue.
 */
async function saveOutboxQueue(queue: OutboxItem[]): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem("snapproof_outbox", JSON.stringify(queue));
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(OUTBOX_FILE, JSON.stringify(queue));
  } catch (error) {
    logger.error("OUTBOX", "Failed to write outbox", { error });
  }
}

/**
 * Add a failed/offline submission to the outbox.
 * Copies the temporary image file to a permanent document directory.
 */
export async function enqueueProof(
  imageUri: string,
  exif: Record<string, any> | null,
  location: { lat: number; lng: number } | null,
  liveHash: string,
  lastError?: string
): Promise<void> {
  const id = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
  
  // Copy image to permanent storage so OS doesn't delete it
  let permanentUri = imageUri;
  if (Platform.OS !== "web" && !imageUri.startsWith(FileSystem.documentDirectory!)) {
    try {
      const extension = imageUri.split('.').pop() || "jpg";
      permanentUri = `${FileSystem.documentDirectory}snapproof_outbox_${id}.${extension}`;
      await FileSystem.copyAsync({ from: imageUri, to: permanentUri });
    } catch (error) {
      logger.error("OUTBOX", "Failed to copy image to permanent storage", { error });
      // Fallback to original uri if copy fails
      permanentUri = imageUri;
    }
  }

  const newItem: OutboxItem = {
    id,
    imageUri: permanentUri,
    exif,
    location,
    liveHash,
    status: "pending",
    createdAt: Date.now(),
    lastError,
    retryCount: 0,
  };

  const queue = await getOutboxQueue();
  queue.push(newItem);
  await saveOutboxQueue(queue);

  track({ name: "outbox_enqueued", props: { id, queueSize: queue.length } });
  logger.info("OUTBOX", "Enqueued new proof", { id });
}

/**
 * Update a specific item in the outbox.
 */
export async function updateOutboxItem(id: string, updates: Partial<OutboxItem>): Promise<void> {
  const queue = await getOutboxQueue();
  const index = queue.findIndex(item => item.id === id);
  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates };
    await saveOutboxQueue(queue);
  }
}

/**
 * Remove an item from the outbox (after successful upload or user deletion).
 * Also deletes the permanent file copy.
 */
export async function removeOutboxItem(id: string): Promise<void> {
  const queue = await getOutboxQueue();
  const index = queue.findIndex(item => item.id === id);
  
  if (index !== -1) {
    const item = queue[index];
    queue.splice(index, 1);
    await saveOutboxQueue(queue);

    // Clean up file
    if (Platform.OS !== "web" && item.imageUri.startsWith(FileSystem.documentDirectory!)) {
      try {
        await FileSystem.deleteAsync(item.imageUri, { idempotent: true });
      } catch (e) {
        logger.warn("OUTBOX", "Failed to delete file on remove", { uri: item.imageUri });
      }
    }
    logger.info("OUTBOX", "Removed item", { id });
  }
}

/**
 * Attempt to process a single item in the outbox.
 * Returns the txDigest if successful, throws an error if it fails.
 */
export async function processOutboxItem(item: OutboxItem): Promise<string> {
  const walletAddress = await getAddress();
  
  await updateOutboxItem(item.id, { status: "uploading", retryCount: item.retryCount + 1 });

  let coarseGeoHash = "";
  if (item.location) {
    coarseGeoHash = encodeGeohash(item.location.lat, item.location.lng, 6);
  }

  // Extract metadata (using original timestamp from EXIF if possible)
  const metadata = await extractMetadata(item.imageUri, item.exif || undefined);
  const metadataHash = await hashMetadata(metadata);
  
  // Combine hashes
  const proofHash = await computeProofHash(item.liveHash, metadataHash);

  // Upload to Walrus
  const walrusResult = await uploadToWalrus(item.imageUri);

  // Create on Sui
  const proof: ProofData = {
    imageHash: item.liveHash,
    metadataHash,
    proofHash,
    walrusBlobId: walrusResult.blobId,
    createdAt: item.createdAt, // use original capture time!
    creator: walletAddress,
    coarseGeoHash: coarseGeoHash || undefined,
  };

  const { txDigest } = await createProofOnSui(proof);
  
  // Success! Remove from outbox
  await removeOutboxItem(item.id);
  
  track({ name: "outbox_processed", props: { id: item.id, txDigest } });
  logger.info("OUTBOX", "Successfully processed outbox item", { id: item.id, txDigest });
  
  return txDigest;
}

/**
 * Process the entire queue in FIFO order.
 * Safe to call concurrently (checks uploading status).
 */
export async function processQueue(): Promise<void> {
  const queue = await getOutboxQueue();
  const pending = queue.filter(i => i.status === "pending" || i.status === "failed");
  
  if (pending.length === 0) return;
  
  logger.info("OUTBOX", `Starting to process queue (${pending.length} items)`);
  
  for (const item of pending) {
    try {
      await processOutboxItem(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("OUTBOX", "Failed to process item", { id: item.id, error: msg });
      
      // Stop processing the rest of the queue if one fails (assume network is still bad)
      await updateOutboxItem(item.id, { status: "failed", lastError: msg });
      break; 
    }
  }
}

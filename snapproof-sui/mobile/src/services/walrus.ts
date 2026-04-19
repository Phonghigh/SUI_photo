import { Platform } from "react-native";
import {
  WALRUS_PUBLISHER_URL,
  WALRUS_AGGREGATOR_URL,
  WALRUS_AGGREGATOR_URLS,
} from "../config";
import { logger } from "../utils/logger";

interface WalrusNewlyCreated {
  newlyCreated: {
    blobObject: {
      id: string;
      blobId: string;
      size: number;
      encodingType: string;
    };
    cost: number;
  };
}

interface WalrusAlreadyCertified {
  alreadyCertified: {
    blobId: string;
    endEpoch: number;
  };
}

type WalrusResponse = WalrusNewlyCreated | WalrusAlreadyCertified;

export interface WalrusUploadResult {
  blobId: string;
  isNew: boolean;
}

/**
 * Get the image as a Uint8Array, handling both web blob URIs and native file URIs.
 */
async function getImageBytes(imageUri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") {
    // On web, imageUri is a blob: URL — use fetch to read it
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // On native, use expo-file-system to read as base64, then convert
  const FileSystem = await import("expo-file-system/legacy");
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Upload an image to Walrus and return the blob ID.
 * Uses the Walrus HTTP publisher API (PUT /v1/blobs).
 */
export async function uploadToWalrus(
  imageUri: string
): Promise<WalrusUploadResult> {
  logger.info("WALRUS", "Starting upload", { imageUri });

  const bytes = await getImageBytes(imageUri);
  logger.debug("WALRUS", "Image data prepared", { size: bytes.length });

  const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Walrus upload failed (${response.status}): ${errorText}`);
  }

  const data: WalrusResponse = await response.json();
  logger.debug("WALRUS", "Upload response received", data);

  if ("newlyCreated" in data) {
    return {
      blobId: data.newlyCreated.blobObject.blobId,
      isNew: true,
    };
  }

  if ("alreadyCertified" in data) {
    return {
      blobId: data.alreadyCertified.blobId,
      isNew: false,
    };
  }

  throw new Error("Unexpected Walrus response format");
}

/**
 * Get the canonical URL to view/download a blob from Walrus.
 * Prefer `getWalrusViewUrls(blobId)` when you can, so the caller can fall
 * through to another aggregator on 403 / 404 / 5xx.
 */
export function getWalrusViewUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
}

/**
 * Get every candidate URL for a blob across the configured aggregator chain,
 * in priority order. The primary aggregator comes first; public mirrors follow.
 *
 * Use with `<ResilientImage uris={…} />` so a single mirror 403ing for a
 * specific blob doesn't kill the thumbnail.
 */
export function getWalrusViewUrls(blobId: string): string[] {
  if (!blobId) return [];
  return WALRUS_AGGREGATOR_URLS.map((base) => `${base}/v1/blobs/${blobId}`);
}

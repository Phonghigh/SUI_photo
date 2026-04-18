import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Read a local image file and compute its SHA-256 hash.
 * Works on both native (expo-file-system) and web (fetch + Web Crypto).
 */
export async function hashImage(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    return hashImageWeb(uri);
  }
  return hashImageNative(uri);
}

async function hashImageNative(uri: string): Promise<string> {
  const FileSystem = await import("expo-file-system/legacy");
  // Read as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  // Convert base64 to Uint8Array to hash raw bytes
  const bytes = base64ToUint8Array(base64);
  
  // Hash the raw byte array using @noble/hashes
  const hashBytes = sha256(bytes);
  return bytesToHex(hashBytes);
}

/**
 * Utility to convert base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function hashImageWeb(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ImageMetadata {
  timestamp: number;
  fileSize: number;
  fileName: string;
}

/**
 * Extract basic metadata from an image file.
 */
export async function extractMetadata(
  uri: string,
  exif?: Record<string, any>
): Promise<ImageMetadata> {
  let fileSize = 0;
  let timestamp = Date.now();

  // Try to get timestamp from EXIF if available
  if (exif) {
    // Expo ImagePicker EXIF often uses 'DateTime' or 'DateTimeOriginal'
    const rawDate = exif.DateTimeOriginal || exif.DateTime;
    if (rawDate && typeof rawDate === "string") {
      // Format is often "YYYY:MM:DD HH:MM:SS" -> convert to ISO for JS Date
      const isoDate = rawDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
      const parsed = new Date(isoDate).getTime();
      if (!isNaN(parsed)) {
        timestamp = parsed;
      }
    }
  }

  if (Platform.OS === "web") {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      fileSize = blob.size;
    } catch {
      fileSize = 0;
    }
  } else {
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      fileSize = fileInfo.exists ? (fileInfo.size ?? 0) : 0;
    } catch {
      fileSize = 0;
    }
  }

  return {
    timestamp,
    fileSize,
    fileName: uri.split("/").pop() ?? "unknown",
  };
}

/**
 * Compute a SHA-256 hash of metadata fields.
 */
export async function hashMetadata(metadata: ImageMetadata): Promise<string> {
  const metadataString = JSON.stringify({
    timestamp: metadata.timestamp,
    fileSize: metadata.fileSize,
    fileName: metadata.fileName,
  });

  if (Platform.OS === "web") {
    const encoder = new TextEncoder();
    const data = encoder.encode(metadataString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    metadataString
  );
}

/**
 * Combine image hash and metadata hash into a single proof hash.
 */
export async function computeProofHash(
  imageHash: string,
  metadataHash: string
): Promise<string> {
  const combined = `${imageHash}:${metadataHash}`;

  if (Platform.OS === "web") {
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combined);
}

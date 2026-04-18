/**
 * Short-lived in-memory cache for full `PhotoProof` details.
 *
 * The map screen fetches proofs from `ProofCreated` events, which don't
 * carry `walrus_blob_id`. To render image thumbnails we need the full
 * on-chain object, which lives behind `getProofById(objectId)`.
 *
 * This module dedupes concurrent requests for the same object ID and
 * caches results (and failures) for a short TTL so a busy map screen
 * doesn't spam the RPC as the user pans / taps / re-enters the screen.
 */

import { getProofById } from "./sui";
import { getWalrusViewUrl } from "./walrus";
import type { ProofData } from "../types/proof";
import { logger } from "../utils/logger";

export interface ProofDetails extends ProofData {
  /** Walrus aggregator URL for the blob, or null if not available. */
  imageUrl: string | null;
}

type Entry = {
  /** Promise returned to all callers while a fetch is in flight. */
  promise: Promise<ProofDetails | null>;
  /** When the cached value expires (ms epoch). */
  expiresAt: number;
};

const SUCCESS_TTL_MS = 10 * 60 * 1000; // 10 minutes — proofs are immutable
const FAILURE_TTL_MS = 30 * 1000;      // 30 seconds — don't retry hot-loops

const cache = new Map<string, Entry>();

function isFresh(entry: Entry | undefined): entry is Entry {
  return !!entry && entry.expiresAt > Date.now();
}

/**
 * Fetch full proof details by object ID. Safe to call repeatedly; results
 * are cached and concurrent callers share the same Promise.
 */
export function getProofDetailsCached(
  objectId: string
): Promise<ProofDetails | null> {
  if (!objectId) return Promise.resolve(null);

  const existing = cache.get(objectId);
  if (isFresh(existing)) return existing.promise;

  const promise = (async (): Promise<ProofDetails | null> => {
    try {
      const proof = await getProofById(objectId);
      if (!proof) return null;
      const imageUrl = proof.walrusBlobId
        ? getWalrusViewUrl(proof.walrusBlobId)
        : null;
      return { ...proof, imageUrl };
    } catch (err) {
      logger.warn("PROOF_DETAILS", "fetch failed", {
        objectId,
        err: String(err),
      });
      return null;
    }
  })();

  const entry: Entry = {
    promise,
    // Start with a short TTL; extend on success.
    expiresAt: Date.now() + FAILURE_TTL_MS,
  };
  cache.set(objectId, entry);

  promise.then((result) => {
    // Extend the TTL when we got a real answer. Failures keep the short TTL
    // so we retry after ~30 s (matches web verifier's lookup cadence).
    if (result) {
      entry.expiresAt = Date.now() + SUCCESS_TTL_MS;
    }
  });

  return promise;
}

/**
 * Batch helper: issue `getProofDetailsCached` for each ID with a bounded
 * concurrency limit, returning a map of objectId → result.
 *
 * Used by the list view to hydrate image URLs for the first N viewable
 * items without blasting the RPC.
 */
export async function prefetchProofDetails(
  objectIds: string[],
  concurrency = 6
): Promise<Record<string, ProofDetails | null>> {
  const unique = Array.from(new Set(objectIds.filter(Boolean)));
  const result: Record<string, ProofDetails | null> = {};

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const i = cursor++;
      const id = unique[i];
      result[id] = await getProofDetailsCached(id);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, worker)
  );
  return result;
}

/** Clear the cache. Testing / screen re-entry only. */
export function clearProofDetailsCache(): void {
  cache.clear();
}

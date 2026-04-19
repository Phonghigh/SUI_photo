/**
 * ResilientImage
 * ---------------------------------------------------------------
 * Walks an ordered list of URIs, rendering the first one that loads.
 * If a URI errors (e.g. a Walrus aggregator returns 403 because it
 * doesn't have that blob's shards replicated), we transparently
 * advance to the next URI. `onAllFailed` only fires after every URI
 * in the chain has been tried.
 *
 * Usage:
 *
 *   <ResilientImage
 *     uris={getWalrusViewUrls(blobId)}
 *     style={{ width: 64, height: 64, borderRadius: 10 }}
 *     onAllFailed={(err) => setError(err)}
 *     renderFallback={() => <TextFingerprint hash={hash} />}
 *   />
 *
 * Design notes:
 *   - We key the underlying <Image> by its current URI so RN mounts
 *     a fresh native image node each time — avoids a stale cached
 *     failure state from the previous URI.
 *   - First-URI-miss is logged at `warn`, final giving-up is logged
 *     at `warn` too (not `error`) because the ResilientImage has a
 *     graceful `renderFallback`. Bubble up to `error` in the caller
 *     only if the fallback itself is unacceptable.
 */

import React, { useState, useCallback, ReactNode } from "react";
import {
  Image,
  ImageProps,
  ImageStyle,
  StyleProp,
  NativeSyntheticEvent,
  ImageErrorEventData,
} from "react-native";
import { logger } from "../utils/logger";

type ImagePropsBase = Omit<ImageProps, "source" | "onError" | "onLoad"> & {
  style?: StyleProp<ImageStyle>;
};

interface ResilientImageProps extends ImagePropsBase {
  /** Ordered list of candidate URIs. Tried left-to-right. */
  uris: string[];
  /** Rendered when every URI fails. */
  renderFallback?: (lastError?: string) => ReactNode;
  /** Fired after all URIs have been tried, with the most recent error. */
  onAllFailed?: (err: string) => void;
  /** Fired once the image loads successfully. */
  onLoaded?: (uri: string) => void;
  /** Optional tag to namespace logs (defaults to "IMG"). */
  logTag?: string;
}

export function ResilientImage({
  uris,
  renderFallback,
  onAllFailed,
  onLoaded,
  logTag = "IMG",
  ...imageProps
}: ResilientImageProps) {
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [lastError, setLastError] = useState<string>("");

  const handleError = useCallback(
    (e: NativeSyntheticEvent<ImageErrorEventData>) => {
      // RN's ImageErrorEventData has shape { error: string } on most
      // platforms; be defensive.
      const err =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e?.nativeEvent as any)?.error ?? "unknown image load error";
      const currentUri = uris[index];
      setLastError(String(err));

      if (index + 1 < uris.length) {
        logger.warn(logTag, "Image URI failed, trying next mirror", {
          tried: currentUri,
          next: uris[index + 1],
          err: String(err).slice(0, 160),
        });
        setIndex(index + 1);
        return;
      }

      // No more mirrors to try.
      logger.warn(logTag, "All image mirrors exhausted", {
        count: uris.length,
        lastErr: String(err).slice(0, 160),
      });
      setExhausted(true);
      onAllFailed?.(String(err));
    },
    [index, uris, logTag, onAllFailed]
  );

  const handleLoad = useCallback(() => {
    onLoaded?.(uris[index]);
  }, [index, uris, onLoaded]);

  if (exhausted || uris.length === 0) {
    return <>{renderFallback?.(lastError)}</>;
  }

  const currentUri = uris[index];
  return (
    <Image
      // Re-mounting on URI change is intentional — defeats any stale native
      // cache for the previously-failing URI.
      key={currentUri}
      source={{ uri: currentUri }}
      onError={handleError}
      onLoad={handleLoad}
      {...imageProps}
    />
  );
}

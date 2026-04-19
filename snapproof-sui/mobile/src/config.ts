// Sui network: "testnet" | "devnet" | "mainnet"
export const SUI_NETWORK: "testnet" | "devnet" | "mainnet" =
  (process.env.EXPO_PUBLIC_SUI_NETWORK as "testnet" | "devnet" | "mainnet") ??
  "testnet";

// Package ID of the deployed SnapProof Move contract.
export const PROOF_PACKAGE_ID =
  process.env.EXPO_PUBLIC_PROOF_PACKAGE_ID ??
  "";

// Walrus publisher endpoint (for uploading blobs)
export const WALRUS_PUBLISHER_URL =
  process.env.EXPO_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

// Walrus aggregator endpoint (for reading/viewing blobs).
// NOTE: Testnet aggregators don't all hold every blob's shards — one returning
// 403 doesn't mean the blob is lost; another mirror usually has it.
// We expose both the single canonical URL (back-compat) and an ordered list
// that the image loader walks through on failure.
export const WALRUS_AGGREGATOR_URL =
  process.env.EXPO_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

/**
 * Ordered list of public Walrus testnet aggregator mirrors, tried left-to-right.
 * Override with a comma-separated list in `EXPO_PUBLIC_WALRUS_AGGREGATOR_URLS`.
 * The primary (env-configured) aggregator is always first.
 */
export const WALRUS_AGGREGATOR_URLS: string[] = (() => {
  const fromEnv = process.env.EXPO_PUBLIC_WALRUS_AGGREGATOR_URLS;
  if (fromEnv) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const defaults = [
    WALRUS_AGGREGATOR_URL,
    "https://walrus-testnet-aggregator.nodes.guru",
    "https://walrus-testnet-aggregator.stakecraft.com",
    "https://walrus-testnet-aggregator.redundex.com",
    "https://suiet-walrus-testnet-aggregator.everstake.one",
    "https://sui-walrus-testnet-aggregator.bwarelabs.com",
  ];
  // Dedupe in case the env aggregator also appears in the list above.
  return Array.from(new Set(defaults));
})();

// Backend API URL (for proof indexing)
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// Google Maps API key
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Public URL of the web verifier (Next.js). Used for "Copy Link" on receipts.
export const WEB_VERIFIER_URL =
  process.env.EXPO_PUBLIC_WEB_VERIFIER_URL ?? "http://localhost:3000";

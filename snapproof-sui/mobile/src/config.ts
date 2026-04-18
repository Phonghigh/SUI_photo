// Sui network: "testnet" | "devnet" | "mainnet"
export const SUI_NETWORK: "testnet" | "devnet" | "mainnet" =
  (process.env.EXPO_PUBLIC_SUI_NETWORK as "testnet" | "devnet" | "mainnet") ??
  "testnet";

// Package ID of the deployed SnapProof Move contract.
export const PROOF_PACKAGE_ID =
  process.env.EXPO_PUBLIC_PROOF_PACKAGE_ID ??
  "0x8cb3e3d082971bde081c3af6b794fa3748cc454985cdc98140c20892a5cd3321";

// Walrus publisher endpoint (for uploading blobs)
export const WALRUS_PUBLISHER_URL =
  process.env.EXPO_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

// Walrus aggregator endpoint (for reading/viewing blobs)
export const WALRUS_AGGREGATOR_URL =
  process.env.EXPO_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

// Backend API URL (for proof indexing)
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// Google Maps API key
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
# Glossary

Short definitions for every domain term used across the docs and source.

**Aggregator (Walrus)** — The Walrus HTTP endpoint that serves `GET /v1/blobs/:blobId` for reading uploaded content. In config: `WALRUS_AGGREGATOR_URL`.

**Blob ID (Walrus)** — Content-addressed identifier returned by the Walrus publisher after an upload. Same bytes always produce the same ID.

**Case ID** — Optional free-form string on a `PhotoProof`. Intended for grouping multiple proofs that belong to the same investigation or report. Not validated or bound to any on-chain object in the MVP.

**Coarse geohash** — A geohash truncated to precision 6 (~1.2 km cell). Used so on-chain location data reveals the neighborhood but not the exact coordinates.

**create_proof** — The single entry function in `snapproof::snapproof`. Creates a `PhotoProof` and emits a `ProofCreated` event.

**Ed25519 keypair** — The signature scheme used by Sui wallets in this app. Generated locally by `@mysten/sui/keypairs/ed25519` on first launch, stored in secure storage.

**EXIF** — Metadata embedded in photos (camera make, time taken, GPS, etc.). The mobile app reads `DateTimeOriginal` / `DateTime` to timestamp proofs more accurately.

**Expo Router** — File-based navigation for Expo. Every file under `mobile/app/` is a screen; the stack is configured in `_layout.tsx`.

**Faucet** — Public service that gives out testnet SUI tokens for free. Called via `POST https://faucet.testnet.sui.io/v1/gas`.

**Fullnode** — Public Sui RPC endpoint. Selected by network via `getFullnodeUrl(network)`.

**Geohash** — String encoding of lat/lng into a base-32 grid. Prefixes represent nested bounding boxes; the shorter the prefix, the bigger the box.

**Image hash** — Lowercase hex SHA-256 of the raw image bytes.

**Metadata hash** — Lowercase hex SHA-256 of `JSON.stringify({timestamp, fileSize, fileName})`.

**MIST** — The smallest unit of SUI. `1 SUI = 10^9 MIST`. `getBalance()` returns MIST; the UI divides by `1_000_000_000` for display.

**Move** — Sui's smart contract language. This project uses edition `2024.beta`.

**Object ID** — Sui's on-chain reference to an object (e.g. a `PhotoProof`). Always `0x` + 64 hex chars.

**Package ID** — The address under which a Move package is published. In config: `PROOF_PACKAGE_ID`. Changes on every fresh publish unless you use `sui client upgrade`.

**PhotoProof** — The owned Move object that records a proof. Defined in `contracts/sources/snapproof.move`.

**ProofCreated** — Move event emitted on `create_proof`. Used by off-chain readers to discover proofs without scanning every address.

**ProofData** — TypeScript type for a proof's payload fields, used on both mobile and backend.

**ProofRecord** — TypeScript type for a proof as it's read back — `ProofData` plus `txDigest` and `objectId`.

**Proof hash** — Lowercase hex SHA-256 of `"${image_hash}:${metadata_hash}"`. A single-field fingerprint of a proof.

**Publisher (Walrus)** — The Walrus HTTP endpoint accepting `PUT /v1/blobs?epochs=N`. In config: `WALRUS_PUBLISHER_URL`.

**Proof Map** — The screen at `app/map.tsx` that plots proofs with a non-empty `coarse_geo_hash` as markers on a `react-native-maps` view.

**Receipt** — The proof detail screen (`app/proof.tsx`) shown after a successful submit. Displays all hashes, the tx digest, explorer links, and a share action.

**SDK (Sui)** — `@mysten/sui`. Used on both the mobile and backend to talk to a Sui fullnode.

**SUI** — The network token used to pay gas. 1 SUI = 10^9 MIST.

**SuiClient** — The RPC client constructed from `@mysten/sui/client`. One instance per process, lazily created.

**Sui Explorer (SuiScan)** — Public block explorer. Transactions: `https://suiscan.xyz/<network>/tx/<digest>`. Objects: `https://suiscan.xyz/<network>/object/<id>`.

**Testnet** — The public Sui test network. Current default across all `.env` files.

**Transaction digest (txDigest)** — Base58 identifier of a submitted Sui transaction. Returned by `signAndExecuteTransaction`.

**Upgrade capability** — A Sui object minted when a Move package is published. Holding it is required to preserve the package address across upgrades (`sui client upgrade`). Ours is recorded in `contracts/Published.toml`.

**Walrus** — Sui's decentralized blob storage. We use it to store the original image bytes; only the blob ID goes on chain.

**zkLogin** — Sui's social-login-to-wallet primitive. Listed as a nice-to-have in `TASKS.md`; not implemented in the MVP.

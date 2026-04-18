# Architecture

## One-paragraph summary

SnapProof is a three-tier system: a **React Native / Expo mobile app** captures a photo and hashes it locally, a **Sui Move smart contract** stores the hash as an on-chain `PhotoProof` object (and emits a `ProofCreated` event), and a lightweight **Node.js / Express backend** indexes those events so the app and third parties can query proofs by hash or object ID. The raw image itself is uploaded to **Walrus** (Sui's decentralized blob storage) — the chain only holds the hash and a reference to the blob. This keeps the on-chain cost constant, preserves user privacy (raw bytes are optional to publish publicly), and makes verification a simple equality check: recompute the SHA-256 of the image, look it up in `ProofCreated` events, and the match proves the image existed at the block's timestamp.

## Component diagram (ASCII)

```
            +--------------------------------+
            |      React Native Mobile       |
            |  (Expo Router, TypeScript)     |
            |                                |
            |  app/index.tsx   Home          |
            |  app/capture.tsx Capture+Submit|
            |  app/proof.tsx   Receipt       |
            |  app/verify.tsx  Verification  |
            |  app/map.tsx     Geo view      |
            |                                |
            |  src/utils/hash.ts   SHA-256   |
            |  src/utils/geohash.ts encode   |
            |  src/services/walrus.ts        |
            |  src/services/sui.ts           |
            |  src/services/wallet.ts        |
            +----+------------+--------+-----+
                 |            |        |
         PUT blob|  moveCall  |  queryEvents / getObject
                 |            |        |
                 v            v        v
         +-------+----+ +-----+--------+---+    +------------------+
         |   Walrus   | |   Sui fullnode   |    |  Backend (Node)  |
         |  publisher | |   (testnet RPC)  |<---+  Express + sui   |
         |  aggregator| | PhotoProof obj   |    |  /api/proofs/... |
         +------------+ | ProofCreated evt |    +--------+---------+
                        +-------^----------+             |
                                |                        |
                                +-- queryEvents ---------+
```

The mobile app talks directly to **both** Walrus and the Sui fullnode. The backend is **optional for the core write/verify path** — it exists to supplement event queries with server-side caching and to expose a simple REST API for other clients that don't want to speak Sui RPC.

## Tier-by-tier responsibilities

### Mobile (`mobile/`)

Owns the entire write path end-to-end. The mobile app:

1. Prompts for camera and coarse-location permissions.
2. Lets the user take a photo or pick one from the library.
3. Reads the raw bytes, computes a SHA-256 over them (`hashImage`).
4. Extracts minimal metadata — EXIF capture time if present, otherwise `Date.now()`, plus file size and name — and hashes that too (`hashMetadata`).
5. Combines image and metadata hashes into a third `proofHash = SHA-256(imageHash + ":" + metadataHash)`.
6. Optionally geohashes the device location at precision 6 (~1.2 km cell) so the exact position is never published.
7. Uploads the image bytes to the Walrus publisher (`PUT /v1/blobs?epochs=5`) and receives a `blobId`.
8. Builds and signs a Sui transaction that calls `snapproof::create_proof(...)` with all of the above.
9. Displays the resulting transaction digest, object ID, and explorer links.

The verify path reads an image, recomputes the hash, and queries `ProofCreated` events for a match.

### Contracts (`contracts/snapproof.move`)

A single Move module, `snapproof::snapproof`, with one struct and one entry function. The struct `PhotoProof` has `key, store` so it's an owned object — when `create_proof` is called, the new proof is transferred to the caller. An event `ProofCreated` is emitted so off-chain indexers (the backend and the mobile app itself) can find proofs without scanning every address.

The chain-side data model deliberately stores **only hashes and identifiers** — no image bytes. The `coarse_geo_hash` and `case_id` are plain strings so they can be empty when not used. Everything is stringly-typed rather than binary so it's trivial to read from explorers and JavaScript alike.

### Backend (`backend/src/`)

Express + `@mysten/sui` client. Three routes:

- `GET /api/proofs` — list recent `ProofCreated` events.
- `GET /api/proofs/by-id/:objectId` — fetch a full `PhotoProof` object's fields.
- `GET /api/proofs/by-hash/:imageHash` and `POST /api/proofs/verify` — scan recent events for a matching image hash and, if found, enrich with the object's full content (which includes `metadata_hash`, `walrus_blob_id`, geohash, and `case_id` that aren't in the event payload).
- `POST /api/proofs` — optional in-memory cache insert, used as a fallback if live querying fails.

The backend is **stateless** apart from an in-memory cache that is cleared on restart. For a production deployment this would be replaced by a persistent index.

## Why this shape

The project splits storage from proof deliberately:

- **On-chain** is small, permanent, and expensive — so we store only the fixed-size hashes and a blob pointer.
- **Walrus** is cheap-to-large, content-addressed, and decentralized — so it holds the full image, and the chain's hash serves as an integrity check for whatever Walrus returns.
- **The backend** is disposable — everything it serves can be reconstructed by re-scanning on-chain events, so losing it is a caching inconvenience, not data loss.

This means the only true sources of truth are the Sui fullnode and Walrus. The mobile app and backend are both just clients.

## Trust model

A verified proof establishes three things:

1. **Integrity** — the image bytes hash to the stored `image_hash`.
2. **Existence-at-time** — the `PhotoProof` object's `created_at` (or, more defensibly, the block timestamp of the creating transaction) shows the proof existed no later than that moment.
3. **Authorship** — the `creator` field is the signing address, so whoever controlled that keypair at the time submitted the proof.

A verified proof does **not** establish that the photo is authentic evidence of the depicted scene. AI generation, re-photography, screen capture, and manipulation prior to capture are all out of scope for the MVP. See `docs/dev/DATA_MODEL.md` for what the proof does and does not claim.

## Data flow: write path

```
1. User taps "Take Photo"
        |
        v  (expo-image-picker)
2. Image URI (local file://)
        |
        v  (hash.ts → expo-crypto)
3. imageHash = SHA-256(bytes)
        |
        v  (extract EXIF/size → hashMetadata)
4. metadataHash = SHA-256(JSON({timestamp, fileSize, fileName}))
        |
        v
5. proofHash = SHA-256(imageHash + ":" + metadataHash)
        |
        v  (optional, if location granted)
6. coarseGeoHash = geohash(lat, lng, precision=6)
        |
        v  (walrus.ts → PUT /v1/blobs?epochs=5)
7. walrusBlobId (returned by Walrus publisher)
        |
        v  (sui.ts → moveCall snapproof::create_proof)
8. txDigest, objectId (from Sui transaction effects)
        |
        v
9. Receipt screen (proof.tsx) with explorer + Walrus links
```

## Data flow: verify path

```
1. User selects image
        |
        v
2. Recompute imageHash
        |
        v  (sui.ts → queryEvents MoveEventType = ProofCreated)
3. Scan most recent events for image_hash match
        |
   found? --no--> show "NOT FOUND"
        |
        yes
        v  (sui.ts → getObject objectId)
4. Fetch full PhotoProof fields (metadata_hash, walrus_blob_id, geohash, ...)
        |
        v
5. Show VERIFIED card with creator, date, explorer link, Walrus link
```

## Non-goals for the MVP

- No user accounts, sign-in, or zkLogin (keypair is generated locally per device).
- No moderation, takedown, or access control on Walrus blobs.
- No AI/deepfake detection — the app verifies byte integrity, not authenticity of the scene.
- No group/case workflow beyond an optional string `case_id`.
- No push notifications or background sync.

## Related documents

- [`WORKFLOWS.md`](./WORKFLOWS.md) — step-by-step user and developer workflows.
- [`DATA_MODEL.md`](./DATA_MODEL.md) — on-chain struct, event, and DTO shapes.
- [`MOBILE.md`](./MOBILE.md), [`CONTRACTS.md`](./CONTRACTS.md), [`BACKEND.md`](./BACKEND.md) — per-tier walkthroughs.
- [`API.md`](./API.md) — backend REST surface.
- [`SETUP.md`](./SETUP.md) — local environment setup.

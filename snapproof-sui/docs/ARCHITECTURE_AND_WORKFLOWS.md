# SnapProof — Detailed Architecture & Workflow Reference

**Last updated:** 2026-04-19
**Status:** MVP complete (Track A shipped). Mobile `v0.2`, Backend `0.2.0`, Web verifier present, Move package published to Sui testnet at `0xf8f5963973c4ca34720937a070eb3e070851f50a2408092496d588574108bf2c`.

This document is the single reference for how SnapProof is put together and how data moves through it. It is intentionally long because it replaces half a dozen tribal-knowledge conversations. Sections 1–4 describe the architecture. Sections 5–9 walk every meaningful workflow end to end. Sections 10–12 cover security, failure recovery, and the decisions that shaped the design.

For problem framing, real-world scenarios, and the Sui-feature roadmap, see [`PROJECT.md`](./PROJECT.md). For code-level walkthroughs of individual workspaces, see [`dev/MOBILE.md`](./dev/MOBILE.md), [`dev/CONTRACTS.md`](./dev/CONTRACTS.md), [`dev/BACKEND.md`](./dev/BACKEND.md), and [`dev/WEB.md`](./dev/WEB.md).

---

## 1. System at a glance

### 1.1 One-paragraph architecture

SnapProof is a three-tier system with an optional fourth tier. A **React Native / Expo mobile app** captures a photo, hashes it locally, uploads the bytes to **Walrus** (Sui's decentralized blob storage), and submits a Sui transaction that calls a single Move entry function in the **`snapproof::snapproof`** package. That transaction constructs a `PhotoProof` owned object, emits a `ProofCreated` event, and transfers the object to the signer. A **Node.js / Express backend** optionally indexes those events into Postgres and exposes a REST API, and a **Next.js web verifier** resolves object IDs and image hashes into shareable public proof pages with client-side re-hashing. The mobile app talks to Walrus and Sui directly on the critical path; the backend and web app are convenience layers that exist to widen distribution and improve operability, not to gate correctness.

### 1.2 Component map (text view)

```
+-------------------+      +-------------------+      +-------------------+
|   Mobile (Expo)   |      |     Web verifier  |      |  3rd-party scripts|
|  iOS / Android /  |      |   (Next.js)       |      |  (curl, SDKs, bots|
|       web         |      |                   |      |                   |
+---------+---------+      +---------+---------+      +---------+---------+
          |                          |                          |
          |   PUT blob / GET blob    |   GET blob               |
          |                          |                          |
          |        queryEvents       |   getObject              |
          |        getObject         |   getTransactionBlock    |
          |        moveCall(create)  |                          |
          |                          |                          |
          v                          v                          v
+--------------+           +-------------------+           +----------------+
|   Walrus     |           |  Sui fullnode     |           |   Backend      |
|  publisher   |<----------+  (testnet RPC)    +---------->|  (Express +    |
|  aggregator  |           |  PhotoProof obj   |           |   Postgres opt)|
+--------------+           |  ProofCreated evt |           +-------+--------+
                           +---------^---------+                   |
                                     | queryEvents + getObject     |
                                     +-----------------------------+
```

The two solid truths of the system are **Sui** (for the hash, creator, and timestamp) and **Walrus** (for the image bytes). Everything else is replaceable.

### 1.3 Why the tiers look this way

Each tier solves a concrete problem that the others cannot solve well:

- **Mobile** owns the write path because the hash must be computed **locally, before upload**. If a server did the hashing, the server could lie about what was hashed. The whole trust story depends on "the bytes that became the hash are the bytes the user saw."
- **Sui** owns the anchor because it is the only component that neither SnapProof's developers nor the user can rewrite. The block timestamp, in particular, is what makes the existence-at-time claim defensible.
- **Walrus** owns the bytes because the chain can't. Putting a multi-MB JPEG on chain would be absurdly expensive and still not give useful semantics; Walrus's content-addressing also makes duplicate uploads idempotent.
- **Backend** owns discovery and operability. Scanning millions of events from a mobile device is slow and unreliable; a Postgres indexer converts it into O(1) lookups. The backend also publishes metrics, health probes, and rate limits that a real HTTP surface needs.
- **Web verifier** owns distribution. Sharing a receipt to a non-crypto recipient has to work without an install; a URL is the universal interoperable format.

---

## 2. Per-tier deep dive

### 2.1 Mobile (`mobile/`)

**Stack.** Expo SDK 54, React Native 0.81, React 19, TypeScript strict. File-based routing via Expo Router (every file under `app/` is a screen). Module alias `@/*` → `src/*`.

**Directory shape (abridged).**

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Stack + analytics init + NetInfo listener
│   ├── index.tsx           # Home
│   ├── capture.tsx         # Capture + submit pipeline
│   ├── proof.tsx           # Receipt (explorer links, Copy Link, Share)
│   ├── verify.tsx          # Verify on-chain / compare-hash modes
│   ├── map.tsx             # Map of recent geo-tagged proofs
│   ├── outbox.tsx          # Offline queue UI
│   └── settings.tsx        # Privacy + capture settings
├── src/
│   ├── config.ts           # env → constants
│   ├── polyfills.ts        # crypto.getRandomValues shim
│   ├── components/         # OnboardingModal
│   ├── services/
│   │   ├── wallet.ts       # keypair bootstrap, faucet, address
│   │   ├── sui.ts          # createProofOnSui, lookupProofByImageHash, getProofById, getBalance
│   │   ├── walrus.ts       # uploadToWalrus, getWalrusViewUrl
│   │   ├── proofDetails.ts # TTL cache + batch prefetch for map thumbs
│   │   ├── analytics.ts    # Sentry-optional + event catalog
│   │   ├── settings.ts     # cameraOnlyMode, hasSeenOnboarding
│   │   └── outbox.ts       # durable queue on expo-file-system
│   ├── types/proof.ts      # ProofData, ProofRecord
│   └── utils/
│       ├── hash.ts         # SHA-256 image/metadata/proof hashing
│       ├── geohash.ts      # base-32 encode/decode
│       └── logger.ts       # tag-prefixed console wrapper
└── index.js                # loads polyfills before expo-router/entry
```

**Responsibilities.**

- Manage the local wallet (Ed25519 keypair, stored in `expo-secure-store` on native / `localStorage` on web).
- Read the image, compute SHA-256 of the bytes, of minimal metadata, and the concatenation.
- Request location at `Accuracy.Balanced` and reduce to a 6-character geohash before anything leaves the device.
- Upload bytes to Walrus, build a `Transaction` with one `moveCall` to `snapproof::create_proof(...)`, sign and execute.
- Render a receipt, a verify screen, a map, and an outbox.
- Fall back to a durable outbox queue on any post-hashing failure; drain the queue when `NetInfo` reports connectivity.

**Platform branches** (the only cross-platform gotchas): `utils/hash.ts` (Web Crypto vs `expo-crypto`), `services/walrus.ts` (blob URL vs file:// read), `services/wallet.ts` / `settings.ts` / `outbox.ts` (localStorage vs secure-store / file-system), `app/map.tsx` (maps render native only), `app/capture.tsx` (alert wrapper).

### 2.2 Contracts (`contracts/`)

**Package.** `snapproof` (Move edition `2024.beta`), one module `snapproof::snapproof`.

**The struct.**

```move
public struct PhotoProof has key, store {
    id: UID,
    creator: address,
    walrus_blob_id: String,
    image_hash: String,
    metadata_hash: String,
    proof_hash: String,
    created_at: u64,
    coarse_geo_hash: String,
    case_id: String,
}
```

Abilities deliberately exclude `copy` and `drop` — proofs can be owned and transferred, never duplicated or silently destroyed.

**The entry function.**

```move
public fun create_proof(
    walrus_blob_id: String,
    image_hash: String,
    metadata_hash: String,
    proof_hash: String,
    created_at: u64,
    coarse_geo_hash: String,
    case_id: String,
    ctx: &mut TxContext,
)
```

Behavior: read `ctx.sender()` as `creator`, allocate a new UID, construct `PhotoProof`, emit `ProofCreated`, `transfer::transfer(proof, creator)`. No precondition checks — the only defended invariant is that whichever address signs becomes `creator`.

**The event.**

```move
public struct ProofCreated has copy, drop {
    proof_id: ID,
    creator: address,
    image_hash: String,
    proof_hash: String,
    created_at: u64,
    coarse_geo_hash: String,
}
```

`metadata_hash`, `walrus_blob_id`, and `case_id` are intentionally **not** in the event — off-chain readers follow up with `getObject(proof_id)` when they need them.

**Published testnet coordinates** (from `contracts/Published.toml`):

| Field | Value |
|-------|-------|
| chain-id | `4c78adac` |
| original-id / published-at | `0xf8f5963973c4ca34720937a070eb3e070851f50a2408092496d588574108bf2c` |
| version | `1` |
| upgrade-capability | `0xcc3d0245c982c0035f96d474bfbc2f74a425ff955b67b818067b44c2c382da2b` |

**Why only one entry function.** Every feature on the roadmap (cases, device attestation, richer metadata) will be delivered by adding new struct fields and either extending `create_proof` (via package upgrade) or adding sibling functions. Keeping the MVP at one function is what made it possible to publish and test the whole system in a few days.

### 2.3 Backend (`backend/`)

**Stack.** Node.js 20 LTS, Express 4, `@mysten/sui`, `pino`/`pino-http`, `express-rate-limit`, zero-dep Prometheus text exporter, optional `pg` (dynamic import) for the indexer, optional `@sentry/node` (dynamic import).

**Layout.**

```
backend/src/
├── index.ts              # Express bootstrap + shutdown hooks
├── logger.ts             # pino
├── analytics.ts          # Sentry optional
├── errors.ts             # HttpError + RFC 7807 handler
├── middleware.ts         # metrics middleware + write rate limiter
├── metrics.ts            # counters / histograms
├── routes/
│   ├── health.ts         # /api/health, /api/health/ready
│   ├── metrics.ts        # /api/metrics (Prometheus text)
│   └── proof.ts          # /api/proofs CRUD + verify
├── services/
│   ├── sui-client.ts     # queryProofEvents, getProofObject, findProofByImageHash
│   └── indexer.ts        # optional Postgres indexer
└── types/proof.ts        # ProofRecord (mirrors mobile)
```

**Lookup preference.** `indexer → on-chain events → in-memory cache fallback`. Clients don't opt in; the server always prefers the most durable available source.

**Key endpoints.**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness. Returns 200 while the process runs. |
| GET | `/api/health/ready` | Readiness. 200 when Sui RPC + indexer are healthy, 503 otherwise. |
| GET | `/api/metrics` | Prometheus text-format dump. |
| GET | `/api/proofs?limit=&cursor=` | Paginated list (cursor is the last row's `createdAt`). |
| GET | `/api/proofs/by-id/:objectId` | Single proof by object ID. |
| GET | `/api/proofs/by-hash/:imageHash` | Proof lookup by image hash (64-hex validated). |
| POST | `/api/proofs` | In-memory cache insert (rate-limited). |
| POST | `/api/proofs/verify` | `{ imageHash } → { verified, proof }` (rate-limited). |

**Error format.** Every response is RFC 7807 `application/problem+json`.

**Metrics.** Four stable counters/histograms:

```
snapproof_http_requests_total               {method, route, status}
snapproof_http_request_duration_seconds     {method, route, status}
snapproof_proof_query_total                 {result ∈ indexer|onchain|cache_fallback}
snapproof_verify_result_total               {result ∈ match|not_found}
```

**Rate limiting.** Applied to write endpoints only. Default 30 req/min/IP. Configurable via `WRITE_RATE_LIMIT_WINDOW_MS` / `WRITE_RATE_LIMIT_MAX`.

**Out of scope (documented).** No auth, no push/pub-sub, no horizontal indexer leader-election. The backend is a thin convenience layer and a durability safety net — not a security boundary.

### 2.4 Web verifier (`web/`)

**Stack.** Next.js app router, TypeScript, Sentry wired at the edge/server/client, Tailwind utility classes. Reads `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_PROOF_PACKAGE_ID` at build time.

**Route shape.**

- `/` — accepts either a Sui object ID (`0x…`) or a 64-hex image hash; redirects accordingly.
- `/p/[objectId]` — canonical public proof page. Resolves the object via `getObject`, fetches the image via the Walrus aggregator, and **re-hashes the downloaded bytes in the browser** before showing a verified card. Includes `opengraph-image` for rich social previews.
- `/h/[hash]` — lookup by image hash. Goes through the backend's `by-hash`, falls back to on-chain scan, and 302s to `/p/[objectId]` once resolved.

**Why it matters operationally.** The verifier is the first non-trivial gateway to third parties. It must be stateless and cacheable so a viral proof doesn't knock the backend over.

### 2.5 Storage tiers, summarized

| Tier | Holds | Durability | Visibility | Rewritable? |
|------|-------|------------|------------|-------------|
| Sui `PhotoProof` object | creator, hashes, blob ID, timestamp, geohash, case ID | Permanent until a future upgrade with a destructor | Public via RPC / explorer | No |
| Sui `ProofCreated` event | subset: proof_id, creator, image_hash, proof_hash, created_at, geohash | Permanent | Public via event index | No |
| Walrus blob | raw image bytes | `epochs=5` lease (MVP) | Public via aggregator | No (content-addressed) |
| Backend Postgres indexer | mirror of `ProofCreated` | Operator-controlled | Private | Yes (operator) |
| Backend in-memory cache | recently-written records | Cleared on restart | Internal | Yes |
| Mobile secure-store | Ed25519 secret key, settings | Device-lifetime | On-device | Via app |
| Mobile outbox JSON | pending submissions | Device-lifetime | On-device | Via app |

Only the top three are authoritative for verification.

---

## 3. Data model and contracts

### 3.1 The hash chain

```
image_hash    = SHA-256(image_bytes)
metadata_hash = SHA-256(JSON.stringify({timestamp, fileSize, fileName}))
proof_hash    = SHA-256(image_hash + ":" + metadata_hash)
```

- Only `image_hash` is strictly required to verify integrity.
- `metadata_hash` proves the specific filename and timestamp recorded.
- `proof_hash` is a convenient single-string fingerprint for display and sharing.

### 3.2 TypeScript DTOs (identical on mobile and backend)

```ts
export interface ProofData {
  imageHash: string;
  metadataHash: string;
  proofHash: string;
  walrusBlobId: string;
  createdAt: number;
  creator?: string;
  coarseGeoHash?: string;
  caseId?: string;
}

export interface ProofRecord extends ProofData {
  txDigest: string;
  objectId: string;
}
```

Mapping from Move's snake_case to TypeScript's camelCase happens in two places: `mobile/src/services/sui.ts` and `backend/src/services/sui-client.ts`.

### 3.3 Explorer URL contract

```
Transaction : ${explorerBase}/tx/${txDigest}
Object      : ${explorerBase}/object/${objectId}
explorerBase ∈ https://suiscan.xyz/{mainnet|testnet|devnet}
```

### 3.4 Trust notes (critical)

- `created_at` is **client-supplied**. The defensible timestamp is the **block timestamp of the creating transaction**, which is a consensus property of Sui, not a client input.
- `creator` is chain-enforced (`ctx.sender()`), so nobody can forge a proof attributed to someone else.
- The hashes attest to bytes only. Nothing about the depicted scene is in scope for the hash itself.
- `coarse_geo_hash` is best-effort; device location is spoofable and should not be treated as GPS-grade evidence.

---

## 4. Deployment and configuration topology

### 4.1 Environments

| Environment | Sui network | Walrus | Backend | Web verifier |
|-------------|-------------|--------|---------|--------------|
| Local dev | `testnet` | testnet publisher/aggregator | `localhost:3001` | `localhost:3000` |
| Staging | `testnet` | testnet | hosted | hosted |
| Production (post-B4) | `mainnet` | mainnet | hosted | hosted |

### 4.2 Environment variables

**Mobile (`EXPO_PUBLIC_*`, all public because Expo inlines them into the bundle):**

```
EXPO_PUBLIC_SUI_NETWORK=testnet
EXPO_PUBLIC_PROOF_PACKAGE_ID=0x8cb3e3d0...3321
EXPO_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
EXPO_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
EXPO_PUBLIC_WEB_VERIFIER_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_APP_VERSION=0.1.0
```

**Backend:**

```
SUI_NETWORK=testnet
PROOF_PACKAGE_ID=0x8cb3e3d0...3321
WALRUS_PUBLISHER_URL=...
WALRUS_AGGREGATOR_URL=...
PORT=3001
LOG_LEVEL=info
DATABASE_URL=postgres://...            # optional; enables indexer
INDEXER_POLL_MS=15000                  # default 15s
WRITE_RATE_LIMIT_WINDOW_MS=60000
WRITE_RATE_LIMIT_MAX=30
SENTRY_DSN=                            # optional
```

**Web:**

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_PROOF_PACKAGE_ID=0x8cb3e3d0...3321
SENTRY_DSN=
```

### 4.3 Process topology

```
Dev machine
├── sui fullnode (public)            # RPC via getFullnodeUrl(network)
├── Walrus publisher/aggregator      # public HTTP
├── backend        (node)            # Express on 3001
├── web            (next)            # Next.js on 3000
├── mobile         (expo start)      # Metro on 8081 (dev)
└── postgres       (optional)        # 5432
```

Production swaps the "dev machine" for a hosted container pair (backend + postgres), a static deploy of the web verifier, and over-the-air Expo updates for mobile.

### 4.4 Package publishing

```
cd contracts
./deploy.sh          # sui move build && sui client publish --gas-budget 100000000 --json
                     # → prints the new packageId and next-step hints
```

After a redeploy, update `EXPO_PUBLIC_PROOF_PACKAGE_ID` in `mobile/.env` and `PROOF_PACKAGE_ID` in `backend/.env`. Historical proofs remain valid but are only discoverable if you also keep the old package ID configured as a secondary event filter (or use `sui client upgrade` to preserve the package address across versions).

---

## 5. End-to-end capture workflow (the headline flow)

This is the single most important sequence in the product. Every tier is involved.

### 5.1 Pre-conditions

- The user has opened the app at least once (wallet bootstrap has run).
- The wallet has non-zero SUI on testnet (faucet button or `sui client faucet`).
- The device has granted camera permission (required) and optionally location permission.

### 5.2 Sequence diagram

```
User   Mobile                     Walrus                 Sui fullnode        Explorer
 |        |                          |                         |                 |
 | tap "Capture Photo"                                                           
 |------->|                                                                      
 |        | initWallet() → getKeypair() / getBalance()                           
 |        |                          |                         |                 
 |        | request camera/loc perms |                         |                 
 |        | pickImage() → expo-image-picker                                      
 |        |                                                                      
 |        | hashImage(uri)           [local SHA-256]                             
 |        | extractMetadata(exif)    [fallback Date.now()]                       
 |        | hashMetadata(meta)       [local SHA-256]                             
 |        | computeProofHash()       [local SHA-256]                             
 |        | encodeGeohash(lat,lng,6) [if loc granted]                            
 |        |                          |                         |                 
 |        | uploadToWalrus(uri)----->| PUT /v1/blobs?epochs=5  |                 
 |        |                          | returns blobId (new or alreadyCertified)  
 |        |<-------------------------|                         |                 
 |        |                          |                         |                 
 |        | build Transaction {                                |                 
 |        |   moveCall ${PKG}::snapproof::create_proof(        |                 
 |        |     blobId, imageHash, metadataHash,               |                 
 |        |     proofHash, createdAt, geohash, caseId)         |                 
 |        | }                                                  |                 
 |        | sign with Ed25519                                  |                 
 |        | signAndExecuteTransaction({                        |                 
 |        |   showEffects, showEvents, showObjectChanges       |                 
 |        | })---------------------->|                         |                 
 |        |                          |                         |                 
 |        |                          |  mempool → consensus → checkpoint          
 |        |                          |  PhotoProof { … }       |                 
 |        |                          |  ProofCreated { … }     |                 
 |        |                          |  transfer → signer      |                 
 |        |<-------------------------|                         |                 
 |        | parse txDigest, objectId from objectChanges        |                 
 |        |                                                                      
 |<-------| navigate to /proof with all fields as params                         
 |        | render:                                                              
 |        |   SuiScan tx link --------------------------->|  view tx             
 |        |   SuiScan object link ------------------------>| view PhotoProof     
 |        |   Walrus aggregator URL    (image preview)                           
 |        |   Copy Link → ${WEB_VERIFIER_URL}/p/${objectId}                      
```

### 5.3 Step-by-step explanation

1. **Wallet init.** On `capture.tsx` mount, `initWallet()` calls `services/wallet.ts.getKeypair()`, which reads a saved secret key from secure-store/localStorage under `snapproof-keypair`. If none, it generates a new `Ed25519Keypair`, writes it back, and caches it in module memory. `getBalance()` fetches SUI balance for the address.
2. **Permissions.** `requestLocationPermission()` asks for foreground coarse location. Camera permission is requested by `expo-image-picker` when the picker launches. On web, camera access goes through `navigator.mediaDevices.getUserMedia` (see `expo-image-picker`'s web shim).
3. **Image acquisition.** `pickImage` launches the camera; `pickFromLibrary` uses the library picker. The latter is **disabled** when `cameraOnlyMode` is true (default on). Both return a `uri` (local file:// on native, blob: on web) and an optional `exif` block.
4. **Hashing.** `utils/hash.ts.hashImage(uri)` reads bytes (via `expo-file-system` natively or `fetch(uri).arrayBuffer()` on web), runs SHA-256, returns lowercase 64-hex. `extractMetadata` prefers EXIF `DateTimeOriginal`/`DateTime`; falls back to `Date.now()`. `hashMetadata` JSON-stringifies `{timestamp, fileSize, fileName}` and hashes. `computeProofHash` hashes the concatenation `image_hash + ":" + metadata_hash`. The image hash is also shown live under the preview (a monospace chip) so users can audit that nothing is mutated before submit.
5. **Geohash.** If location was granted, `utils/geohash.ts.encodeGeohash(lat, lng, 6)` produces a 6-char base-32 geohash (~1.2 km cell). Otherwise the field is an empty string.
6. **Walrus upload.** `services/walrus.ts.uploadToWalrus(uri)` reads the bytes again (identical to what was hashed) and `PUT`s them to `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5` with `Content-Type: application/octet-stream`. The response is parsed from either `newlyCreated.blobObject.blobId` (first upload) or `alreadyCertified.blobId` (duplicate bytes). Either way, the blob ID is content-addressed.
7. **Transaction build.** `services/sui.ts.createProofOnSui(proof)` builds a `Transaction` with one `tx.moveCall({ target, arguments: [tx.pure.string(...), tx.pure.u64(...), ...] })`. Argument order matches the Move function signature exactly — positional, not named.
8. **Sign + execute.** The transaction is signed with the local Ed25519 keypair and submitted via `client.signAndExecuteTransaction({ transaction, signer, options: { showEffects: true, showEvents: true, showObjectChanges: true } })`.
9. **Extract IDs.** The new `PhotoProof` object ID is found by scanning `objectChanges` for the first `created` entry; the transaction digest comes directly from the response. Both are passed to the `/proof` route as query params (the receipt page is a pure render function).
10. **Receipt.** `proof.tsx` shows the image, every hash, the creator address, the timestamp, three canonical links (SuiScan tx, SuiScan object, Walrus aggregator), a **Share Proof** button (plain text message), and a **Copy Link** button that copies `${WEB_VERIFIER_URL}/p/${objectId}`. Both actions emit `share_tapped` / `copy_link_tapped` analytics.

### 5.4 Timing notes

Typical timings on a mid-range phone over home Wi-Fi and Sui testnet:

- Hash + metadata: **under 200 ms** for a ~3 MB photo.
- Walrus upload: **500 ms – 2 s** depending on image size.
- Sui transaction build + sign + execute: **1–3 s** end to end on testnet.
- Total capture-to-receipt: **3–5 s** in the happy path.

### 5.5 Where each failure mode surfaces

| Failure | Surfaced as | Recovery |
|---------|-------------|----------|
| No camera permission | System alert; button disabled. | Enable in system settings. |
| EXIF date missing | Silent. `Date.now()` fallback. | N/A. |
| Walrus publisher 5xx | Red error box; **pipeline enqueues to outbox** with `liveHash` preserved. | Outbox retries on reconnect. |
| Sui fullnode timeout | Red error box; outbox enqueue. | Outbox retries. |
| `No valid gas object` | Red error box with faucet instructions and copyable address. | Tap faucet button or send SUI from another wallet. |
| Object ID parse failure | Red error box; user sees txDigest but no object link. | Re-query via `getObject` once propagation completes. |

---

## 6. End-to-end verification workflow

The complement of capture. Anyone, including strangers, can verify.

### 6.1 On mobile

```
User   Mobile                                         Sui fullnode
 |        |                                                 |
 | tap "Verify Photo"                                        
 |------->|                                                  
 |        |                                                  
 |        | Two modes:                                        
 |        |  [Verify on Chain] / [Compare Hash]              
 |        |                                                  
 | select image (picker) or paste expected hash              
 |------->|                                                  
 |        |                                                  
 |  mode = Verify on Chain                                    
 |        | hashImage(uri) → candidateHash                   
 |        | client.queryEvents({                             
 |        |   query: { MoveEventType: `${PKG}::snapproof::ProofCreated` },
 |        |   order: "descending", limit: 50 })              
 |        |----------------------------------------------->|
 |        |<-----------------------------------------------|
 |        | linear-scan for parsedJson.image_hash === candidateHash
 |        |                                                  
 |        | if match:                                        
 |        |   getProofById(proofId) → full PhotoProof        
 |        | else:                                            
 |        |   show NOT FOUND                                 
 |<-------| show VERIFIED card with date/creator/links        
```

**What the card shows on success.** The image fingerprint, the creator address, the ISO-formatted timestamp, the coarse geohash (if any), and two canonical explorer links (tx + object) plus a Walrus view link.

**Compare Hash mode** is a pure client-side utility: hash the picked file, compare with a pasted expected hex value, show match/mismatch. No network involvement.

### 6.2 On the web (Next.js verifier)

The web path is conceptually identical but lives at a URL.

```
Browser              Next.js                 Backend               Sui fullnode             Walrus aggregator
   |                     |                      |                       |                            |
   | GET /p/[objectId]   |                      |                       |                            |
   |-------------------->|                      |                       |                            |
   |                     | getObject(objectId) ----------------------->|                            |
   |                     |<----------------------------------------------|                            |
   |                     | image URL = aggregator/${blobId}             |                            |
   |<--------------------| HTML + skeleton                              |                            |
   |                     |                                              |                            |
   | fetch image bytes ------------------------------------------------>|                            |
   |<------------------------------------------------------------------                             |
   | sha256(bytes) in-browser (WebCrypto)                                                            |
   | compare to on-chain image_hash                                                                  |
   | render VERIFIED / MISMATCH card                                                                 |
```

For `GET /h/[hash]`, the verifier first calls the backend's `GET /api/proofs/by-hash/:imageHash`; on 404 it falls back to scanning `ProofCreated` events directly via RPC; on success it `302`s to the canonical `/p/[objectId]`. This is how the web verifier stays responsive even if the backend is down — it degrades to the chain.

The `/p/[id]/opengraph-image` route renders a dynamic social preview (Walrus photo + verified card) so the verifier is link-unfurl friendly on Twitter, iMessage, Slack, etc.

### 6.3 Trust boundary during verification

Verification should produce **VERIFIED** if and only if:

- The recomputed `image_hash` equals the `image_hash` recorded in a `ProofCreated` event.
- The associated `PhotoProof` object is still present on chain.
- (Optional) The Walrus blob is still present and matches the same bytes.

Note: The block timestamp is fetched alongside the object for the defensible "existence-at" claim; the UI surfaces both the client-provided `created_at` and the block timestamp when they disagree.

---

## 7. Secondary workflows

### 7.1 Proof map (geographic browse)

```
User → /map
       fetchGeoProofs():
         queryEvents({ MoveEventType, order: "descending", limit: 50 })
       filter events where coarse_geo_hash !== ""
       decodeGeohash(each) → center lat/lng
       react-native-maps: render markers
         ┌ prefetch first 8 pins' Walrus URLs (concurrency 6)
         └ thumbnails render as 40px circular photos ringed in red
       list mode fallback for web
       pagination: "Load More" → queryEvents with cursor = response.nextCursor
```

The thumbnails pipeline deserves a footnote: because `ProofCreated` doesn't carry `walrus_blob_id`, the map screen has to call `getProofById(proofId)` for each marker to derive the image URL. Doing that eagerly for 50 pins would be expensive; doing it lazily would stall the first paint. The compromise is `services/proofDetails.ts`, a TTL-backed in-memory cache (10 min on success, 30 s on failure) with a concurrency-limited batch prefetcher. First 8 pins are prefetched at concurrency 6; the rest hydrate on marker tap (map mode) or when list items enter the viewport at 30% visibility (concurrency 4). Tapping "Open Verifier →" in a marker callout emits `map_proof_opened` and deep-links to the web verifier.

### 7.2 Wallet bootstrap

First-run flow, implicit on any call to `getKeypair()`:

1. Attempt to load secret key from `expo-secure-store` / `localStorage` under `snapproof-keypair`.
2. If absent, generate `new Ed25519Keypair()`, save the secret.
3. Cache the keypair in module memory for the session.
4. Derive the address on demand.

Result: every device has a self-custodial Sui address with zero user action. Trade-off: no recovery. Clearing app storage or losing the device loses the address and any unpriveleged proofs' authorship. This is the motivation for **zkLogin** on the Track B roadmap.

### 7.3 Faucet / wallet funding

Two paths.

- **In-app:** Capture screen → Faucet button → `requestTestnetTokens()` → `POST https://faucet.testnet.sui.io/v1/gas` with the local address. Rate-limit failures are swallowed with a UI message.
- **CLI:** `sui client faucet` (after `sui client switch --env testnet`) or direct transfer from another testnet wallet. The capture error screen prints a copy-paste-friendly transfer command using the local address.

### 7.4 Offline submission queue (outbox)

Offline-first behavior, added in Track A4.

```
capture.submitProof fails past hashing stage
         |
         v
enqueueProof(uri, exif, location, liveHash, lastError)
  - copy image into FileSystem.documentDirectory (so GC doesn't drop it)
  - append { id, uri, exif, location, liveHash, createdAt, retries, lastError } to snapproof_outbox.json
  - emit outbox_enqueued analytics

NetInfo "connected" event          manual "Retry" tap
         \                        /
          \                      /
           v                    v
           processQueue() / processOutboxItem()
             - re-run full pipeline using item.liveHash + item.createdAt
               so the final proof reflects the capture time, not the upload time
             - on success: remove item (and its cached image)
             - on failure: update retries + lastError, stop FIFO drain
```

The outbox UI (`app/outbox.tsx`) shows pending items with thumbnail, truncated hash, age, retry count, last error, and per-item retry/delete controls. A "Retry all" button invokes `processQueue()`.

### 7.5 Settings (privacy + capture)

`app/settings.tsx` exposes two toggles:

- **Camera-only mode.** Default on. When on, the library picker is disabled and a banner says so; capture must happen through `expo-camera` / `expo-image-picker` camera mode.
- **Telemetry opt-in.** Reads `snapproof_telemetry_optin` from secure storage. Flipping the toggle re-initializes the analytics module.

Both writes emit `settings_changed`. Values are read via `loadSettings()` on focus and written via `saveSettings(patch)` per change.

### 7.6 Onboarding modal

On first launch (`hasSeenOnboarding=false`), the capture screen shows `components/OnboardingModal.tsx`, a three-step walkthrough:

1. "SnapProof gives your photo a receipt."
2. "Here's what it proves and what it doesn't." (Honest, explicit about AI being out of scope.)
3. "Your wallet is on this device." Offers a one-tap secret-key reveal for manual backup.

A persistent ℹ️ header button re-opens the modal anytime.

### 7.7 Backend query workflow (`GET /api/proofs`)

```
HTTP GET /api/proofs?limit=50&cursor=...
  ↓
metricsMiddleware stamps http_requests_total
  ↓
indexerEnabled()?
  ├── yes → listProofsPg(limit, cursor)                  result=indexer
  └── no  → queryProofEvents(limit)                      result=onchain
            on error → serve from in-memory proofCache    result=cache_fallback
  ↓
each result records snapproof_proof_query_total
  ↓
respond with { items: ProofRecord[], nextCursor }
```

`GET /api/proofs/verify` follows the same pattern but records into `snapproof_verify_result_total` with `{match, not_found}`. A 429 from the rate limiter still records the Prometheus counter and the analytics event so throttled failures are observable.

### 7.8 Backend indexer workflow

When `DATABASE_URL` is set and `pg` is installed:

```
startIndexer()
  ├── createTableIfMissing("proofs")
  └── setInterval(INDEXER_POLL_MS default 15_000):
        events = queryProofEvents(100)          // newest first
        for e of events:
          UPSERT INTO proofs (object_id, image_hash, ...) VALUES (...)
             ON CONFLICT (object_id) DO UPDATE SET ...
```

Disabled-by-default posture (empty `DATABASE_URL` → no-op, set-but-missing-`pg` → warn and skip) keeps the optional dependency truly optional. Horizontal scale is not supported by this loop; to run multiple replicas, elect a single indexer leader or move to `subscribeEvent`.

### 7.9 Redeploy / schema evolution (developer flow)

Adding a new field to `PhotoProof`:

1. **Move.** Add the field to the struct, to `create_proof`'s parameter list (positional), and — if it should be event-indexable — to `ProofCreated`.
2. **Backend types.** Mirror in `backend/src/types/proof.ts` (and update `getProofObject` + `queryProofEvents` to map it).
3. **Mobile types.** Mirror in `mobile/src/types/proof.ts`.
4. **Mobile sender.** Add the corresponding `tx.pure.<type>(...)` call in `services/sui.ts.createProofOnSui`, **in the same order as the Move signature**.
5. **Mobile UI.** Capture the value, plumb through to receipt/verify screens.
6. **Republish.** Run `./contracts/deploy.sh` (or `sui client upgrade` for a preserved package ID) and update both `.env` files.

Positional arguments, not named — a mis-ordered `tx.pure` is a runtime ABI mismatch, not a compile error.

### 7.10 Recovery after a redeploy with a fresh package ID

Existing `PhotoProof` objects remain valid on chain; they were created under the previous package and don't move. But event subscribers filtered on the **new** `MoveEventType` won't see them. Two clean options:

- Keep the old package ID as a secondary event filter in `mobile/src/services/sui.ts` and `backend/src/services/sui-client.ts`.
- Use `sui client upgrade` (needs the upgrade cap from `contracts/Published.toml`) so the package address is preserved across versions.

The MVP takes the first path when strictly necessary and otherwise treats pre-redeploy proofs as "legacy" (still on chain, not indexed).

---

## 8. Data flow reference (both directions, with field provenance)

### 8.1 Write path (mobile → Sui + Walrus)

```
1. imageUri         (local file:// or blob:)
2. imageBytes       (read from uri)
3. imageHash        = SHA-256(imageBytes)                    → chain
4. metadata          = extractMetadata(uri, exif)
                       {timestamp, fileSize, fileName}
5. metadataHash     = SHA-256(JSON.stringify(metadata))      → chain
6. proofHash        = SHA-256(imageHash + ":" + metadataHash)→ chain
7. geohash          = encodeGeohash(lat, lng, 6) or ""       → chain
8. caseId           = ""                                      → chain (MVP always empty)
9. createdAt        = metadata.timestamp                     → chain (client-supplied!)
10. walrusBlobId    = PUT Walrus publisher (idempotent)      → chain
11. txDigest        = signAndExecuteTransaction(moveCall)
12. objectId        = first objectChanges.created.objectId
13. blockTimestamp  = (available via getTransactionBlock)    → the defensible time
```

### 8.2 Read path (verify)

```
1. candidateImageHash = SHA-256(user's file)
2. events             = queryEvents({ MoveEventType: ProofCreated, order: desc, limit: 50 })
3. match              = events.find(e => e.parsedJson.image_hash === candidateImageHash)
4. if match:
     proofObject     = getObject({ id: match.proof_id, showContent: true })
     fullRecord      = { ...match.parsedJson, metadata_hash, walrus_blob_id, case_id }
     blockTimestamp  = getTransactionBlock(match.txDigest).timestampMs
5. present VERIFIED card with (fullRecord, blockTimestamp, Walrus URL, explorer links)
```

### 8.3 Event payload vs object payload

| Field | In `ProofCreated` event | In `PhotoProof` object |
|-------|-------------------------|------------------------|
| `proof_id` / object id | yes (as `proof_id`) | yes (via `UID`) |
| `creator` | yes | yes |
| `image_hash` | yes | yes |
| `proof_hash` | yes | yes |
| `created_at` | yes | yes |
| `coarse_geo_hash` | yes | yes |
| `metadata_hash` | **no** | yes |
| `walrus_blob_id` | **no** | yes |
| `case_id` | **no** | yes |

Event payloads stay lean; clients that need the full picture hydrate via `getObject(proof_id)`.

---

## 9. Sequence diagrams for the remaining workflows

### 9.1 Outbox drain

```
NetInfo          Outbox (JSON)          Walrus         Sui fullnode
  |                   |                    |                 |
"connected"          queue = [A, B, C]     |                 |
  |---- processQueue()                                        
                      read A                                  
                      ├─ uploadToWalrus(A.uri) --------->|    
                      |<--------------------------------|    
                      └─ createProofOnSui(A.*) -------->|    
                         |<----------------------------|    
                      remove A, delete cached file        
                                                           
                      read B                                  
                      └─ walrus 5xx                         
                        mark B failed, lastError = "..."    
                        stop draining (assume bad network)
```

### 9.2 Backend readiness probe

```
kube-probe → GET /api/health/ready
  → check: suiClient.getLatestCheckpointSequenceNumber() returns within 2s
  → check: indexer.isHealthy() (last poll < 3× poll interval)
  → all green → 200 { ok: true, checks: { ... } }
  → any red   → 503 application/problem+json with checks map
```

### 9.3 Web verifier fallback chain (`/h/[hash]`)

```
Browser                 Next.js                  Backend                Sui fullnode
  |                        |                        |                       |
  | /h/abcd...              |                        |                       |
  |----------------------->|                        |                       |
  |                         | GET /api/proofs/by-hash/abcd --> backend        
  |                         |<-- 200 { proof }       <-- (indexer or on-chain)
  |                         | 302 /p/{objectId}                              
  |<------------------------|                                                
                            |                                                
  (parallel path if backend returns 404)                                     
                            | queryEvents({ MoveEventType: ProofCreated })  
                            |----------------------------------------------->|
                            |<-----------------------------------------------|
                            | 302 /p/{objectId} (or 404 with problem+json)   
```

### 9.4 Mobile map initial load

```
map.tsx mount
  → fetchGeoProofs()                   (queryEvents limit=50, desc)
  → filter events where coarse_geo_hash ≠ ""
  → initial region = decodeGeohash(firstPin) OR Ho Chi Minh City default
  → renderMarkers([...pins])
  → prefetchProofDetails(firstPinIds[:8], concurrency=6)
      for each pin:
        getProofDetailsCached(objectId)
          → in-flight Promise dedup
          → getProofById(objectId) → walrusBlobId
          → imageUrl = getWalrusViewUrl(blobId)
          → cache { success: 10min, failure: 30s }
  → markers with hydrated URLs render photo thumbs; others stay as 4-char hash tiles
onMarkerPress(pin) → hydratePin(pin) → same cache path
onListVisibilityChange(items) → prefetch visible IDs (threshold 30%, concurrency 4)
onCalloutOpenVerifier → openURL(`${WEB_VERIFIER_URL}/p/${proofId}`)
```

---

## 10. Security and threat model

### 10.1 Guarantees the architecture provides

- **Creator authenticity.** `creator = ctx.sender()`. An attacker cannot forge a proof attributed to someone else without stealing that address's secret key.
- **Content integrity.** Any mutation of the image bytes changes `image_hash`, which diverges from the on-chain value → verification fails.
- **Existence-at-time (block-time).** The creating transaction's block timestamp is a consensus fact; it can't be rewritten by the submitter or the app developer.
- **Independence from SnapProof.** A proof remains verifiable if every off-chain component disappears, provided Sui and Walrus are alive.

### 10.2 Things the architecture does NOT guarantee

- **Scene authenticity.** The image might depict a generated scene, a screen re-photograph, or an edited composite from before capture.
- **Timestamp beyond block-time.** `created_at` is client-supplied and can be any `u64`.
- **Device provenance.** Nothing cryptographically binds the bytes to a specific attested device in the MVP.
- **Identity.** The creator is an Ed25519 address with no identity binding. zkLogin (B1) turns this from "anonymous key" into "OIDC-backed account with recovery" but still doesn't assert real-world identity.
- **Blob persistence.** Walrus holds the bytes for `epochs=5` by default; late verifiers may find "hash valid but bytes gone."

### 10.3 Threats to watch

- **Key theft on device.** Secret key lives in OS-keychain-backed secure storage; an adversary with root can exfiltrate. Mitigation (future): zkLogin + optional biometric unlock.
- **Backend DoS.** Rate limiting on writes; readiness probe; metrics alerts on latency and `cache_fallback` rate. CORS is wide open in the MVP — tighten before production.
- **Walrus publisher outage.** Outbox queues submissions; the next online window drains. Mitigation for persistent outage: IPFS fallback abstraction (future).
- **Fullnode trust.** The app trusts the RPC's event payload. Clients paranoid about a single-RPC trust assumption can cross-verify via a second fullnode or SuiScan.

### 10.4 Privacy posture

- Location is reduced to a ~1.2 km cell before anything leaves the device.
- Metadata hash covers only `{timestamp, fileSize, fileName}` — not camera model, not GPS precision, not owner name.
- Walrus holds only the image; no EXIF scrubbing is performed, so users who want EXIF stripped must do it before capture (or we must add a stripping step, tracked in the roadmap as part of B7 NGO mode).
- No PII is sent to Sentry. If user opts in, Sentry sees breadcrumbs and stack traces but not the wallet's secret key or image bytes.

---

## 11. Failure modes and recovery

Exhaustive reference — what breaks, where it surfaces, what the user or operator does.

| Failure | Where it surfaces | User-visible behavior | Recovery |
|---------|-------------------|-----------------------|----------|
| Camera permission denied | Picker launch | Alert + capture button disabled | Enable permission in OS. |
| Location permission denied | Capture screen | Geohash field empty; proof still valid | None needed. |
| Clock skew > 2 min | Capture screen banner | Yellow banner on capture; submission still allowed | Fix device clock. |
| EXIF missing | Silent | `created_at = Date.now()` | None. |
| Walrus publisher 5xx | Capture screen error | Red error box + outbox offer | Outbox auto-retries on reconnect. |
| Walrus publisher rate-limit | Capture screen error | Same as 5xx | Backoff handled by outbox. |
| Sui fullnode timeout | Capture screen error | Red error box + outbox offer | Outbox retries. |
| Gas exhausted | Capture screen error | Inline faucet instructions + address | Tap faucet or transfer SUI in. |
| Transaction reverted | Capture screen error | Message includes Move abort code | Fix inputs and retry; shouldn't happen for `create_proof` since there are no aborts. |
| `objectChanges` empty | Capture screen error | User sees txDigest but no object link | Re-query `getObject` once propagation completes (rare). |
| Verify: hash not found | Verify screen | Grey NOT FOUND card | Confirm correct file; check caseId filter; verify package ID matches the creating network. |
| Verify: Walrus blob 404 | Web verifier page | Card shows "Bytes no longer available; hash still matches event" | User supplies their own copy of the file for the in-browser hash to prove match. |
| Backend 500 | `/api/proofs/*` | RFC 7807 `application/problem+json` | Client falls back to direct RPC (mobile + web already do). |
| Backend 429 | `POST /api/proofs*` | `application/problem+json` with `status: 429` | Client backs off. |
| Backend indexer stale | `/api/health/ready` returns 503 | LB removes the pod from service | Restart backend; verify `DATABASE_URL`; check fullnode reachability. |
| Fullnode slow | Verify + map latency | Pins stream in more slowly; thumbnails lazy | Transparent to users. |
| Net loss mid-capture | Pipeline | Outbox enqueue | Auto-retry. |
| Device wipe | Wallet lost | All future proofs need new address | **Unrecoverable in MVP.** Mitigated by zkLogin (B1). |

---

## 12. Key architectural decisions (ADR-style summary)

This section is a condensed version of the ADRs that shaped the current design. Each decision is presented with the option we took, the main alternative we rejected, and the reason.

### 12.1 Store only hashes on chain, keep bytes on Walrus

**Chosen:** `PhotoProof` holds hashes + Walrus blob ID.
**Rejected:** Storing compressed image bytes as `vector<u8>` inside the object, or in a shared blob table.
**Why:** On-chain bytes are expensive (proportional to size), make explorers unwieldy, and don't add any property the hash doesn't already have. Separating concerns lets each tier optimize for what it's good at.

### 12.2 One owned object per proof

**Chosen:** `PhotoProof` has `key, store` and is transferred to `creator`.
**Rejected:** Shared dictionary of `(image_hash → creator)` maintained by a custom module.
**Why:** Owned objects compose naturally into cases/collections, admit parallel execution, and make ownership a chain-enforced fact. A shared dictionary would be a write-contention hotspot for no semantic gain.

### 12.3 Ed25519 keypair per device, no sign-in

**Chosen:** Generate locally on first launch; store secret in secure storage.
**Rejected:** zkLogin / OIDC-based wallets from day one.
**Why:** Fastest path to demo; TTFP < 60 s including faucet. zkLogin is next on the roadmap because losing the device is the largest unsolved UX risk.

### 12.4 Client-supplied `created_at`, block timestamp as the defensible clock

**Chosen:** `create_proof` takes `created_at: u64` as an argument so the receipt can show the EXIF time.
**Rejected:** Force `created_at = ctx.epoch_timestamp_ms()` inside the contract.
**Why:** EXIF capture time is more useful to the user than the chain clock (which is seconds to minutes later); the defensible claim is always the block timestamp, which is derivable independently without trusting the argument. The docs are explicit about this trust boundary.

### 12.5 Event payload smaller than the object

**Chosen:** `ProofCreated` omits `metadata_hash`, `walrus_blob_id`, and `case_id`.
**Rejected:** Full mirror of `PhotoProof` in the event.
**Why:** Event storage is charged; keeping payloads lean makes high-volume scans cheap. Off-chain readers hydrate via `getObject(proof_id)` for the full record.

### 12.6 Backend is optional, not a dependency

**Chosen:** Mobile talks to Sui and Walrus directly on the critical path; backend is a convenience layer.
**Rejected:** Force all mobile writes/reads through the backend.
**Why:** A dependency on a hosted backend would compromise the trust story — if SnapProof disappears, proofs should remain verifiable. Also makes the backend disposable and easy to replicate.

### 12.7 Indexer is Postgres, not Kafka/SQS

**Chosen:** Pull-based `setInterval` poller that upserts into Postgres.
**Rejected:** Push-based `subscribeEvent` → Kafka → consumer → Postgres.
**Why:** Boring scales further than fancy at this stage. A single poll/upsert loop handles current volume comfortably; `subscribeEvent` is an available upgrade if pull latency becomes a user-visible issue.

### 12.8 Monorepo with four workspaces

**Chosen:** `mobile/`, `contracts/`, `backend/`, `web/` in one repo.
**Rejected:** Four separate repos.
**Why:** Every schema change (§7.9) touches three workspaces; monorepo makes coordinated PRs trivial and reduces CI complexity. The `pnpm-workspace.yaml` and top-level `package.json` are thin.

### 12.9 File-based routing with Expo Router

**Chosen:** Every screen is `app/*.tsx`.
**Rejected:** React Navigation with a central config.
**Why:** Fewer moving parts, lower cognitive overhead. The `_layout.tsx` carries cross-cutting concerns (analytics init, NetInfo listener, stack styling) without dragging a separate navigator spec.

### 12.10 Upgrade capability preserved, unused

**Chosen:** Record the upgrade cap in `contracts/Published.toml` but don't use it yet.
**Rejected:** Discard it / treat each publish as independent.
**Why:** Schema changes (fields on `PhotoProof`, attestation additions) should share a package address to keep historical proofs discoverable. The cap is the primitive that makes that possible, and losing it would force us into the "legacy proofs become invisible" footgun documented in §7.10.

---

## 13. Related documents

- [`PROJECT.md`](./PROJECT.md) — problem framing, real-world scenarios, Sui-feature roadmap.
- [`overview/OVERVIEW.md`](./overview/OVERVIEW.md) — 90-second non-technical summary.
- [`overview/DEMO.md`](./overview/DEMO.md) — two-minute demo script.
- [`dev/ARCHITECTURE.md`](./dev/ARCHITECTURE.md) — earlier, terser architecture notes.
- [`dev/WORKFLOWS.md`](./dev/WORKFLOWS.md) — the workflow reference this document supersedes.
- [`dev/MOBILE.md`](./dev/MOBILE.md), [`dev/CONTRACTS.md`](./dev/CONTRACTS.md), [`dev/BACKEND.md`](./dev/BACKEND.md), [`dev/WEB.md`](./dev/WEB.md) — per-workspace deep dives.
- [`dev/DATA_MODEL.md`](./dev/DATA_MODEL.md) — canonical field reference.
- [`dev/API.md`](./dev/API.md) — REST surface, error format, examples.
- [`dev/GLOSSARY.md`](./dev/GLOSSARY.md) — one-line domain-term definitions.
- [`dev/ROADMAP.md`](./dev/ROADMAP.md) — prioritized enhancements (Tracks A/B/C).
- [`../CHANGELOG.md`](../CHANGELOG.md) — versioned change log.

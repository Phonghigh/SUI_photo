# Data model

This document spells out every piece of data SnapProof stores — where, in what shape, and what it means.

## On-chain (Sui)

### `snapproof::snapproof::PhotoProof` (owned object)

| Field | Type | Provenance | Notes |
|-------|------|------------|-------|
| `id` | `UID` | `object::new(ctx)` | Sui-generated. Its inner address is the `objectId` JS clients see. |
| `creator` | `address` | `ctx.sender()` | Always equals the signer of the creating transaction. Cannot be forged. |
| `walrus_blob_id` | `String` | Mobile client | Opaque handle from the Walrus publisher. Used to fetch the raw image. |
| `image_hash` | `String` | Mobile client | Lowercase hex SHA-256 of image bytes. 64 chars. |
| `metadata_hash` | `String` | Mobile client | Lowercase hex SHA-256 of `JSON.stringify({timestamp, fileSize, fileName})`. |
| `proof_hash` | `String` | Mobile client | Lowercase hex SHA-256 of `"${image_hash}:${metadata_hash}"`. |
| `created_at` | `u64` | Mobile client | Millisecond epoch. Sourced from EXIF if available, else `Date.now()`. See trust note below. |
| `coarse_geo_hash` | `String` | Mobile client | 6-char base-32 geohash (~1.2 km cell) or empty. |
| `case_id` | `String` | Mobile client | Free-form or empty. Not validated. |

**Abilities**: `key, store`. Not `copy` or `drop`, so proofs can be transferred but not duplicated or dropped.

**Ownership**: the object is transferred to `creator` on creation. The creator can move it to another address, bundle it into a collection, or leave it as-is.

### `snapproof::snapproof::ProofCreated` (event)

| Field | Type |
|-------|------|
| `proof_id` | `ID` |
| `creator` | `address` |
| `image_hash` | `String` |
| `proof_hash` | `String` |
| `created_at` | `u64` |
| `coarse_geo_hash` | `String` |

Does **not** include `metadata_hash`, `walrus_blob_id`, or `case_id` — consumers who need those follow up with `getObject(proof_id)`.

### Trust notes (read this before citing the data in an adversarial setting)

- `created_at` is **client-supplied**. The signer can set it to any `u64`. What a verifier can actually defend is the **block timestamp** of the creating transaction — that's in Sui, independent of anything the client sent. For any high-stakes use, derive the time from `txDigest`'s block, not from `created_at`.
- `creator` is **chain-enforced** (it's the `ctx.sender()`), so nobody can forge a proof attributed to someone else.
- The hashes only attest to bytes. Everything about what the bytes depict — authenticity of the scene, whether the photo was taken with a real camera vs. generated — is out of scope.
- `coarse_geo_hash` comes from the device's reported location. Device location is spoofable; treat it as best-effort, not as GPS evidence.

## Off-chain: Walrus

The raw image bytes live at `${WALRUS_AGGREGATOR_URL}/v1/blobs/${walrus_blob_id}` while the blob's `epochs=5` storage period is active. Walrus is content-addressed; `walrus_blob_id` is deterministic from the bytes (which is also why the API distinguishes `newlyCreated` from `alreadyCertified` — uploading the same bytes twice returns the same ID).

No metadata, EXIF, geolocation, or owner info is stored on Walrus — only the image bytes the user selected.

## Off-chain: TypeScript DTOs

`mobile/src/types/proof.ts` and `backend/src/types/proof.ts` are intentionally identical:

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

`ProofData` is the shape we build in memory on the client before writing to chain. `ProofRecord` is what we get back after the write (with the transaction digest) and what the backend serves.

The JS side uses camelCase; the chain uses snake_case. All of the mapping is done in two places:

- `mobile/src/services/sui.ts` (`createProofOnSui`, `getProofById`)
- `backend/src/services/sui-client.ts` (`queryProofEvents`, `getProofObject`)

If you add a field, both places need edits — see [`WORKFLOWS.md` section 9](./WORKFLOWS.md#9-add-a-new-field-to-a-proof).

## Off-chain: in-memory cache (backend)

```ts
const proofCache: ProofRecord[] = [];
```

A plain array inside `backend/src/routes/proof.ts`. Cleared on every restart. Used only as a fallback when on-chain queries throw. Not a security or durability layer.

## Off-chain: wallet storage (mobile)

Stored under the key `snapproof-keypair`:

- **Native**: `expo-secure-store` — encrypted via the OS keychain.
- **Web**: `localStorage` — plaintext JSON `{secretKey, address}`.

Value: the Ed25519 secret key, serialized by `Ed25519Keypair.getSecretKey()`. On web we additionally store the derived address as a convenience.

## Metadata details

`extractMetadata(uri, exif?)` returns:

```ts
interface ImageMetadata {
  timestamp: number;   // ms epoch
  fileSize: number;    // bytes
  fileName: string;    // basename of the uri
}
```

- `timestamp`: if EXIF has `DateTimeOriginal` or `DateTime`, reformat `YYYY:MM:DD HH:MM:SS` to ISO and parse; fallback to `Date.now()` on absence or parse failure.
- `fileSize`: from `expo-file-system` on native, from `fetch(uri).blob().size` on web; `0` on error.
- `fileName`: trailing segment of the URI (`uri.split("/").pop() ?? "unknown"`).

These three fields are what gets JSON-stringified and hashed. If you change the metadata shape, existing proofs will no longer re-verify against re-computed metadata hashes — which is fine for the image hash check but will render the `proof_hash` invalid.

## Hash chain

The hashes nest like this:

```
image_hash    = SHA-256(image_bytes)
metadata_hash = SHA-256(JSON.stringify({timestamp, fileSize, fileName}))
proof_hash    = SHA-256(image_hash + ":" + metadata_hash)
```

Verification only strictly needs `image_hash`. `metadata_hash` is useful for proving the specific filename/timestamp that was recorded. `proof_hash` is the single-string fingerprint used when sharing.

## Locations and geohashes

The geohash algorithm (in `mobile/src/utils/geohash.ts`) is standard base-32: alternating longitude/latitude bits, 5 bits per char.

| Precision | Cell size (approx.) |
|-----------|---------------------|
| 4 | ~20 km |
| 5 | ~2.4 km |
| **6** (used) | **~1.2 km** |
| 7 | ~153 m |
| 8 | ~38 m |

We default to 6 so the on-chain value reveals the city block / neighborhood but not the exact address. Users who care about stricter privacy can deny location permission, in which case the field is an empty string.

## Explorer URLs

Every object and transaction has a canonical URL:

```
# transaction
${explorerBase}/tx/${txDigest}
# object
${explorerBase}/object/${objectId}
# where
explorerBase =
  "https://suiscan.xyz/mainnet" | "https://suiscan.xyz/testnet" | "https://suiscan.xyz/devnet"
```

These are the links the proof receipt and verify screens surface, and what you'll share when you need a third party to look something up independently.

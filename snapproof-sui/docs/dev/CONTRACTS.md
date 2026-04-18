# Move contracts (`contracts/`)

A single Move module, `snapproof::snapproof`, deployed to Sui testnet. One owned object type, one entry function, one event.

## Package metadata

| Field | Value |
|-------|-------|
| Package name | `snapproof` |
| Move edition | `2024.beta` |
| Framework dependency | `Sui` at branch `framework/testnet` |
| Address `snapproof` | `0x0` in source (Sui rewrites on publish) |

Current testnet publish (from `contracts/Published.toml`):

| Field | Value |
|-------|-------|
| `chain-id` | `4c78adac` |
| `published-at` / `original-id` | `0x8cb3e3d082971bde081c3af6b794fa3748cc454985cdc98140c20892a5cd3321` |
| `version` | `1` |
| `upgrade-capability` | `0xcc3d0245c982c0035f96d474bfbc2f74a425ff955b67b818067b44c2c382da2b` |

The upgrade cap is an object owned by whoever ran `sui client publish`. Holding it is required for `sui client upgrade` to preserve the package ID across versions.

## The `PhotoProof` struct

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

Abilities: `key` makes it an object with a global UID; `store` lets it be held inside other objects (e.g. a future "case" collection). It does **not** have `copy` or `drop` — proofs can be owned and transferred, not duplicated or silently destroyed.

Every field is stringly-typed (`std::string::String`) except the UID, creator address, and the `u64` timestamp. Strings are convenient because hashes are already hex, blob IDs are base64-like strings, geohashes are base-32, and case IDs are arbitrary human input. Binary-packing them would save a handful of bytes at the cost of readability on explorers.

### Field semantics

| Field | Semantics |
|-------|-----------|
| `creator` | The sender address at proof-creation time. Becomes the owner of the object. |
| `walrus_blob_id` | Handle returned by the Walrus publisher; opaque string. |
| `image_hash` | Lower-case hex SHA-256 of the raw image bytes. |
| `metadata_hash` | Lower-case hex SHA-256 of `JSON.stringify({timestamp, fileSize, fileName})`. |
| `proof_hash` | Lower-case hex SHA-256 of `"${imageHash}:${metadataHash}"`. Redundant given the other two, but it's a single-field "fingerprint" that's convenient to print. |
| `created_at` | Millisecond epoch. Taken from EXIF when available, else the client clock at submission. **This is client-supplied** — the chain's block timestamp is the defensible one. |
| `coarse_geo_hash` | 6-character geohash (~1.2 km cell) or empty string. |
| `case_id` | Optional free-form string. MVP doesn't bind it to any case object. |

## The `create_proof` entry function

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

Behavior:

1. Read `ctx.sender()` as `creator`.
2. Allocate a new `UID` via `object::new(ctx)`.
3. Construct a `PhotoProof` from the arguments.
4. Emit a `ProofCreated` event (see next section).
5. `transfer::transfer(proof, creator)` — the object is owned by the signer.

There is no precondition check — the Move function trusts the client to send well-formed hashes. The only trust boundary that actually matters is that whichever address calls this function becomes the `creator`; an adversary cannot forge a proof as someone else.

## The `ProofCreated` event

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

Emitted inside `create_proof`. Notably, **the event does not carry `metadata_hash`, `walrus_blob_id`, or `case_id`** — only what's needed to locate and identify proofs. The off-chain reader (backend or mobile `verify.tsx`) is expected to follow up with `getObject(proof_id)` for the full record. This keeps event payloads small and cheap.

The off-chain filter is `MoveEventType = "${PACKAGE_ID}::snapproof::ProofCreated"`. See `mobile/src/services/sui.ts` `lookupProofByImageHash` and `backend/src/services/sui-client.ts` `queryProofEvents`.

## Accessors

Eight public read accessors, one per field (minus the UID). They exist so external Move packages or view-only calls can read fields without needing to know the struct layout.

```move
public fun creator(proof: &PhotoProof): address
public fun image_hash(proof: &PhotoProof): String
public fun metadata_hash(proof: &PhotoProof): String
public fun proof_hash(proof: &PhotoProof): String
public fun walrus_blob_id(proof: &PhotoProof): String
public fun created_at(proof: &PhotoProof): u64
public fun coarse_geo_hash(proof: &PhotoProof): String
public fun case_id(proof: &PhotoProof): String
```

In the MVP the only caller that uses these accessors directly is the Move test (see below). The JS clients read the object's `content.fields` map instead.

## Tests

One test file, `tests/snapproof_tests.move`, using `sui::test_scenario`:

```move
#[test]
fun test_create_proof() {
    // 1. Create proof with dummy strings and a fixed timestamp.
    // 2. Advance to the next tx and take the PhotoProof from sender.
    // 3. Assert creator, image_hash, walrus_blob_id, created_at match.
}
```

Run locally with `sui move test`. The test validates:

- The object is transferred to the caller (`take_from_sender` finds it).
- Fields are stored verbatim.
- `created_at` is preserved as-is (the chain does not overwrite it).

There is no test for `ProofCreated` emission; adding one would use `test_scenario::take_events` to round-trip the event.

## Build & publish

```bash
# Build
sui move build

# Test
sui move test

# Publish (via the helper script)
./deploy.sh

# Or directly
sui client publish --gas-budget 100000000
```

`deploy.sh` additionally tries to grep the `packageId` out of the JSON output and print the next steps (update `.env` and `mobile/.env`). It's idempotent — you can re-run it after changes; each run creates a new package ID unless you use `sui client upgrade`.

## What this module does not do

- **No storage of image bytes** — Walrus owns that.
- **No access control** — anyone can create a proof; ownership is by signer.
- **No deletion** — `PhotoProof` has no `drop`, and there is no `delete_proof` function. Proofs are effectively permanent until/unless a newer module with a destructor is published and the object is moved into it.
- **No cases / collections** — `case_id` is a plain string; there is no `Case` object that gathers proofs.
- **No upgrade logic** — the module is versioned by Sui's publish/upgrade system, not by in-Move version fields.

Future work would naturally add a `Case` object (with `key`) that holds a `vector<ID>` of proof IDs, plus friend functions for batch creation.

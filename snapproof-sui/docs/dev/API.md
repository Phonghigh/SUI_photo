# Backend REST API

Base URL: `http://localhost:3001` (default; set `PORT` to change).

All responses are JSON. CORS is fully open.

## Common types

```ts
interface ProofRecord {
  imageHash: string;       // 64-char lowercase hex
  metadataHash: string;    // 64-char lowercase hex (empty in event-only records)
  proofHash: string;       // 64-char lowercase hex
  walrusBlobId: string;    // Walrus blob id (empty in event-only records)
  createdAt: number;       // ms epoch
  txDigest: string;        // Sui transaction digest base58
  objectId: string;        // Sui object id 0x...
  creator: string;         // Sui address 0x...
  coarseGeoHash?: string;  // 6-char base32 geohash, optional
  caseId?: string;         // free-form string, optional
}
```

A "full" `ProofRecord` is what comes back from `getObject`. An "event-only" `ProofRecord` is what comes back from `queryEvents` and has empty `metadataHash` and `walrusBlobId` (those fields are not in the event payload, only in the on-chain object).

---

## `GET /api/health`

Liveness probe.

**Response 200**
```json
{
  "status": "ok",
  "service": "snapproof-backend",
  "timestamp": "2026-04-18T13:45:21.000Z"
}
```

---

## `GET /api/proofs`

List recent on-chain `ProofCreated` events.

**Query params**
- `limit` (number, default `20`) — maximum events to return.

**Response 200**
```json
{
  "proofs": [ProofRecord, ...]
}
```

The records are ordered most-recent-first (descending). Each record is event-only — `metadataHash` and `walrusBlobId` will be empty.

**Failure mode**
If the Sui RPC call fails, the endpoint returns the in-memory cache instead. The status is still 200; the empty cache yields `{ "proofs": [] }`.

---

## `GET /api/proofs/by-id/:objectId`

Fetch a single `PhotoProof` object by its Sui object ID.

**Path params**
- `objectId` — `0x` + 64 hex chars.

**Response 200**
```json
{ "proof": ProofRecord }
```

The record is **full** — all fields populated from `getObject`. Note `txDigest` will be empty because `getObject` doesn't return the creating transaction digest. (To get it, follow up with `findProofByImageHash` or `queryEvents` filtered to that object.)

**Response 404**
```json
{ "error": "Proof not found" }
```

**Response 500**
```json
{ "error": "Failed to fetch proof" }
```

---

## `GET /api/proofs/by-hash/:imageHash`

Find a proof by image hash. Scans the most recent 100 events.

**Path params**
- `imageHash` — 64-char lowercase hex.

**Response 200**
```json
{ "proof": ProofRecord }
```

Full record (event-then-object enrichment).

**Response 404**
```json
{ "error": "Proof not found" }
```

If the on-chain scan fails, falls back to the in-memory cache. Returns 404 only if both miss.

---

## `POST /api/proofs`

Insert a record into the in-memory cache. Currently unused by the mobile client.

**Request body**
```json
{
  "imageHash": "...",
  "metadataHash": "...",
  "proofHash": "...",
  "walrusBlobId": "...",
  "createdAt": 1729265432000,    // optional — defaults to Date.now()
  "txDigest": "...",
  "objectId": "...",             // optional, defaults to ""
  "creator": "...",              // optional, defaults to ""
  "coarseGeoHash": "...",        // optional
  "caseId": "..."                // optional
}
```

**Response 201**
```json
{ "proof": ProofRecord }
```

No validation; missing required fields will pass through as `undefined`.

---

## `POST /api/proofs/verify`

Check whether an image has an on-chain proof.

**Request body**
```json
{ "imageHash": "..." }
```

**Response 200**
```json
{
  "verified": true,
  "proof": ProofRecord
}
```

or

```json
{
  "verified": false,
  "proof": null
}
```

**Response 400**
```json
{ "error": "imageHash is required" }
```

If the on-chain query throws, the endpoint silently falls back to the in-memory cache.

---

## Example client snippets

### `curl`

```bash
# List recent proofs
curl http://localhost:3001/api/proofs?limit=5

# Look up by hash
curl http://localhost:3001/api/proofs/by-hash/$IMAGE_HASH

# Verify an image
curl -X POST http://localhost:3001/api/proofs/verify \
  -H 'Content-Type: application/json' \
  -d "{\"imageHash\":\"$IMAGE_HASH\"}"
```

### Browser fetch

```js
const res = await fetch("http://localhost:3001/api/proofs/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageHash }),
});
const { verified, proof } = await res.json();
```

---

## Error format

There is no consistent error envelope. Successful responses return resource keys (`proofs`, `proof`); errors return `{ "error": "..." }`. Status codes are best-effort: 4xx for client problems, 5xx for unexpected RPC failures, 200 with possibly-empty data when the endpoint is "designed to degrade" (the list endpoint and the verify endpoint both swallow RPC errors and serve cache).

For a production cut you'd standardize on something like RFC 7807 `application/problem+json` and add error codes.

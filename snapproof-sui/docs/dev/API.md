# Backend REST API

Base URL: `http://localhost:3001` (default; set `PORT` to change).

All responses are JSON unless otherwise noted. CORS is fully open on every
route. Successful responses use the resource shape below. Error responses
use **RFC 7807** `application/problem+json` (see [Error format](#error-format)).

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

A "full" `ProofRecord` is what comes back from `getObject` or from the
Postgres indexer. An "event-only" `ProofRecord` is what comes back from
`queryEvents` and has empty `metadataHash` and `walrusBlobId` (those fields
are not in the event payload, only in the on-chain object).

---

## `GET /api/health`

Liveness probe — answers "is the process running?"

**Response 200**
```json
{
  "status": "ok",
  "service": "snapproof-backend",
  "timestamp": "2026-04-18T13:45:21.000Z",
  "now": 1776123421000
}
```

Used by container orchestrators and uptime checks. Never fails unless the
process itself is wedged.

---

## `GET /api/health/ready`

Readiness probe — answers "can this instance serve traffic?"

Checks Sui RPC reachability (via `getLatestCheckpointSequenceNumber`) and
reports whether the optional Postgres indexer is active.

**Response 200**
```json
{
  "status": "ready",
  "checks": {
    "sui":     { "ok": true },
    "indexer": { "ok": true }
  }
}
```

**Response 503**
```json
{
  "status": "degraded",
  "checks": {
    "sui":     { "ok": false, "error": "fetch failed" },
    "indexer": { "ok": false }
  }
}
```

Kubernetes `readinessProbe` should point here; liveness should point at
`/api/health`.

---

## `GET /api/metrics`

Prometheus text-format metrics. `Content-Type: text/plain; version=0.0.4`.

Exported metrics:

| Name | Type | Labels | Meaning |
|------|------|--------|---------|
| `snapproof_http_requests_total` | counter | `method`, `route`, `status` | Total HTTP requests served. |
| `snapproof_http_request_duration_seconds` | histogram | `method`, `route`, `status` | Latency bucketed from 5 ms to 10 s. |
| `snapproof_proof_query_total` | counter | `result` ∈ {`indexer`, `onchain`, `cache_fallback`} | Which backing store served `GET /api/proofs`. |
| `snapproof_verify_result_total` | counter | `result` ∈ {`match`, `not_found`} | Outcomes of `POST /api/proofs/verify`. |

Point Prometheus, Grafana Agent, or Datadog Agent at this route. No auth.

---

## `GET /api/proofs`

List recent `ProofCreated` records, ordered most-recent-first.

**Query params**
- `limit` (number, default `20`, max `100`) — page size.
- `cursor` (string, optional) — pass the `nextCursor` from the previous page.

**Preference order** (first hit wins):

1. Postgres indexer, if `DATABASE_URL` is configured.
2. On-chain event scan via `queryEvents`.
3. In-memory cache fallback (only populated by `POST /api/proofs`).

**Response 200**
```json
{
  "proofs":     [ProofRecord, ...],
  "nextCursor": "1776110000000"
}
```

`nextCursor` is `null` on the last page. When the indexer is disabled, the
cursor is always `null` — pagination is indexer-only.

The indexer path returns full records; the on-chain and cache paths return
event-only records.

---

## `GET /api/proofs/by-id/:objectId`

Fetch a single `PhotoProof` object by its Sui object ID.

**Path params**
- `objectId` — `0x` + 64 hex chars.

**Response 200**
```json
{ "proof": ProofRecord }
```

The record is **full** — all fields populated from `getObject`. Note
`txDigest` will be empty because `getObject` doesn't return the creating
transaction digest. (To get it, use `/api/proofs/by-hash/:imageHash`, which
enriches from the `ProofCreated` event.)

**Response 404** — problem+json

---

## `GET /api/proofs/by-hash/:imageHash`

Find a proof by image hash.

**Path params**
- `imageHash` — 64-char lowercase hex (validated by `/^[0-9a-f]{64}$/i`).

**Preference order** (first hit wins):

1. Postgres indexer (O(1) by primary index).
2. On-chain scan of the most recent 100 `ProofCreated` events (event-only
   record, then enriched via `getObject`).
3. In-memory cache.

**Response 200**
```json
{ "proof": ProofRecord }
```

**Response 400** — if the hash doesn't match the regex (problem+json).

**Response 404** — if none of the three backing stores find a match.

---

## `POST /api/proofs`

Insert a record into the in-memory cache. Primarily used by clients that
want to pre-populate the fallback cache (e.g. end-to-end tests).

**Rate-limited:** 30 requests / minute / IP by default. Configurable via
`WRITE_RATE_LIMIT_WINDOW_MS` and `WRITE_RATE_LIMIT_MAX`.

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

Required fields: `imageHash`, `proofHash`, `txDigest`.

**Response 201**
```json
{ "proof": ProofRecord }
```

**Response 400** — missing required field (problem+json).

**Response 429** — rate limit exceeded (problem+json).

---

## `POST /api/proofs/verify`

Check whether an image has an on-chain proof.

**Rate-limited:** same policy as `POST /api/proofs`.

**Request body**
```json
{ "imageHash": "..." }
```

The hash is validated against `/^[0-9a-f]{64}$/i`.

**Response 200**
```json
{ "verified": true,  "proof": ProofRecord }
```
or
```json
{ "verified": false, "proof": null }
```

**Response 400** — invalid hash (problem+json).

**Response 429** — rate limit exceeded (problem+json).

Preference order is identical to `GET /api/proofs/by-hash/:imageHash`.

---

## Error format

All error responses use **RFC 7807** `application/problem+json`:

```json
{
  "type":     "https://snapproof.app/problems/bad-request",
  "title":    "Bad Request",
  "status":   400,
  "detail":   "imageHash must be a 64-character lowercase hex string.",
  "instance": "/api/proofs/verify"
}
```

`type` is a stable URL per error class; clients can key on it. `title` and
`status` mirror the HTTP status line. `detail` is human-readable and is the
only field we change without bumping a version. `instance` is the request
path and is useful for server logs.

Known types:

| `type` suffix | Status | Meaning |
|---------------|--------|---------|
| `/bad-request` | 400 | Validation failed (usually a hash regex miss). |
| `/not-found` | 404 | Resource not present. |
| `/too-many-requests` | 429 | Rate limit tripped. |
| `/internal-server-error` | 500 | Uncaught exception; see server logs. |

---

## Example client snippets

### `curl`

```bash
# List recent proofs
curl http://localhost:3001/api/proofs?limit=5

# Paginate
curl "http://localhost:3001/api/proofs?limit=5&cursor=1776110000000"

# Look up by hash
curl http://localhost:3001/api/proofs/by-hash/$IMAGE_HASH

# Verify an image
curl -X POST http://localhost:3001/api/proofs/verify \
  -H 'Content-Type: application/json' \
  -d "{\"imageHash\":\"$IMAGE_HASH\"}"

# Scrape metrics
curl http://localhost:3001/api/metrics
```

### Browser fetch

```js
const res = await fetch("http://localhost:3001/api/proofs/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageHash }),
});
if (!res.ok) {
  const problem = await res.json();        // RFC 7807 body
  throw new Error(`${problem.title}: ${problem.detail}`);
}
const { verified, proof } = await res.json();
```

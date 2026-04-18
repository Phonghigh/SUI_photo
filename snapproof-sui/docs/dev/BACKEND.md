# Backend (`backend/`)

A small Express server that wraps the Sui RPC and exposes a REST API for proofs. **It is not on the critical write or verify path** — the mobile app writes directly to Walrus and Sui, and verifies directly against the Sui RPC. The backend exists for two purposes:

1. Give third parties (web pages, integrations, scripts) a simple HTTP surface so they don't need a Sui SDK.
2. Provide a place for an in-memory cache and, eventually, a persistent index.

## Stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js (TypeScript via `tsx` in dev, `tsc` in build) |
| Web framework | Express 4 |
| Sui SDK | `@mysten/sui` |
| Misc | `cors`, `dotenv` |
| Module system | Node16 ESM (`import "./routes/proof.js"` with `.js` suffixes) |
| Lint | ESLint (config not committed; `npm run lint` runs it) |

## Layout

```
backend/
├── src/
│   ├── index.ts                    # Express bootstrap
│   ├── routes/
│   │   ├── health.ts               # GET /api/health
│   │   └── proof.ts                # GET /api/proofs[/by-id/:id|/by-hash/:hash], POST /api/proofs, POST /api/proofs/verify
│   ├── services/
│   │   └── sui-client.ts           # queryProofEvents, getProofObject, findProofByImageHash
│   └── types/
│       └── proof.ts                # ProofData / ProofRecord (mirrors mobile)
├── package.json
└── tsconfig.json
```

## Bootstrap (`src/index.ts`)

```ts
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api/health", healthRoutes);
app.use("/api/proofs", proofRoutes);
app.listen(PORT, ...);
```

CORS is wide open — fine for a hackathon demo, would tighten in production. Body limit is 10 MB to allow image-bytes-in-JSON requests if a future endpoint needs them; current routes don't.

`PORT` defaults to `3001`.

## Sui client (`src/services/sui-client.ts`)

A lazy singleton:

```ts
let client: SuiClient | null = null;
export function getSuiClient(): SuiClient {
  if (!client) client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  return client;
}
```

Three exported functions:

- `queryProofEvents(limit = 50): Promise<ProofRecord[]>` — `queryEvents` for `MoveEventType = "${PACKAGE_ID}::snapproof::ProofCreated"`, descending. Maps each event into a partial `ProofRecord` (the event payload doesn't carry `metadata_hash`, `walrus_blob_id`, or `case_id`, so those fields are returned empty).
- `getProofObject(objectId): Promise<ProofRecord | null>` — `getObject({ id, options: { showContent: true } })`. Type-checks `dataType === "moveObject"`, then maps snake_case Move fields to camelCase TS, returning the full record. Returns `null` on any error (logs to console).
- `findProofByImageHash(imageHash): Promise<ProofRecord | null>` — `queryProofEvents(100)` then linear-scans for a match. If found and the event has an `objectId`, follows up with `getProofObject` to enrich (so the returned record carries `metadataHash`, `walrusBlobId`, geohash, etc.) and copies the `txDigest` from the event onto the enriched object.

Limitations:

- The event scan is hard-capped at 100 events. For a real index you'd paginate via `nextCursor` and write to a DB.
- There's no persistence — restart the process and the in-memory cache (used as a fallback) is empty.
- `NETWORK` and `PACKAGE_ID` are read once at import time from `process.env`. Changing the env requires a restart.

## Routes (`src/routes/proof.ts`)

In-file declared cache:

```ts
const proofCache: ProofRecord[] = [];
```

Used only as a fallback when on-chain queries fail or as a write-only index when the mobile app POSTs after submitting (currently the mobile app does not POST, so the cache is effectively unused except inside the same process if you call POST manually).

### Endpoint summary

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/proofs?limit=N` | List recent on-chain `ProofCreated` events. Falls back to in-memory cache on failure. |
| GET | `/api/proofs/by-id/:objectId` | Fetch a `PhotoProof` object by its Sui object ID. 404 if not found, 500 on RPC error. |
| GET | `/api/proofs/by-hash/:imageHash` | Find a proof by hashing the original image and passing the hex hash. Falls back to cache if on-chain not found. |
| POST | `/api/proofs` | Insert a record into the in-memory cache. Idempotency-free — pushes regardless of duplicates. |
| POST | `/api/proofs/verify` | `{ "imageHash": "..." }` → `{ "verified": bool, "proof": ProofRecord | null }`. |

See [`API.md`](./API.md) for full request/response shapes.

### Notable behavior

- `GET /api/proofs` accepts a `limit` query param (defaulting to 20). The backend maps it through to `queryProofEvents(limit)`.
- `GET /api/proofs/by-hash/:imageHash` scans the most recent 100 events (constant inside `findProofByImageHash`). If your event volume exceeds that, the endpoint will silently fail to find older proofs.
- `POST /api/proofs` doesn't validate the body. It should — adding a `zod` schema is the obvious next step.
- The `verify` endpoint's failure mode is "fall back to cache", which means if the Sui RPC is down it still returns a `verified: true` for anything that was cached during this process's lifetime.

## TypeScript / build

`tsconfig.json` uses Node16 modules — that's why imports use `.js` suffixes despite `.ts` files. Building with `npm run build` produces `dist/` which `npm start` runs via `node dist/index.js`. Dev uses `tsx watch` for hot reload.

`strict: true` is on. The Sui SDK's response types are reasonably specific, but most of our handler code defensively casts `parsedJson` to `Record<string, unknown>` and coerces with `String(... ?? "")` to keep the data shape stable.

## What's missing (intentionally)

- **No auth.** Anyone can `POST /api/proofs` to fill the cache; anyone can `verify` anything.
- **No rate limiting.** Easy DoS surface in production.
- **No persistence.** A real indexer would write events to Postgres / SQLite and stream new ones via `subscribeEvent`.
- **No pagination on `GET /api/proofs/by-hash`.** Bounded by the 100-event window inside the service.
- **No webhook / pub-sub.** The mobile app polls; there is no server-push.

These are explicit scope cuts for the MVP — see `CLAUDE.md` and `TASKS.md`. The backend is a thin convenience layer, not a security boundary.

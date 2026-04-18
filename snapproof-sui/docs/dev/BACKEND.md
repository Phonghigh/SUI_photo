# Backend (`backend/`)

A small Express server that wraps the Sui RPC and exposes a REST API for
proofs. **It is not on the critical write or verify path** — the mobile app
writes directly to Walrus and Sui, and verifies directly against the Sui
RPC. The backend exists for three purposes:

1. Give third parties (web pages, integrations, scripts) a simple HTTP
   surface so they don't need a Sui SDK.
2. Provide an optional Postgres-backed indexer so queries stay fast even
   when event volume exceeds the on-chain scan window.
3. Expose Prometheus metrics + readiness checks so the service is
   operable at 3 am.

The backend is **version 0.2.0**. See [`CHANGELOG.md`](../../CHANGELOG.md) for
the full list of recent changes.

## Stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js 20 LTS (TypeScript via `tsx` in dev, `tsc` in build) |
| Web framework | Express 4 |
| Sui SDK | `@mysten/sui` |
| Logging | `pino` + `pino-http` (pretty in dev, JSON in prod) |
| Rate limiting | `express-rate-limit` |
| Metrics | tiny in-house Prometheus text exporter (no `prom-client` dep) |
| Indexer (optional) | `pg` loaded via dynamic import |
| Crash reporting (optional) | `@sentry/node` loaded via dynamic import |
| Module system | Node16 ESM (`import "./routes/proof.js"` with `.js` suffixes) |

## Layout

```
backend/
├── src/
│   ├── index.ts                  # Express bootstrap + shutdown hooks
│   ├── logger.ts                 # pino logger (LOG_LEVEL-aware)
│   ├── analytics.ts              # Sentry-optional event tracker
│   ├── errors.ts                 # HttpError + RFC 7807 problem handler
│   ├── middleware.ts             # metrics middleware + write rate limiter
│   ├── metrics.ts                # Prometheus counters / histograms
│   ├── routes/
│   │   ├── health.ts             # GET /api/health, GET /api/health/ready
│   │   ├── metrics.ts            # GET /api/metrics
│   │   └── proof.ts              # /api/proofs CRUD + verify
│   ├── services/
│   │   ├── sui-client.ts         # queryProofEvents, getProofObject, findProofByImageHash
│   │   └── indexer.ts            # optional Postgres indexer
│   └── types/
│       └── proof.ts              # ProofRecord (mirrors mobile)
├── .env.example                  # documented config
├── package.json                  # pinned versions of pino/rate-limit/etc.
└── tsconfig.json
```

## Bootstrap (`src/index.ts`)

```ts
const app = express();
app.disable("x-powered-by");
app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(metricsMiddleware);

app.use("/api/health", healthRoutes);
app.use("/api/metrics", metricsRoutes);

app.use("/api/proofs", (req, res, next) =>
  req.method === "POST" ? writeRateLimiter(req, res, next) : next());
app.use("/api/proofs", proofRoutes);

app.use(notFoundProblem);   // 404 → problem+json
app.use(problemHandler);    // last: converts HttpError to problem+json
```

Startup runs `initAnalytics()` (wires Sentry if `SENTRY_DSN` is set) and
`startIndexer()` (connects to Postgres and begins polling if `DATABASE_URL`
is set and `pg` is installed). Both are **no-ops by default** so a bare
checkout runs without any extra dependencies.

Shutdown on `SIGINT`/`SIGTERM` closes the HTTP server and stops the
indexer poll loop.

CORS is wide open — fine for a hackathon demo, tighten in production.
Body limit is 10 MB to allow image-bytes-in-JSON requests if a future
endpoint needs them; current routes don't.

`PORT` defaults to `3001`.

## Error handling (`src/errors.ts`)

Every error response is an **RFC 7807 `application/problem+json`** body:

```ts
{ type, title, status, detail?, instance?, ...extras }
```

Helpers: `badRequest`, `notFound`, `tooManyRequests`, `internal` all return
an `HttpError` which the global `problemHandler` converts into a proper
problem+json response. Unhandled errors get logged via pino and returned as
a generic `500`.

See [`API.md`](./API.md#error-format) for the client-facing contract.

## Metrics (`src/metrics.ts` + `src/middleware.ts`)

A zero-dependency Prometheus text-format exporter. Four metrics:

| Metric | Type | Labels |
|--------|------|--------|
| `snapproof_http_requests_total` | counter | method, route, status |
| `snapproof_http_request_duration_seconds` | histogram | method, route, status |
| `snapproof_proof_query_total` | counter | result ∈ {indexer,onchain,cache_fallback} |
| `snapproof_verify_result_total` | counter | result ∈ {match,not_found} |

The `metricsMiddleware` stamps the histogram and the counter from `finish`
on the response. `GET /api/metrics` dumps the current snapshot in the
0.0.4 Prometheus text format.

## Rate limiting

`express-rate-limit` on **write endpoints only** (`POST /api/proofs*`).
Defaults: 30 requests / minute / IP. Configured via env:

```
WRITE_RATE_LIMIT_WINDOW_MS=60000
WRITE_RATE_LIMIT_MAX=30
```

When tripped, the limiter returns a problem+json body with
`status: 429`, `title: "Too Many Requests"`.

## Logging

`pino` writes JSON when `NODE_ENV=production`, pretty-printed colored output
otherwise. `pino-http` captures one log line per request with status,
latency, and request id. Level is controlled by `LOG_LEVEL` — one of
`trace | debug | info | warn | error`.

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

- `queryProofEvents(limit = 50): Promise<ProofRecord[]>` — `queryEvents`
  filtered by `MoveEventType = "${PACKAGE_ID}::snapproof::ProofCreated"`,
  descending. Maps each event into a partial `ProofRecord` (the event
  payload doesn't carry `metadata_hash` or `walrus_blob_id`, so those
  fields are empty on the returned records).
- `getProofObject(objectId): Promise<ProofRecord | null>` —
  `getObject({ id, options: { showContent: true } })`, type-checks
  `dataType === "moveObject"`, and maps snake_case Move fields to
  camelCase TS. Returns `null` on any error (logs to the pino logger).
- `findProofByImageHash(imageHash): Promise<ProofRecord | null>` —
  `queryProofEvents(100)` then linear-scans for a match. If found and the
  event has an `objectId`, follows up with `getProofObject` to enrich
  (so the returned record carries `metadataHash`, `walrusBlobId`, geohash,
  etc.) and copies the `txDigest` from the event onto the enriched object.

Limitations:

- The event scan is hard-capped at 100 events. For a real index you'd use
  the Postgres indexer below or paginate via `nextCursor`.
- `NETWORK` and `PACKAGE_ID` are read once at import time from
  `process.env`. Changing the env requires a restart.

## Postgres indexer (`src/services/indexer.ts`) — optional

When `DATABASE_URL` is set and `pg` is installed, the backend:

1. Creates a `proofs` table + indexes on first start.
2. Polls `queryProofEvents(100)` every `INDEXER_POLL_MS` (default 15 s).
3. Upserts each event into `proofs` keyed by `object_id`.

This serves three queries:

- `indexerEnabled()` — gate used by routes to prefer the DB over on-chain.
- `findProofByHashPg(imageHash)` — O(1) lookup on the `image_hash` index.
- `listProofsPg(limit, cursor?)` — paginated list ordered by `created_at`
  DESC. The cursor is the `created_at` ms timestamp of the last row.

Disabled by default:

- If `DATABASE_URL` is empty, the indexer never starts and the routes
  never hit `indexerEnabled()`.
- If `DATABASE_URL` is set but `pg` is not installed, the startup logs a
  warning and the indexer stays off. This keeps the optional dependency
  truly optional.

**Preference order inside routes:**

```
indexer  →  on-chain events  →  in-memory cache fallback
```

The cache is populated only by `POST /api/proofs` (the mobile client
doesn't use it). It exists so that `findProofByImageHash` can still serve
writes that just happened during this process's lifetime when the on-chain
event isn't indexed yet.

## Analytics (`src/analytics.ts`) — optional

Dynamic import of `@sentry/node`. When `SENTRY_DSN` is set and the module
is installed, `initAnalytics()` initializes Sentry with the configured
environment and `tracesSampleRate`. Otherwise it's a no-op.

Event tracking via `track({ name, props? })` currently just logs at debug
level — swap in Amplitude/PostHog by editing this file only.

Exception capture via `captureException(err, ctx?)` logs at `error` and,
if Sentry is ready, forwards via `Sentry.captureException`.

## Routes (`src/routes/proof.ts`)

In-file declared cache:

```ts
const proofCache: ProofRecord[] = [];
```

Used only as the last-ditch fallback. Capped at 500 entries.

### Endpoint summary

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/health` | Liveness. Always 200 if the process is up. |
| GET | `/api/health/ready` | Readiness. 200 if Sui RPC + indexer are healthy, 503 otherwise. |
| GET | `/api/metrics` | Prometheus text-format metrics. |
| GET | `/api/proofs?limit=&cursor=` | Paginated list. Indexer → on-chain → cache. |
| GET | `/api/proofs/by-id/:objectId` | Single `PhotoProof` by object ID. |
| GET | `/api/proofs/by-hash/:imageHash` | Proof lookup by image hash (validated 64-hex). |
| POST | `/api/proofs` | Cache insert. Rate-limited. |
| POST | `/api/proofs/verify` | `{ imageHash } → { verified, proof }`. Rate-limited, hash-validated. |

Full request/response shapes in [`API.md`](./API.md).

### Notable behavior

- `GET /api/proofs` preference order is fixed; clients do not opt-in.
- `GET /api/proofs/by-hash/:imageHash` validates with
  `/^[0-9a-f]{64}$/i` and returns 400 on mismatch before hitting any
  backing store.
- `POST /api/proofs` enforces `imageHash`, `proofHash`, and `txDigest`.
  Other fields default to empty strings.
- The `verify` endpoint still emits a Prometheus counter and an analytics
  event on every call, so even a rate-limited failure registers.

## TypeScript / build

`tsconfig.json` uses Node16 modules — that's why imports use `.js`
suffixes despite `.ts` files. Building with `npm run build` produces
`dist/` which `npm start` runs via `node dist/index.js`. Dev uses
`tsx watch` for hot reload.

`strict: true` is on. The Sui SDK's response types are reasonably
specific, but most of our handler code defensively casts `parsedJson` to
`Record<string, unknown>` and coerces with `String(... ?? "")` to keep
the data shape stable.

## What's still out of scope

- **Auth.** Anyone can `POST /api/proofs` (subject to the rate limit).
- **Push / pub-sub.** The mobile app and web verifier poll.
- **Horizontal scaling of the indexer.** Single-leader by design; rely on
  the DB as the shared store if you run multiple backend replicas.

These are explicit scope cuts for now — see `CLAUDE.md` and `TASKS.md`.
The backend is a thin convenience layer plus a durability safety net,
not a security boundary.

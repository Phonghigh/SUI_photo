# SnapProof Web Verifier

The public verification surface for SnapProof. Anyone with a link to a proof
(object ID or image hash) can:

1. See the original photo pulled from **Walrus**
2. Re-hash the raw bytes client-side via Web Crypto
3. Compare against the hash stored on-chain on **Sui**
4. Deep-link into Sui Explorer for the transaction

## Routes

| Path                     | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `/`                      | Search form — accepts a Sui object ID (`0x…`) or a 64-hex image hash |
| `/p/[objectId]`          | Canonical proof page. Server-fetches the PhotoProof; client re-hashes |
| `/h/[hash]`              | Look up by image hash. Redirects to `/p/[id]` on hit, friendly 404 on miss |
| `/p/[id]/opengraph-image`| Dynamic OG card used for social previews (Twitter/Facebook/iMessage) |
| `/api/proofs`            | Cursor-paginated proof list (currently backed by Prisma stub)       |
| `/api/metrics`           | Prometheus-compatible metrics endpoint                              |

## Getting Started

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_PROOF_PACKAGE_ID if needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app server-fetches on-chain data via `@mysten/sui` and falls back to
querying the backend indexer (`NEXT_PUBLIC_BACKEND_URL`) when it can't
resolve a hash from events alone.

## Environment Variables

All client-safe (no secrets):

| Var                                   | Purpose                              |
| ------------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUI_NETWORK`             | `testnet` / `devnet` / `mainnet`     |
| `NEXT_PUBLIC_PROOF_PACKAGE_ID`        | Deployed Move package                 |
| `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`   | Walrus read endpoint                 |
| `NEXT_PUBLIC_BACKEND_URL`             | Express backend for indexer lookups  |
| `NEXT_PUBLIC_SITE_URL`                | Canonical URL for OG/canonical tags  |

## Deployment

Deploy on Vercel (zero config) or any Node host. The OG image route is
configured with `runtime = 'edge'` for fast social rendering.

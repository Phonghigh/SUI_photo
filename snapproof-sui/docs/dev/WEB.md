# Web verifier (`web/`)

A Next.js 14 (App Router) application that renders public, shareable
proof pages. It is the public face of a SnapProof receipt: anyone with a
URL can view the photo, the on-chain metadata, and an independent
browser-side hash check — no wallet, no SDK, no app install.

The web verifier is **not on the write path**. It is a read-only
surface backed by the same Sui fullnode the mobile app uses and,
optionally, the backend indexer.

## Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14 (App Router, React 19) |
| Language | TypeScript strict |
| Sui SDK | `@mysten/sui` |
| Styling | Tailwind v4 via `postcss.config.mjs` |
| Icons | `lucide-react` |
| OG images | `next/og` (edge runtime) |
| Crash reporting (optional) | `@sentry/nextjs` |

## Layout

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout + global metadata
│   │   ├── page.tsx                       # "/" — search form (object ID or hash)
│   │   ├── globals.css                    # Tailwind base + theme tokens
│   │   ├── p/
│   │   │   └── [objectId]/
│   │   │       ├── page.tsx               # Canonical proof page (server-fetched)
│   │   │       ├── ClientVerifier.tsx     # Client-side hash re-check widget
│   │   │       └── opengraph-image.tsx    # Dynamic OG image (edge runtime)
│   │   ├── h/
│   │   │   └── [hash]/
│   │   │       └── page.tsx               # Hash lookup → redirect to /p/[id]
│   │   └── api/                           # Internal routes (unused by prod flow)
│   └── lib/
│       └── sui.ts                         # Sui + backend client surface
├── public/                                # Static assets
├── .env.example                           # Documented config
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Routes

### `GET /` — home & search

Client component. Accepts three input shapes and routes accordingly:

| Input | Detected by | Route |
|-------|-------------|-------|
| `0x…` (60–66 hex chars) | `/^0x[0-9a-fA-F]{60,66}$/` | `/p/:objectId` |
| 64-hex lowercase | `/^[0-9a-fA-F]{64}$/` | `/h/:hash` |
| Full URL with `/p/` or `/h/` | Path parsing | Extracted segment → above |
| Anything else | — | Inline error |

No server component work happens here; just client-side routing.

### `GET /p/[objectId]` — canonical proof page

Server component. On request:

1. Awaits `params` (Next 15 async params).
2. Calls `getProofById(objectId)` from `lib/sui.ts`.
3. If no result, renders a "Proof Not Found" card.
4. Otherwise renders: the Walrus image (`<img src>` pointed at the
   aggregator), the on-chain hash, creator, capture date, and a
   "View on Sui Explorer" button.
5. Mounts `<ClientVerifier>`, which:
   - Fetches the image bytes in the browser.
   - Runs `crypto.subtle.digest('SHA-256', bytes)`.
   - Compares the hex against the expected `imageHash` and shows
     ✅ verified / ⚠️ mismatch / ⏳ checking.

Revalidation: `export const revalidate = 60;` — Vercel ISR caches the
proof page for 60 s. Safe because proofs are append-only on chain.

Metadata: `generateMetadata` returns OpenGraph + Twitter card tags
pointing at the Walrus image.

### `GET /h/[hash]` — hash lookup

Server component. On request:

1. Normalizes `hash` to lowercase hex; 400-equivalent if it's not
   64 chars.
2. Calls `getProofByHash(hash)` (see `lib/sui.ts` for the fallback
   chain).
3. On hit, `redirect()` to `/p/[objectId]` so the URL you share from
   the browser bar is always the canonical object ID form.
4. On miss, renders a friendly "No Proof Found" card explaining that
   the indexer may lag by up to 15 s and offering a "Try Another
   Lookup" link back to `/`.

Revalidation: 30 s. The shorter window exists because a hash lookup
can miss shortly after submit — a user can reload after 30 s and get
the fresh answer.

### `GET /p/[objectId]/opengraph-image`

Edge runtime. Uses `ImageResponse` from `next/og` to generate a
1200×630 PNG at request time. The image is a two-column card:

- Left: the Walrus photo (full bleed).
- Right: a verification metadata card showing the creator (truncated),
  captured date, and truncated image hash.

Next.js wires this route up as the OG image automatically because of
the filename convention inside the dynamic folder.

## `lib/sui.ts`

The single place web server code talks to Sui or the backend.

### Env-backed exports

```ts
export const SUI_NETWORK;              // testnet | devnet | mainnet
export const WALRUS_AGGREGATOR_URL;    // aggregator base
export const PROOF_PACKAGE_ID;         // PhotoProof package
export const BACKEND_URL;              // /api/proofs/by-hash source
```

All fall back to sensible testnet defaults.

### Data types

```ts
export interface PhotoProof {
  objectId: string;
  imageHash: string;
  metadataHash: string;
  proofHash: string;
  walrusBlobId: string;
  createdAt: number;
  creator: string;
  coarseGeoHash?: string;
  txDigest?: string;
}
```

### API

- `getProofById(objectId)` — wraps `client.getObject` with
  `showContent: true` and maps snake_case Move fields to camelCase.
- `getProofByHash(imageHash)` — validates 64-hex, then:
  1. Preferred: `GET ${BACKEND_URL}/api/proofs/by-hash/:hash`
     (Next.js `fetch` with `revalidate: 30`). When the backend
     has Postgres indexing enabled this is O(1).
  2. Fallback: `client.queryEvents({ MoveEventType:
     "${PROOF_PACKAGE_ID}::photo_proof::ProofCreated" })`, then
     enrich by calling `getProofById` on the matching event's
     `proof_id`.

The pattern is "use the backend when it's there, but always keep
working if it isn't." For a hackathon demo you can run the web
verifier alone against public Sui RPC.

## Environment variables

See [`web/.env.example`](../../web/.env.example):

| Env var | Default | Used for |
|---------|---------|----------|
| `NEXT_PUBLIC_SUI_NETWORK` | `testnet` | Sui fullnode URL |
| `NEXT_PUBLIC_PROOF_PACKAGE_ID` | hardcoded testnet package | Event filter |
| `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL` | testnet aggregator | `<img>` and OG image source |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | `getProofByHash` preferred path |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical / OG base URL |

`NEXT_PUBLIC_*` values are embedded at build time by Next. No secrets
should live in this file.

## Running locally

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

Build & preview:

```bash
npm run build
npm start
```

Lint:

```bash
npm run lint
```

## Interaction with the rest of the repo

- **Backend.** `getProofByHash` calls `GET /api/proofs/by-hash/:hash`.
  If the backend is down, the web verifier falls back to direct Sui
  RPC. There's no hard dependency.
- **Mobile.** The mobile receipt screen's "Copy Link" uses
  `EXPO_PUBLIC_WEB_VERIFIER_URL` (`/p/:objectId`). Point it at
  whatever domain this app is deployed to.
- **Contracts.** Only reads — the web verifier never signs a
  transaction and never holds a key.

## What's out of scope

- No write surface. Creating a proof requires the mobile client
  (or a future SDK / courier web flow — see `ROADMAP.md` B6).
- No auth. Every page is public by design.
- No heavy-weight wallet flow. The in-browser hash re-check uses
  only Web Crypto; there is no wallet connection button.
- No client-side Sui SDK for the public flows. We do the RPC call on
  the server and hand the rendered page back, which keeps the JS
  bundle small and the OG image unit compatible with edge runtime.

# Local setup

This guide covers setting up each of the three workspaces from a clean clone. If you only want to poke at the UI, you only need the mobile setup.

## Prerequisites

- **Node.js** 20 LTS (22 also works). Check with `node -v`.
- **npm** (this repo uses npm, not pnpm, despite the legacy `pnpm-workspace.yaml`).
- **Sui CLI** — only needed if you want to redeploy the contract. Install via <https://docs.sui.io/build/install>.
- **Expo Go** on a phone (iOS or Android) *or* an iOS Simulator / Android emulator for mobile testing.

## Clone

```bash
git clone <repo-url> snapproof-sui
cd snapproof-sui
```

## Root env

Copy the example and keep the defaults (they point at testnet):

```bash
cp .env.example .env
```

Fields:

| Name | Purpose |
|------|---------|
| `SUI_NETWORK` | Which Sui network to read from. `testnet` is the default. |
| `PROOF_PACKAGE_ID` | The published Move package. Default is hardcoded to the current testnet deployment. |
| `WALRUS_PUBLISHER_URL` | Where to `PUT` image blobs. |
| `WALRUS_AGGREGATOR_URL` | Where to `GET` them. |
| `PORT` | Backend HTTP port. |
| `GOOGLE_MAPS_API_KEY` | Only needed if you ship a standalone Android build with the map screen. |

## Backend

```bash
cd backend
npm install
npm run dev
# → "SnapProof backend running on http://localhost:3001"
```

Test it:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","service":"snapproof-backend","timestamp":"..."}
```

See [`API.md`](./API.md) for the full endpoint list.

Note: the backend reads `SUI_NETWORK` and `PROOF_PACKAGE_ID` from `process.env`. `dotenv.config()` is called without a path, so it loads `backend/.env` if one exists. Easiest path is to copy the root `.env` into `backend/.env`, or export the variables in your shell before running `npm run dev`.

## Mobile

```bash
cd mobile
npm install
```

Create `mobile/.env`. Expo will expose only variables prefixed `EXPO_PUBLIC_`:

```
EXPO_PUBLIC_SUI_NETWORK=testnet
EXPO_PUBLIC_PROOF_PACKAGE_ID=0xf8f5963973c4ca34720937a070eb3e070851f50a2408092496d588574108bf2c
EXPO_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
EXPO_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Run:

```bash
npm start
# or from repo root
cd .. && npm run mobile
```

Open the QR in Expo Go, or press `i` for iOS Simulator, `a` for Android emulator, `w` for web.

First launch: the app generates a fresh keypair and you'll see the address in the Capture screen's wallet bar. Tap "Faucet" to request testnet SUI, then take a photo and submit.

### Web dev tips

- `npm run web` opens `http://localhost:19006`.
- The map screen shows a "Use list view on web" message and forces list mode.
- `react-native-maps` isn't available on web, so `MapView` never mounts — there's no extra config needed.

### Native dev tips

- For a real device over LAN, make sure your laptop and phone are on the same network and that `npm start` shows `--lan`.
- iOS Simulator needs Xcode + command-line tools.
- Android emulator needs Android Studio + an AVD (API 33+ recommended).
- Camera only works on real devices or simulators with a camera source; Expo Go on the simulator can still pick from the photo library.

## Web verifier

The `web/` workspace is a Next.js app that renders public proof pages and
accepts image hashes or object IDs at `/`. It pulls data from the same Sui
RPC the mobile app uses and falls back to the Express backend for indexer
lookups.

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

Key routes:

- `/` — search form (object ID or 64-hex image hash)
- `/p/[objectId]` — canonical proof page (server-fetches, client re-hashes)
- `/h/[hash]` — hash lookup that redirects to `/p/[id]` on hit
- `/p/[id]/opengraph-image` — edge-rendered OG preview

If you're running the backend locally on port 3001, leave
`NEXT_PUBLIC_BACKEND_URL` at its default.

## Contracts

Only needed if you're redeploying.

```bash
# Install Sui CLI first, then:
sui client switch --env testnet
sui client faucet   # ensure you have gas

cd contracts
sui move build
sui move test       # runs tests/snapproof_tests.move
./deploy.sh         # publishes and prints the new package ID
```

After a redeploy, update:

1. `.env` → `PROOF_PACKAGE_ID=0x...`
2. `mobile/.env` → `EXPO_PUBLIC_PROOF_PACKAGE_ID=0x...`

Then restart both the backend and the mobile bundler.

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No valid gas coins` on submit | Wallet has 0 SUI | Tap the Faucet button. If rate-limited, use `sui client transfer-sui` from another funded address. |
| `Walrus upload failed (500)` | Publisher busy or rate-limiting | Retry in ~30 seconds. If persistent, point `WALRUS_PUBLISHER_URL` at another known publisher. |
| Proofs don't show on Verify / Map | Package ID mismatch after redeploy | Ensure both `.env` files point at the newly deployed `PROOF_PACKAGE_ID`. |
| `crypto.getRandomValues is not a function` | Polyfill didn't load | Ensure `mobile/index.js` imports `./src/polyfills` *before* `expo-router/entry`. |
| `npm start` OOM on large images | Expo bundler heap | Already handled — the scripts pass `NODE_OPTIONS=--max-old-space-size=8192`. |
| Map shows no markers | Current events within the 50-event window have no `coarse_geo_hash` | Submit a new proof with location granted, or scroll back via "Load More". |

## Scripts cheat sheet

From the repo root:

```bash
npm run mobile         # expo start --lan (under mobile/)
npm run backend        # tsx watch src/index.ts (under backend/)
npm run build:backend  # tsc (under backend/)
```

Per-workspace:

```bash
# mobile
npm start              # LAN mode
npm run ios
npm run android
npm run web

# backend
npm run dev
npm run build
npm start              # node dist/index.js
npm run lint

# web
npm run dev
npm run build
npm start
npm run lint

# contracts
sui move build
sui move test
./deploy.sh
```

## Observability (optional)

Both the backend and the mobile app are instrumented to no-op unless you
opt in.

- **Sentry** — set `SENTRY_DSN` in `backend/.env` and `EXPO_PUBLIC_SENTRY_DSN`
  in `mobile/.env`. The optional dependencies (`@sentry/node`,
  `@sentry/react-native`) are imported dynamically, so missing them just
  leaves the no-op path active.
- **Prometheus** — the backend exposes `GET /api/metrics`. Point Prometheus
  or Grafana Agent at it. See [`BACKEND.md`](./BACKEND.md).
- **Postgres indexer** — set `DATABASE_URL` in `backend/.env` and install
  `pg`. Tables are created on startup.

# Mobile app (`mobile/`)

The mobile client is an Expo app written in TypeScript, using **Expo Router**
for file-based navigation. Every screen is a file in `app/`, and everything
non-UI lives under `src/`.

This document describes the **v0.2** mobile app (post Track A). See
[`CHANGELOG.md`](../../CHANGELOG.md) for the list of changes from v0.1.

## Stack summary

| Area | Choice | Why |
|------|--------|-----|
| Framework | Expo SDK 54, React Native 0.81, React 19 | One codebase for iOS, Android, and web (verify and map work great in a browser). |
| Navigation | `expo-router` (Stack) | File-based routing; each screen is an `app/*.tsx`. |
| Language | TypeScript strict | Catches most ABI-mismatch bugs when fields are added to the proof. |
| Camera | `expo-camera` + `expo-image-picker` | Picker is used for the actual capture — simpler and EXIF-aware. |
| Hashing | `expo-crypto` (native) / Web Crypto (web) | Single source of truth via `Platform.OS` branches in `utils/hash.ts`. |
| Location | `expo-location` | Precision reduced to a 6-char geohash before the value ever leaves the app. |
| Storage | `expo-secure-store` (native) / `localStorage` (web) | Holds the wallet secret key and user settings. |
| Outbox | `expo-file-system/legacy` | Durable JSON queue for offline submissions. |
| Connectivity | `@react-native-community/netinfo` | Triggers outbox drain on reconnect. |
| Maps | `react-native-maps` | Native-only; web falls back to list view. |
| Sui SDK | `@mysten/sui` | Used both to build transactions and to query events. |
| Telemetry (optional) | `@sentry/react-native` via dynamic import | Loaded only when `EXPO_PUBLIC_SENTRY_DSN` is set and the package is installed. |

## Directory layout

```
mobile/
├── app/                         # Expo Router screens
│   ├── _layout.tsx              # Stack navigator + analytics init + netinfo listener
│   ├── index.tsx                # Home (3 buttons)
│   ├── capture.tsx              # Capture + submit pipeline + outbox fallback
│   ├── proof.tsx                # Proof receipt (Copy Link uses WEB_VERIFIER_URL)
│   ├── verify.tsx               # Verification UI (on-chain + compare-hash)
│   ├── map.tsx                  # Map + list of recent geo-tagged proofs
│   ├── outbox.tsx               # Offline queue UI (retry, delete, view)
│   └── settings.tsx             # Privacy + capture settings
├── src/
│   ├── config.ts                # Env → constants (SUI, Walrus, backend, WEB_VERIFIER_URL, …)
│   ├── polyfills.ts             # crypto.getRandomValues shim for Sui SDK
│   ├── components/
│   │   └── OnboardingModal.tsx  # 3-step first-launch walkthrough
│   ├── services/
│   │   ├── analytics.ts         # Sentry-optional telemetry + event catalog
│   │   ├── outbox.ts            # Durable queue: enqueue, processQueue, remove
│   │   ├── settings.ts          # loadSettings / saveSettings (secure-store / localStorage)
│   │   ├── sui.ts               # createProofOnSui, lookupProofByImageHash, getProofById, getBalance
│   │   ├── walrus.ts            # uploadToWalrus, getWalrusViewUrl
│   │   └── wallet.ts            # getKeypair, getAddress, requestTestnetTokens, exportSecretKey
│   ├── types/
│   │   └── proof.ts             # ProofData, ProofRecord
│   └── utils/
│       ├── hash.ts              # hashImage, extractMetadata, hashMetadata, computeProofHash
│       ├── logger.ts            # Tag-prefixed console logger (dev-only verbose)
│       └── geohash.ts           # encodeGeohash, decodeGeohash
├── index.js                     # Entry — loads polyfills before expo-router
├── app.json                     # Expo config (permissions, plugins, bundle IDs)
├── package.json
└── tsconfig.json                # @/* alias to src/*
```

## Screen-by-screen walkthrough

### `app/_layout.tsx`

Initializes telemetry, emits `app_opened`, and registers seven routes in a
single `Stack`. Every screen inherits the dark header styling. Also wires
a `NetInfo` listener that calls `processQueue()` whenever the device
reports a transition to online, so the outbox drains automatically.

### `app/index.tsx` — Home

Three full-width buttons for **Capture**, **Verify**, **Map**. No state.
Its only job is to route.

### `app/capture.tsx` — Capture

The most state-heavy screen. Integrates every Track A feature.

Lifecycle:

1. On mount, `initWallet()` loads or creates the keypair and fetches the
   SUI balance.
2. On mount, `loadSettings()` reads `cameraOnlyMode` + `hasSeenOnboarding`.
   If the onboarding flag is off, the 3-step modal is shown once.
3. On mount, the capture screen polls `worldtimeapi.org` and surfaces a
   banner if the device clock is more than 2 minutes off.
4. `requestLocationPermission()` asks for foreground coarse location; if
   granted, captures `getCurrentPositionAsync` at `Accuracy.Balanced`
   for later geohashing.
5. Image acquisition:
   - `pickImage` uses the native camera.
   - `pickFromLibrary` uses the photo library — **disabled when
     `cameraOnlyMode` is on**, with a banner reminding the user.
6. As soon as an image is picked, `hashImage` runs and the 64-hex hash
   is shown as a monospace chip below the preview ("live hash preview").
7. `submitProof` is the full pipeline: `init` → `hash_image` →
   `hash_metadata` → `hash_proof` → `geohash` → `walrus_upload` →
   `sui_tx` → navigate to `/proof`. Each stage is tagged on the
   `proof_submit_failed` analytics event as `props.stage`.
8. **Offline fallback:** if any stage past hashing fails, the pending
   submission is copied into the outbox via `enqueueProof`. The user
   sees a banner offering to view the outbox.

Header buttons: 📤 outbox (with count badge), ⚙️ settings, ℹ️ onboarding.

Error UX: a red monospace box with a selectable error message, plus
heuristics. If the Sui error mentions "No valid gas" or "balance", the
screen swaps in explicit faucet / transfer instructions including the
address so the user can copy-paste.

### `app/proof.tsx` — Receipt

Pure render of route params (the capture screen passes everything as a
query string). It formats the timestamp, builds three explorer links
(suiscan transaction, suiscan object, Walrus aggregator), and offers:

- **Share Proof** — composes a plain-text receipt suitable for
  messaging.
- **Copy Link** — copies `${WEB_VERIFIER_URL}/p/${objectId}`, the
  shareable URL served by the web verifier.

Both actions emit analytics events (`share_tapped`, `copy_link_tapped`).

### `app/verify.tsx` — Verification

Two modes controlled by a segmented toggle:

- **Verify on Chain:** hash the picked image, query the chain for a
  matching `ProofCreated` event, fetch the object for details.
- **Compare Hash:** hash the picked image and compare to a pasted
  expected hash. No network needed.

Emits `verify_started` on submit and `verify_result` with
`props.result: "match" | "mismatch" | "not_found"` on completion.

The result panel is one of three colored states — VERIFIED (green),
MISMATCH (red), NOT FOUND (grey) — with proof details and explorer links
inlined when a match is found.

### `app/map.tsx` — Proof map

Queries up to 50 `ProofCreated` events, keeps only ones with a
non-empty `coarse_geo_hash`, decodes each to a center lat/lng, and
plots them. Includes a pagination button ("Load More") that reuses the
previous response's `nextCursor`. The initial region centers on the
first pin if there is one, otherwise a default (Ho Chi Minh City). Web
platforms force list-only mode because `react-native-maps` doesn't
render on web.

**Thumbnails.** `ProofCreated` events do not carry `walrus_blob_id`,
so the map screen hydrates image URLs lazily through
`src/services/proofDetails.ts` — a deduplicating in-memory cache that
wraps `getProofById` and resolves each object to its Walrus aggregator
URL. After the event query returns, the first 8 pins are prefetched
(concurrency 6) so the top of the viewport renders with photos
immediately. In map mode, tapping a marker triggers `hydratePin`
for that pin; in list mode, a `FlatList` `onViewableItemsChanged`
handler (30% visibility threshold, concurrency 4) prefetches
thumbnails as items scroll into view. Each marker is a 40px circular
photo ringed in red, and the custom `Callout` (tooltip mode) shows
a 160px preview plus an "Open Verifier →" link that launches
`${WEB_VERIFIER_URL}/p/${proofId}`, emitting a `map_proof_opened`
analytics event. Missing/failed fetches degrade gracefully to a
monospace 4-char hash fingerprint in a colored tile.

### `app/outbox.tsx` — Outbox

Lists every pending item in the offline queue. Per item:

- Thumbnail, truncated hash, age, retry count, last error.
- **Retry** — calls `processOutboxItem(item)` directly.
- **Delete** — removes the item and its cached image from disk.

The screen also has a "Retry all" button that calls `processQueue()`.

### `app/settings.tsx` — Settings

Two sections:

- **Privacy.** Telemetry opt-in toggle (writes
  `snapproof_telemetry_optin` to SecureStore; re-initializes the
  analytics module on flip).
- **Capture.** Camera-only mode toggle (writes to `loadSettings` /
  `saveSettings`). Emits `settings_changed`.

Values are read via `loadSettings()` on focus and written via
`saveSettings(patch)` on each change.

## Services

### `services/wallet.ts`

- `getKeypair()` — cached in module-level memory after first call.
  Tries to load a secret key from secure storage; if none, generates a
  new `Ed25519Keypair`, saves the secret, and returns it.
- `getAddress()` — thin wrapper, derives the address from the cached
  keypair.
- `requestTestnetTokens()` — POSTs to
  `https://faucet.testnet.sui.io/v1/gas` with the address; swallows
  errors and returns `boolean`.
- `exportSecretKey()` — returns the stored secret key as a
  BIP39-compatible string for display in the onboarding modal.

Design note: the wallet is intentionally minimal. No seed phrase UI
(beyond "copy this string to a password manager"), no import/export
UI, no PIN. For a production app this is where you'd wire in
**zkLogin** (see `TASKS.md` / Track B of `ROADMAP.md`) or a proper
wallet SDK.

### `services/sui.ts`

- `createProofOnSui(proof)` — builds a `Transaction`, calls `moveCall`
  with `target = ${PROOF_PACKAGE_ID}::snapproof::create_proof` and the
  seven `pure` arguments (in the Move function's positional order).
  Signs and executes with `showEffects`, `showEvents`, and
  `showObjectChanges` so we can extract the new object ID from
  `objectChanges`.
- `getProofById(objectId)` — `getObject` with `showContent: true`,
  type-checks `dataType === "moveObject"`, maps snake_case Move fields
  to camelCase TypeScript.
- `lookupProofByImageHash(hash)` — `queryEvents` the most recent 50
  `ProofCreated` events and finds the first whose `image_hash`
  matches. Returns `{ txDigest, proofId }` or `null`.
- `getBalance()` — returns the total balance (MIST) owned by the
  current wallet.

### `services/walrus.ts`

- `getImageBytes(uri)` — platform-branching: on web,
  `fetch(blobUri).arrayBuffer()`; on native, read the file as base64
  via `expo-file-system/legacy` and decode.
- `uploadToWalrus(uri)` — `PUT ${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5`
  with `Content-Type: application/octet-stream`. The response is
  either `newlyCreated.blobObject.blobId` (first upload) or
  `alreadyCertified.blobId` (deduped). Either way, the blob ID is
  what gets recorded on chain.
- `getWalrusViewUrl(blobId)` — builds the read URL via the aggregator.

The `epochs=5` parameter controls how long the blob is kept; for a
hackathon MVP five epochs (~five days on testnet) is fine.

### `services/proofDetails.ts`

Short-lived in-memory cache of `PhotoProof` details, used by the map
screen to resolve image URLs that aren't present in `ProofCreated`
events.

- `getProofDetailsCached(objectId)` — dedupes concurrent callers
  against an in-flight Promise, caches successes for 10 minutes and
  failures for 30 seconds, and returns `{ ...proof, imageUrl }` where
  `imageUrl` is `getWalrusViewUrl(walrusBlobId)` or `null`.
- `prefetchProofDetails(objectIds, concurrency = 6)` — runs a bounded
  worker pool over an ID list; used by the map screen for the first
  few pins and by the list's viewport handler for visible items.
- `clearProofDetailsCache()` — testing / screen re-entry helper.

### `services/analytics.ts`

Optional crash reporting + event tracking. Safe to use before it
initializes (all functions are no-ops until `initAnalytics()` runs and
the user hasn't opted out).

- `initAnalytics()` — reads the `snapproof_telemetry_optin` SecureStore
  key. If the user opted out, every subsequent call is a no-op.
  Otherwise, if `EXPO_PUBLIC_SENTRY_DSN` is set and
  `@sentry/react-native` is installed, Sentry is initialized via a
  dynamic import so the package is optional.
- `track({ name, props? })` — emits a structured event. Today it logs
  (and adds a Sentry breadcrumb); swap the `emitEvent` internal to
  wire PostHog / Segment / Amplitude without touching call sites.
- `captureException(err, context?)` — logs and forwards to Sentry.
- `setUser(walletAddress)` — attaches the public address to Sentry.
  Never sends any PII.

Event catalog (stable names; dashboards depend on them):

```
app_opened
proof_submit_started
proof_submit_succeeded
proof_submit_failed               props.stage
verify_started
verify_result                     props.result
wallet_funded
faucet_requested
share_tapped
copy_link_tapped
permission_granted                props.permission, props.result
image_hashed                      props.source
settings_opened / settings_changed
outbox_enqueued / outbox_processed
```

### `services/settings.ts`

`loadSettings()` and `saveSettings(patch)` over a single versioned key
(`snapproof.settings.v1`). Two fields today:

```ts
interface AppSettings {
  cameraOnlyMode: boolean;     // disables library picker when true
  hasSeenOnboarding: boolean;  // drives the 3-step modal
}
```

Adds DEFAULTS + `...parsed` spread so that new settings land with a
safe default on existing installs.

### `services/outbox.ts`

Durable queue for submissions that failed due to connectivity or
transient errors. Backed by a JSON file at
`${FileSystem.documentDirectory}snapproof_outbox.json` on native and
`localStorage` on web.

- `enqueueProof(imageUri, exif, location, liveHash, lastError?)` —
  copies the image into the document directory so the OS doesn't
  garbage-collect it, then pushes a new `OutboxItem` onto the queue.
  Emits `outbox_enqueued`.
- `getOutboxQueue()` / `updateOutboxItem(id, patch)` /
  `removeOutboxItem(id)` — queue mutators; `removeOutboxItem`
  also deletes the cached image file.
- `processOutboxItem(item)` — re-runs the full pipeline using the
  item's original `liveHash` and `createdAt` so the proof's
  timestamp reflects the *capture* time, not the upload time.
  Emits `outbox_processed`.
- `processQueue()` — drains the queue in FIFO order. Stops after the
  first failure (assumes the network is still bad) and marks that
  item `failed` with `lastError`.

The `_layout.tsx` NetInfo listener invokes `processQueue()` on every
transition to connected.

## Utilities

### `utils/hash.ts`

- `hashImage(uri)` — reads bytes, SHA-256 hex.
- `extractMetadata(uri, exif?)` — pulls `DateTimeOriginal` / `DateTime`
  if present, converts the `YYYY:MM:DD HH:MM:SS` format to ISO and
  parses. Falls back to `Date.now()`. File size comes from
  `expo-file-system` (native) or `fetch(uri).blob().size` (web).
  File name is the trailing path segment.
- `hashMetadata(metadata)` — JSON-stringifies
  `{timestamp, fileSize, fileName}` and hashes.
- `computeProofHash(imageHash, metadataHash)` — hashes the
  concatenation `imageHash + ":" + metadataHash`.

All four functions return lowercase hex strings of 64 chars.

### `utils/geohash.ts`

A self-contained implementation of standard base-32 geohashing.
Precision 6 means a ~1.2 km cell — granular enough to show a marker
on a city map, coarse enough that the exact photo location is *not*
on chain. `encodeGeohash` and `decodeGeohash` are strict inverses up
to the cell's center.

### `utils/logger.ts`

Simple tag-prefixed `console.log` wrapper:

```ts
logger.info("CAPTURE", "submit started", { imageHash });
```

In `__DEV__` emits a colorized line; otherwise only `warn` / `error`
print. Everything is no-op in production web builds.

## Configuration

Everything in `src/config.ts` reads from `process.env.EXPO_PUBLIC_*`
with fallbacks. Expo exposes only variables prefixed `EXPO_PUBLIC_`
to the app bundle — that is by design (no secrets in the client).

| Env var | Default | Used for |
|---------|---------|----------|
| `EXPO_PUBLIC_SUI_NETWORK` | `testnet` | Fullnode URL, explorer URL |
| `EXPO_PUBLIC_PROOF_PACKAGE_ID` | hardcoded testnet package | `moveCall` target, event type filter |
| `EXPO_PUBLIC_WALRUS_PUBLISHER_URL` | testnet publisher | Uploads |
| `EXPO_PUBLIC_WALRUS_AGGREGATOR_URL` | testnet aggregator | Read URLs |
| `EXPO_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Reserved for proof-index lookups |
| `EXPO_PUBLIC_WEB_VERIFIER_URL` | `http://localhost:3000` | "Copy Link" on receipts |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | empty | Standalone Android build only |
| `EXPO_PUBLIC_SENTRY_DSN` | empty | Optional — enables Sentry crash reporting |
| `EXPO_PUBLIC_APP_VERSION` | `0.1.0` | Sentry release tag |

See [`mobile/.env.example`](../../mobile/.env.example) for the
full template.

## Polyfills (`src/polyfills.ts`)

The Sui SDK expects `crypto.getRandomValues`. React Native doesn't
have it by default. The polyfill:

1. Imports `react-native-get-random-values` (preferred path —
   installs a proper CSPRNG).
2. Falls back to a `Math.random`-based shim if that package is
   unavailable.

The shim is **cryptographically insecure** — it exists so the app
doesn't crash if the package is missing. In practice
`react-native-get-random-values` ships in `package.json`, so the
real path is always used.

`index.js` imports `./src/polyfills` before `expo-router/entry` so
the shim is in place before any Sui SDK code loads.

## Platform branches, summarized

The mobile code runs on three platforms — iOS, Android, and web — and
has explicit `Platform.OS === "web"` branches in these places:

- `utils/hash.ts` — Web Crypto vs. `expo-crypto`.
- `services/walrus.ts` — `fetch` a `blob:` URL vs. read a `file://` URL.
- `services/wallet.ts` — `localStorage` vs. `expo-secure-store`.
- `services/settings.ts` — `localStorage` vs. `expo-secure-store`.
- `services/outbox.ts` — `localStorage` vs. `expo-file-system/legacy`.
- `app/map.tsx` — `react-native-maps` vs. list-only fallback.
- `app/capture.tsx` — `window.alert` vs. `Alert.alert`.

These are the only cross-platform gotchas. Everything else is stock
React Native.

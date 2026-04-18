# Mobile app (`mobile/`)

The mobile client is an Expo app written in TypeScript, using **Expo Router** for file-based navigation. Every screen is a file in `app/`, and everything non-UI lives under `src/`.

## Stack summary

| Area | Choice | Why |
|------|--------|-----|
| Framework | Expo SDK 54, React Native 0.81, React 19 | One codebase for iOS, Android, and web (the verify screen works great in a browser). |
| Navigation | `expo-router` (Stack) | File-based routing; each screen is an `app/*.tsx`. |
| Language | TypeScript strict | Catches most ABI-mismatch bugs when fields are added to the proof. |
| Camera | `expo-camera` + `expo-image-picker` | Picker is used for the actual capture — simpler and EXIF-aware. |
| Hashing | `expo-crypto` (native) / Web Crypto (web) | Single source of truth via `Platform.OS` branches in `utils/hash.ts`. |
| Location | `expo-location` | Precision reduced to a 6-char geohash before the value ever leaves the app. |
| Storage | `expo-secure-store` (native) / `localStorage` (web) | Holds only the wallet secret key. |
| Maps | `react-native-maps` | Native-only; web falls back to list view. |
| Sui SDK | `@mysten/sui` | Used both to build transactions and to query events. |

## Directory layout

```
mobile/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Stack navigator + status bar
│   ├── index.tsx             # Home (3 buttons)
│   ├── capture.tsx           # Capture + submit pipeline
│   ├── proof.tsx             # Proof receipt
│   ├── verify.tsx            # Verification UI
│   └── map.tsx               # Map + list of recent geo-tagged proofs
├── src/
│   ├── config.ts             # Env → constants
│   ├── polyfills.ts          # crypto.getRandomValues shim for Sui SDK
│   ├── services/
│   │   ├── sui.ts            # createProofOnSui, lookupProofByImageHash, getProofById, getBalance
│   │   ├── walrus.ts         # uploadToWalrus, getWalrusViewUrl
│   │   └── wallet.ts         # getKeypair, getAddress, requestTestnetTokens
│   ├── types/
│   │   └── proof.ts          # ProofData, ProofRecord
│   └── utils/
│       ├── hash.ts           # hashImage, extractMetadata, hashMetadata, computeProofHash
│       └── geohash.ts        # encodeGeohash, decodeGeohash
├── index.js                  # Entry — loads polyfills before expo-router
├── app.json                  # Expo config (permissions, plugins, bundle IDs)
├── package.json
└── tsconfig.json             # @/* alias to src/*
```

## Screen-by-screen walkthrough

### `app/_layout.tsx`

Defines the stack. Every screen inherits the dark header styling. Title order matches the navigation model — Home → Capture → Proof (receipt) and Home → Verify, Home → Map as siblings.

### `app/index.tsx` — Home

Three full-width buttons for **Capture**, **Verify**, **Map**. No state. Its only job is to route.

### `app/capture.tsx` — Capture

The most state-heavy screen. Local state: selected image URI, EXIF dictionary, loading flag, textual status, error message, wallet address, balance, location status, current lat/lng.

Lifecycle:

1. On mount, `initWallet()` loads or creates the keypair and fetches the SUI balance.
2. On mount, `requestLocationPermission()` asks for foreground coarse location; if granted, immediately captures `getCurrentPositionAsync` at `Accuracy.Balanced` for later geohashing.
3. Image acquisition is split in two — `pickImage` uses the native camera, `pickFromLibrary` uses the photo library. Both request EXIF (`exif: true`).
4. `submitProof` is the full pipeline: hash → metadata → proof hash → geohash → Walrus upload → Sui call → navigate to `/proof`.

Error UX: a red monospace box with a selectable error message, plus heuristics. If the Sui error mentions "No valid gas" or "balance", the screen swaps in explicit faucet / transfer instructions including the address so the user can copy-paste.

### `app/proof.tsx` — Receipt

Pure render of route params (the capture screen passes everything as query string). It formats the timestamp, builds three explorer links (suiscan transaction, suiscan object, Walrus aggregator), and offers a "Share Proof" action that composes a plain-text receipt suitable for messaging.

### `app/verify.tsx` — Verification

Two modes controlled by a segmented toggle:

- **Verify on Chain:** hash the picked image, query the chain for a matching `ProofCreated` event, fetch the object for details.
- **Compare Hash:** hash the picked image and compare to a pasted expected hash. No network needed.

The result panel is one of three colored states — VERIFIED (green), MISMATCH (red), NOT FOUND (grey) — with proof details and explorer links inlined when a match is found.

### `app/map.tsx` — Proof map

Queries up to 50 `ProofCreated` events, keeps only ones with a non-empty `coarse_geo_hash`, decodes each to a center lat/lng, and plots them. Includes a pagination button ("Load More") that reuses `response.nextCursor`. The initial region centers on the first pin if there is one, otherwise a default (Ho Chi Minh City). Web platforms force list-only mode because `react-native-maps` doesn't render on web.

## Services

### `services/wallet.ts`

- `getKeypair()` — cached in module-level memory after first call. Tries to load a secret key from secure storage; if none, generates a new `Ed25519Keypair`, saves the secret, and returns it.
- `getAddress()` — thin wrapper, derives the address from the cached keypair.
- `requestTestnetTokens()` — POSTs to `https://faucet.testnet.sui.io/v1/gas` with the address; swallows errors and returns `boolean`.

Design note: the wallet is intentionally minimal. No seed phrase UI, no import/export, no pin. For a production app this is where you'd wire in **zkLogin** (listed in the "nice to have" section of `TASKS.md`) or a proper wallet SDK.

### `services/sui.ts`

- `createProofOnSui(proof)` — builds a `Transaction`, calls `moveCall` with `target = ${PROOF_PACKAGE_ID}::snapproof::create_proof` and the seven `pure` arguments (in the Move function's positional order). Signs and executes with `showEffects`, `showEvents`, and `showObjectChanges` so we can extract the new object ID from `objectChanges`.
- `getProofById(objectId)` — `getObject` with `showContent: true`, type-checks `dataType === "moveObject"`, maps snake_case Move fields to camelCase TypeScript.
- `lookupProofByImageHash(hash)` — `queryEvents` the most recent 50 `ProofCreated` events and finds the first whose `image_hash` matches. Returns `{ txDigest, proofId }` or `null`.
- `getBalance()` — returns the total balance (MIST) owned by the current wallet.

### `services/walrus.ts`

- `getImageBytes(uri)` — platform-branching: on web, `fetch(blobUri).arrayBuffer()`; on native, read the file as base64 via `expo-file-system/legacy` and decode.
- `uploadToWalrus(uri)` — `PUT ${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5` with `Content-Type: application/octet-stream`. The response is either `newlyCreated.blobObject.blobId` (first upload) or `alreadyCertified.blobId` (deduped). Either way, the blob ID is what gets recorded on chain.
- `getWalrusViewUrl(blobId)` — builds the read URL via the aggregator.

The `epochs=5` parameter controls how long the blob is kept; for a hackathon MVP five epochs (~five days on testnet) is fine.

## Utilities

### `utils/hash.ts`

- `hashImage(uri)` — reads bytes, SHA-256 hex.
- `extractMetadata(uri, exif?)` — pulls `DateTimeOriginal` / `DateTime` if present, converts the `YYYY:MM:DD HH:MM:SS` format to ISO and parses. Falls back to `Date.now()`. File size comes from `expo-file-system` (native) or `fetch(uri).blob().size` (web). File name is the trailing path segment.
- `hashMetadata(metadata)` — JSON-stringifies `{timestamp, fileSize, fileName}` and hashes.
- `computeProofHash(imageHash, metadataHash)` — hashes the concatenation `imageHash + ":" + metadataHash`.

All four functions return lowercase hex strings of 64 chars.

### `utils/geohash.ts`

A self-contained implementation of standard base-32 geohashing. Precision 6 means a ~1.2 km cell — granular enough to show a marker on a city map, coarse enough that the exact photo location is *not* on chain. `encodeGeohash` and `decodeGeohash` are strict inverses up to the cell's center.

## Configuration

Everything in `src/config.ts` reads from `process.env.EXPO_PUBLIC_*` with fallbacks. Expo exposes only variables prefixed `EXPO_PUBLIC_` to the app bundle — that is by design (no secrets in the client).

| Env var | Default | Used for |
|---------|---------|----------|
| `EXPO_PUBLIC_SUI_NETWORK` | `testnet` | Fullnode URL, explorer URL |
| `EXPO_PUBLIC_PROOF_PACKAGE_ID` | hardcoded testnet package | `moveCall` target, event type filter |
| `EXPO_PUBLIC_WALRUS_PUBLISHER_URL` | testnet publisher | Uploads |
| `EXPO_PUBLIC_WALRUS_AGGREGATOR_URL` | testnet aggregator | Read URLs |
| `EXPO_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Not currently used by any screen — reserved for future indexing calls |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | empty | Currently unused by `react-native-maps` on Expo Go; needed when you build a standalone Android app |

## Polyfills (`src/polyfills.ts`)

The Sui SDK expects `crypto.getRandomValues`. React Native doesn't have it by default. The polyfill:

1. Imports `react-native-get-random-values` (preferred path — installs a proper CSPRNG).
2. Falls back to a `Math.random`-based shim if that package is unavailable.

The shim is **cryptographically insecure** — it exists so the app doesn't crash if the package is missing. In practice `react-native-get-random-values` ships in `package.json`, so the real path is always used.

`index.js` imports `./src/polyfills` before `expo-router/entry` so the shim is in place before any Sui SDK code loads.

## Platform branches, summarized

The mobile code runs on three platforms — iOS, Android, and web — and has explicit `Platform.OS === "web"` branches in three places:

- `utils/hash.ts` — Web Crypto vs. `expo-crypto`.
- `services/walrus.ts` — `fetch` a `blob:` URL vs. read a `file://` URL.
- `services/wallet.ts` — `localStorage` vs. `expo-secure-store`.
- `app/map.tsx` — `react-native-maps` vs. list-only fallback.
- `app/capture.tsx` — `window.alert` vs. `Alert.alert`.

These are the only cross-platform gotchas. Everything else is stock React Native.

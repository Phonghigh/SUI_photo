# Workflows

This document spells out every meaningful workflow in the project — for end users (capture, verify, browse) and for developers (deploy contract, run backend, point mobile at it). Each workflow lists the screens, files, functions, and external services involved, in the order they fire.

## 1. Capture and submit a proof (end-to-end)

The headline flow. From a tap to an on-chain `PhotoProof`.

| Step | What the user sees | What the code does | File / function |
|------|-------------------|--------------------|-----------------|
| 1 | Home → "Capture Photo" | Navigate to `/capture` | `app/index.tsx` (`router.push("/capture")`) |
| 2 | First-mount of capture screen | Init wallet (load or generate Ed25519 keypair), check balance, request location permission | `app/capture.tsx` `initWallet`, `requestLocationPermission` → `services/wallet.ts` `getKeypair`, `getAddress`, `services/sui.ts` `getBalance` |
| 3 | "Take Photo" or "Pick from Library" | Launch native picker with EXIF | `app/capture.tsx` `pickImage` / `pickFromLibrary` → `expo-image-picker` |
| 4 | Image preview shown | Save URI + EXIF in component state | `setImageUri`, `setExif` |
| 5 | "Submit Proof to Sui" | Hash image bytes (SHA-256) | `utils/hash.ts` `hashImage` (uses `expo-crypto` natively, Web Crypto on web) |
| 6 | Status: "Processing metadata..." | Pull `DateTimeOriginal` / `DateTime` from EXIF, fall back to `Date.now()`. Get file size. JSON-stringify and SHA-256. | `utils/hash.ts` `extractMetadata`, `hashMetadata` |
| 7 | Status: "Capturing location..." | If permission granted, encode lat/lng to a precision-6 geohash (~1.2 km box). Otherwise leave blank. | `utils/geohash.ts` `encodeGeohash` |
| 8 | Status: "Uploading to Walrus..." | Read bytes (already done in hashing). PUT to `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5`. Parse `newlyCreated.blobObject.blobId` or `alreadyCertified.blobId`. | `services/walrus.ts` `uploadToWalrus` |
| 9 | Status: "Creating proof on Sui..." | Build a `Transaction` with one `moveCall` to `snapproof::create_proof(walrus_blob_id, image_hash, metadata_hash, proof_hash, created_at, coarse_geo_hash, case_id)`. Sign with the local Ed25519 keypair. Submit with `showEffects+showEvents+showObjectChanges`. Extract the new `PhotoProof` object ID from `objectChanges`. | `services/sui.ts` `createProofOnSui` |
| 10 | Receipt screen | Push `/proof` with all fields as route params. Render explorer link, Walrus link, share button. | `app/proof.tsx` |

Failure handling: any step that throws is caught at the top of `submitProof`, the message is displayed in a red error box, and a heuristic for "no SUI in wallet" surfaces faucet instructions inline.

## 2. Verify a photo against the chain

The complement of capture. Anyone — not just the creator — can do this.

| Step | What the user sees | What the code does | File / function |
|------|-------------------|--------------------|-----------------|
| 1 | Home → "Verify Photo" | Navigate to `/verify`. Default mode is "Verify on Chain". | `app/index.tsx` |
| 2 | Tap placeholder → image picker | Pick an image from the library | `app/verify.tsx` `pickImage` |
| 3 | "Verify on Sui" | Recompute SHA-256 of the picked image | `utils/hash.ts` `hashImage` |
| 4 | Status: "Searching Sui blockchain..." | Query the most recent 50 `ProofCreated` events, descending. Linear-scan for `image_hash` match. | `services/sui.ts` `lookupProofByImageHash` |
| 5 | If a match is found, "Fetching proof details..." | `getProofById` reads the full `PhotoProof` object so the metadata hash, Walrus blob, geohash, and case ID are available (the event payload only carries a subset). | `services/sui.ts` `getProofById` |
| 6 | Result card | Show VERIFIED with creator, date, geohash, link to the Sui transaction, link to view the original on Walrus. NOT FOUND otherwise. | `app/verify.tsx` result panel |

There is also a "Compare Hash" mode that simply hashes the picked image and compares to a hash the user pastes — useful for offline checks against a known proof.

## 3. Browse proofs on a map

Lets you see *where* recent proofs were captured (within ~1.2 km) without needing to know any specific image.

| Step | What | Where |
|------|------|-------|
| 1 | Home → "Proof Map" | `app/index.tsx` |
| 2 | Mount → fetch recent `ProofCreated` events (limit 50, descending) | `app/map.tsx` `fetchGeoProofs` |
| 3 | For each event with a non-empty `coarse_geo_hash`, decode back to a center lat/lng | `utils/geohash.ts` `decodeGeohash` |
| 4 | Render `react-native-maps` markers. On web, the map renderer is unavailable, so the screen forces "list" mode. | `app/map.tsx` |
| 5 | Tapping a marker shows a callout that links to the Sui explorer. Tapping a list card opens external Maps or the explorer. | `openInMaps`, `openExplorer` |
| 6 | "Load More" calls `queryEvents` again with `cursor: response.nextCursor` for pagination. | same |

## 4. Wallet bootstrap (first-run on a device)

Implicit, runs the first time `getKeypair` is called.

1. Try to load a saved secret key from `expo-secure-store` (native) or `localStorage` (web) under `snapproof-keypair`.
2. If absent, generate a new `Ed25519Keypair` and save the secret key to the same store.
3. Cache the keypair in module-level memory for the rest of the session.
4. The address is derived from the keypair on demand.

Result: the app effectively gives every device a self-custodial Sui address with no user action. The trade-off — and a known MVP limitation — is that there is no recovery: clearing app storage or losing the device loses the address.

## 5. Faucet / fund the local wallet

Two paths:

- **In-app:** Capture screen → "Faucet" button → `requestTestnetTokens` → `POST https://faucet.testnet.sui.io/v1/gas` with the local address. Throws no error on rate-limit; the UI just shows a failure message.
- **CLI fallback:** `sui client faucet` (after `sui client switch --env testnet`) or transfer from any other testnet wallet using the printed address.

Without funds, `submitProof` will fail at step 9 with a "No valid gas" error. The capture screen detects this and inlines a transfer command using the device address.

## 6. Deploy or redeploy the Move contract

Usually only run by the project maintainer. Captured in `contracts/deploy.sh`:

1. `cd contracts`
2. `chmod +x deploy.sh && ./deploy.sh`
3. Script runs `sui move build` then `sui client publish --gas-budget 100000000 --json`.
4. It greps the JSON for `packageId` and prints next steps.
5. **You must** then update two places with the new package ID:
   - `mobile/.env` → `EXPO_PUBLIC_PROOF_PACKAGE_ID=0x...`
   - `.env` (backend) → `PROOF_PACKAGE_ID=0x...`
6. The current testnet deployment is recorded in `contracts/Published.toml` (`published-at = 0x8cb3e3d0...3321`, version 1, with an `upgrade-capability`).

Upgrades use `sui client upgrade` and the upgrade cap object — not in scope for the MVP.

## 7. Run the backend locally

1. `cd backend && npm install`
2. Make sure the project root `.env` has `SUI_NETWORK`, `PROOF_PACKAGE_ID`, and `WALRUS_*` set (the backend reads from `process.env`, loaded by `dotenv` at the project root by default — when running with `npm run dev` from `backend/`, copy or symlink the `.env` into `backend/`, or set the variables in your shell).
3. `npm run dev` — runs `tsx watch src/index.ts`.
4. Express listens on `PORT` (default `3001`). Hit `http://localhost:3001/api/health` to confirm it's up.
5. The backend will lazily create a `SuiClient` against the configured network and start serving the routes documented in [`API.md`](./API.md).

## 8. Run the mobile app locally

1. `cd mobile && npm install`
2. Create `mobile/.env` with `EXPO_PUBLIC_*` vars (see `SETUP.md`).
3. `npm start` (or from repo root: `npm run mobile`). This runs `expo start --lan`.
4. Open in Expo Go (scan QR), an iOS Simulator (`npm run ios`), an Android emulator (`npm run android`), or a browser (`npm run web`).
5. The first time you open the app, the wallet bootstrap flow generates a keypair and the Capture screen will show your new address — copy it and fund it via the faucet button or CLI.

## 9. Add a new field to a proof

A worked example to show how the layers connect when the schema changes.

1. **Move:** add the field to `PhotoProof`, to `create_proof`'s arguments, and (if it should be event-indexable) to `ProofCreated`. Bump the package version on the next deploy.
2. **Backend types:** add it to `ProofData` in `backend/src/types/proof.ts`.
3. **Backend reader:** map it in `getProofObject` in `backend/src/services/sui-client.ts` (and `queryProofEvents` if you added it to the event).
4. **Mobile types:** mirror the field in `mobile/src/types/proof.ts`.
5. **Mobile sender:** add a `tx.pure.string(...)` (or appropriate `tx.pure.<type>(...)`) call in `services/sui.ts` `createProofOnSui`, in the same order as the Move signature.
6. **Mobile UI:** capture the value, pass it through to `proof.tsx` route params, render it on the receipt and verify screens.
7. Redeploy the contract and update both `.env` files with the new package ID.

The order matters because the Move function takes positional arguments, not named ones — getting the order wrong is a runtime ABI mismatch, not a compile error.

## 10. Recover from a redeploy

When the package ID changes, every existing `PhotoProof` object is still valid (objects are tied to the publishing package, not the latest), but `queryEvents` on the new `MoveEventType = ${NEW_PACKAGE_ID}::snapproof::ProofCreated` will only see proofs created after the redeploy. To keep historical proofs visible, either:

- Index against the *original* package ID (preserved in `contracts/Published.toml` as `original-id`), or
- Use the on-chain upgrade flow (`sui client upgrade`) so the package ID is shared across versions.

The MVP does the simple thing: redeploys produce a fresh ID, and old proofs become "legacy" (still on chain, but invisible to the verify/map screens unless you keep the old package ID configured somewhere).

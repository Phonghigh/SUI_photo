# Demo script

A two-to-three minute walkthrough you can follow live or record. Assumes the app is installed on a phone (Expo Go or a dev build) and a presenter screen shows the Sui explorer.

## Setup (do this once before you demo)

1. Open the app on the phone. The Capture tab shows your wallet address and balance.
2. If the balance is 0 SUI, tap the **Faucet** button. Wait for the success alert.
3. Make sure your laptop has **suiscan.xyz/testnet** open in a browser, ready to paste.
4. (Optional) Enable location so the proof map has something to show.

## The pitch (30 seconds)

> "Photos get manipulated. Courts, insurers, and journalists need to know a photo existed at a certain time and hasn't been changed. SnapProof is a mobile app that anchors any photo on the Sui blockchain in a few seconds, so that anyone, anywhere, can later verify it's the same photo."

## Part 1 — Capture (45 seconds)

1. From the Home screen, tap **Capture Photo**.
2. Tap **Take Photo** and point the camera at something visually distinctive (whiteboard, person, product, venue signage). Snap it.
3. The preview appears. Say: *"The app just computed a SHA-256 of this image on the device. Nothing has left yet."*
4. Tap **Submit Proof to Sui**. Narrate the status text as it updates:
   - *Hashing image...*
   - *Processing metadata...*
   - *Capturing location...* (if location is granted)
   - *Uploading to Walrus...* — *"the image itself is going to decentralized storage"*
   - *Creating proof on Sui...* — *"the chain only gets the hash"*
5. The receipt screen appears. Point out: image hash, proof hash, Walrus blob ID, transaction digest, object ID, and the geohash if present.

## Part 2 — Verify from the explorer (30 seconds)

Switch to the presenter laptop.

1. Copy the transaction digest from the phone (or AirDrop / share it).
2. Paste into **suiscan.xyz/testnet/tx/<digest>**. Say: *"This is a public block explorer — no SnapProof infrastructure involved."*
3. Point out the emitted `ProofCreated` event in the explorer with the hash.
4. (Optional) Tap **View Image on Walrus** on the phone to open the original from the decentralized storage.

Emphasize: *"Everything we just did is anchored in public, permissionless infrastructure. If the SnapProof servers vanished right now, this proof is still verifiable."*

## Part 3 — Verify a real photo (30 seconds)

Back on the phone.

1. Tap **Back to Home**, then **Verify Photo**.
2. Make sure **Verify on Chain** is selected.
3. Tap the placeholder and select the same photo you just captured.
4. Tap **Verify on Sui**.
5. The VERIFIED card appears, with the creator address, creation date, Walrus link, and "View Transaction" link. Read out: *"Anyone — not just me — can take this same image and confirm it matches the on-chain proof."*

### Optional: Mismatch demo

If you have time:

1. Tap Verify, select a *different* photo.
2. Tap **Verify on Sui**.
3. The **NOT FOUND** card appears. Say: *"Different image, different hash, no on-chain record."*

## Part 4 — The map (30 seconds)

1. Back to Home, tap **Proof Map**.
2. A pin appears roughly where you took the photo — intentionally coarse (~1.2 km) so exact location isn't leaked.
3. Tap a pin; the callout links to the Sui explorer.
4. *"Every pin here is a photo that someone timestamped on Sui. You're looking at a decentralized registry of verified moments."*

## Closing (15 seconds)

> "So that's SnapProof. Capture is one tap. Verification is independent of our servers. The chain holds hashes, Walrus holds bytes, and the app is less than a weekend's work of UI over public infrastructure. We think this becomes the base layer for verified media on Sui."

## If things go wrong

| Problem | Recovery |
|---------|----------|
| Faucet rate-limited | Use `sui client transfer-sui` from a pre-funded address before the demo. |
| Walrus publisher returns 500 | Retry once. If it fails again, switch `WALRUS_PUBLISHER_URL` to a different publisher in `mobile/.env`, restart the bundler. |
| Map shows no pins | Recent proofs had no geotag. Submit a proof with location enabled first. |
| Explorer is slow | Skip the "switch to laptop" part; show the same info on the phone's receipt screen. |

## Slides / one-liner summary

If you need a single takeaway line for a slide:

> SnapProof turns any photo into a publicly verifiable, permanently timestamped, on-chain receipt — in three taps.

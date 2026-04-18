# SnapProof — Overview

## What it is

SnapProof is a mobile app that lets anyone timestamp a photo on the Sui blockchain. You take a picture in the app, tap "Submit", and the app records a permanent, publicly-verifiable fingerprint of that photo along with when and, optionally, roughly where it was taken. Later, anyone — a journalist, an insurance adjuster, a court — can upload the same image to the app and confirm in seconds that it existed at that moment and hasn't been modified since.

The idea is simple: the blockchain is a good place to anchor facts we want to be impossible to rewrite. A photo's fingerprint (a SHA-256 hash) is tiny, so putting it on chain is cheap. The photo itself is too big for a blockchain, so it lives on Walrus, Sui's companion decentralized storage network. Together they give you a persistent "this photo existed at this time" certificate that no single party can alter or delete.

## Why this matters

Photos are increasingly easy to fabricate, and the gap between "real" and "generated" keeps closing. At the same time, photo evidence still matters for:

- **Journalism** — datelining on-the-ground footage so edits can be detected.
- **Insurance** — proving damage predates a disputed event.
- **Field reporting** — NGOs recording human rights documentation that survives even if their devices are seized.
- **Consumer protection** — capturing a product's condition on delivery.
- **Personal memory** — a notarized diary without a notary.

SnapProof doesn't prove *what* the photo depicts is real (nothing can, purely from pixels). It proves *the bytes you're looking at now are the same bytes that existed on this date*. That's a meaningful thing to be able to prove, and it's the building block every more sophisticated "verified media" stack needs underneath it.

## How it works, in plain terms

1. **Capture.** Open the app, take a photo, and tap "Submit Proof to Sui."
2. **Fingerprint.** The app reads the image, computes its SHA-256 hash, and does the same for the photo's basic metadata (filename, size, capture time from EXIF).
3. **Upload.** The image is uploaded to Walrus, which returns a content-addressed ID.
4. **Anchor on chain.** A transaction on Sui writes a small `PhotoProof` record — the image hash, the metadata hash, the Walrus ID, the timestamp, and optionally a coarse location — under the user's address.
5. **Receipt.** You get a receipt screen with explorer links so anyone can look the proof up independently.
6. **Verify later.** From the Verify tab, anyone can select the same image, re-hash it, and the app will find the matching on-chain proof.

The whole capture-to-receipt flow is a few taps and typically a few seconds.

## Why Sui + Walrus

Sui's object model is an unusually good fit for this kind of "one object per record" data. Each proof is a single, owned, immutable record tied to a specific address — no hash tables, no smart-contract gymnastics. Move as a language is predictable and safe; we lean on that for correctness.

Walrus complements Sui by providing decentralized content storage with the same trust model. Together they eliminate the obvious counter-argument to "put it on chain" — that storing the actual data is too expensive. On SnapProof, the chain holds a few hundred bytes; Walrus holds the pixels.

## What SnapProof does and doesn't claim

**It does prove:**

- The image bytes hash to a specific value recorded on Sui at a specific time.
- The submitting address possessed those bytes at or before that time.
- The image you're verifying today matches the one that was submitted then, byte-for-byte.

**It does not prove:**

- That the photograph depicts what you think it depicts.
- That the photograph wasn't generated, edited, or composed *before* it was submitted.
- That the submitter is a specific real-world person (the app generates keypairs locally; there's no KYC).

For the MVP this line is exactly where we want it: a byte-level anchor is a composable primitive. Higher-level trust (device attestation, content authenticity, identity) can be layered on without changing the base record.

## The MVP, concretely

The current release covers four phases (all complete):

- **Scaffold** — monorepo with three workspaces (`mobile/`, `contracts/`, `backend/`).
- **Core proof flow** — capture, hash, upload, anchor, receipt.
- **Verification** — recompute and match against on-chain events.
- **Map** — optional coarse geotagging and a map of recent proofs.

Three "nice to have" items remain: case/report grouping, shareable proof links as first-class routes, and zkLogin for recoverable wallets.

## The team-facing view

- **Mobile app** — React Native / Expo with TypeScript. Five screens: home, capture, proof, verify, map.
- **Smart contracts** — One Move module, `snapproof::snapproof`, already published to Sui testnet. Holds the `PhotoProof` struct and the `create_proof` entry function.
- **Backend** — A thin Express + Sui SDK service that exposes the proofs as a REST API. It's a convenience, not a dependency — mobile talks to Sui directly for everything critical.

Every verification is checkable against the chain without involving the backend. That's deliberate: if we disappear tomorrow, existing proofs remain independently verifiable for as long as Sui and Walrus do.

## Status and next steps

The MVP is demo-ready: hackathon-grade polish, fully functional capture/verify/map loops, and live on testnet. Natural next steps beyond the MVP include:

- **zkLogin** for wallet recovery so users don't have to babysit a secret key.
- **Case objects** that group related proofs on chain.
- **Shareable web links** (`snapproof.app/v/:proofId`) so recipients don't need the app to verify.
- **Device attestation** (e.g. hardware-backed keys, platform attestation) for stronger "this really came from a real camera" claims.
- **Persistent indexer** to replace the current in-memory backend cache.

## Links

For the non-technical summary of how to see it working:

- [`DEMO.md`](./DEMO.md) — a two-minute demo script.

For technical deep-dives:

- [`../dev/ARCHITECTURE.md`](../dev/ARCHITECTURE.md)
- [`../dev/WORKFLOWS.md`](../dev/WORKFLOWS.md)
- [`../dev/DATA_MODEL.md`](../dev/DATA_MODEL.md)

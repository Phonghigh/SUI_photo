# SnapProof — Project Documentation

**Last updated:** 2026-04-19
**Status:** MVP complete (Track A shipped), Track B next

This document gives a single, end-to-end explanation of what **SnapProof** is, the problem it solves, the real-world scenarios it targets, the Sui features it uses today, the pain points that still need work, and the Sui capabilities that can close those gaps. It is intended to be the first document a judge, investor, partner, or new engineer reads after the one-paragraph README.

For code-level deep dives, see the sibling documents under [`docs/dev/`](./dev/). For the demo script, see [`docs/overview/DEMO.md`](./overview/DEMO.md).

---

## 1. What SnapProof is (90-second version)

SnapProof is a mobile app (React Native / Expo) that lets anyone take a photo and instantly anchor a **tamper-evident fingerprint** of it on the Sui blockchain, while the raw image itself is stored on **Walrus** (Sui's companion decentralized blob store). After submission, the creator receives a permanent, publicly-verifiable receipt. Anyone — a journalist, an insurance adjuster, a court clerk, a buyer — can later upload the same photo, recompute the hash locally or through the web verifier, and confirm the image existed at the block-time captured on Sui and has not been modified since.

The system is a three-tier architecture:

- A **mobile app** that owns the capture → hash → upload → anchor path end-to-end.
- A **Sui Move contract** (`snapproof::snapproof`) that stores one `PhotoProof` object per submission and emits a `ProofCreated` event.
- A **Node.js backend** and a **Next.js web verifier** that index events and render shareable public proof pages, both of which are optional conveniences — the chain and Walrus are the only sources of truth.

SnapProof deliberately draws a tight line around what it claims. It proves **byte-level integrity and existence-at-time**, attributed to the wallet that signed the transaction. It does not claim to verify the scene the photo depicts, nor to detect AI generation or re-photography. That tight scope is the product; every feature on the roadmap either makes that core claim stronger, easier to share, or easier to monetize.

---

## 2. The problem SnapProof resolves

### 2.1 The underlying problem

Photos have always been trusted unevenly: trusted when their origin is credible, suspect when it is not. Two forces in 2024–2026 have sharpened that tension:

1. **Generation and editing are near-free.** Diffusion models, in-phone editors, and re-photography attacks have collapsed the cost of producing a convincing image that depicts something that never happened.
2. **Photo evidence is still load-bearing in high-stakes workflows.** Journalism, insurance claims, legal discovery, human-rights documentation, product QA, and consumer disputes all still turn on "here is a picture of what happened." Walking away from photographic evidence is not an option for most institutions.

The gap this opens is structural: institutions still need photos, but they can no longer treat "a photo exists" as proof of anything. What's missing is a cheap, open, content-neutral **timestamping and integrity layer** that anyone can issue and anyone can verify without trusting a central custodian.

### 2.2 What SnapProof fixes (precisely)

SnapProof fixes exactly three defects in the current state of "a JPEG on someone's phone":

1. **Mutable provenance.** A raw photo has no defensible "this is when I first had it" — filesystem timestamps, EXIF, and cloud upload times can all be rewritten by the holder. SnapProof replaces that mutable claim with a Sui block timestamp, which is defensible because nobody can rewrite the chain.
2. **Silent modification.** A photo can be re-saved, re-compressed, or edited without any tamper signal. SnapProof exposes modification as a mismatch between the image's current SHA-256 and the `image_hash` recorded on chain — any alteration, even one pixel, fails verification.
3. **Unverifiable custodians.** Existing "timestamp a photo" services run on private backends; if they disappear, so do the receipts. SnapProof's receipts survive the company that built the app, because verification only requires a live Sui fullnode and a local re-hash.

### 2.3 What SnapProof does NOT try to fix

To keep the claim honest:

- It does not attempt to determine whether the photo depicts a real scene versus an AI-generated one. No pixel-only classifier can make that determination reliably, and SnapProof doesn't pretend to.
- It does not attempt to tie the signer to a real-world identity. The MVP generates a local keypair; zkLogin is on the roadmap for users who want recoverable wallets, but identity remains opt-in.
- It does not attempt to prevent a user from photographing a monitor, a printout, or an edited image. That gap is addressed by device attestation and camera-only mode (Track B), not by the hash itself.

The honesty of scope is a product, not a disclaimer — it is why regulators, lawyers, and editorial boards can actually trust SnapProof as a component in a larger verification pipeline.

---

## 3. Real-world scenarios it handles

SnapProof is content-neutral; any bytes become a proof. But four segments have the clearest economic and reputational need, and every roadmap decision is weighed against them.

### 3.1 Journalism and open-source investigations

A freelance reporter photographs the aftermath of an event, submits a SnapProof on the scene, and later publishes. Months later, when the photo is quoted in a lawsuit or a rebuttal, the outlet can show the Sui block timestamp and the matching hash. Editing accusations against the image become trivially refutable: the claimant need only produce a byte-for-byte match of the anchored hash to close the question. OSINT communities get a standardized hash they can cite in public threads, replacing brittle "I have screenshots from before the edit" arguments.

### 3.2 Insurance — delivery and damage claims

A courier photographs a package at delivery; the recipient photographs the same package on receipt. Both submissions carry chain timestamps, one before custody transfer and one after. Later claims for "damaged in transit" resolve against two independent, tamper-evident, before/after proofs — not against a single receipt the insurer has no way to audit. The insurer-facing product is a link that shows both proofs chronologically with their attestations — it is not the full app. This is the first enterprise-paid flow modeled on the roadmap (Track B6).

### 3.3 Human-rights documentation / NGO field reporting

A field documentarian captures an event with spotty connectivity. The offline outbox queues the submission; when the device rejoins a network, proofs are anchored. Devices can be seized and destroyed afterward — the proofs remain in Sui and Walrus, and anyone with the hash can still verify. The coarse geohash (precision 6, ~1.2 km cell) gives neighborhood-level location without burning the reporter's exact position. This is the highest-integrity reference user SnapProof can earn (Track B7).

### 3.4 Consumer protection and personal archive

A buyer photographs a product on unboxing; a seller photographs merchandise before shipping; a tenant photographs an apartment on move-in and move-out. In every case, the chain timestamp converts "my word against theirs" into "a third party can verify this." The personal-memory case (a notarized diary without a notary) rides on the same rails.

### 3.5 Cross-cutting scenario — cross-border evidence

All four segments share a property that blockchain solves elegantly: the verifier may be in a different jurisdiction, a different institution, or a different decade from the submitter. A chain-anchored proof does not require the verifier to trust the submitter's hosting provider, the submitter's employer, or anyone in particular. This is why the on-chain layer is not a marketing gesture — it is the reason the system works across borders and across time.

---

## 4. What Sui features SnapProof applies today

The on-chain design is intentionally narrow. Everything exotic about Sui (Move, object model, events, Walrus) is already used; everything non-essential (coins, capability patterns, dynamic fields, package upgrades as a product mechanism) is deferred. This section is a feature-by-feature account of what is in production.

### 4.1 Sui Move (edition `2024.beta`)

The entire on-chain logic lives in a single Move module, `snapproof::snapproof`, in `contracts/sources/snapproof.move`. The module contains:

- One struct, `PhotoProof`, holding `creator`, `walrus_blob_id`, `image_hash`, `metadata_hash`, `proof_hash`, `created_at`, `coarse_geo_hash`, and `case_id`.
- One entry function, `create_proof`, that allocates a UID, builds the struct, emits an event, and transfers the object to the signer.
- One event, `ProofCreated`, emitted for off-chain indexing.
- Eight read-only accessors — one per field — so external Move packages or view calls can read without knowing the struct layout.

Move is used for what Move is actually good for: a predictable, safe, auditable data-holder with explicit abilities. This is the entire business logic.

### 4.2 Owned objects and the Sui object model

`PhotoProof` has abilities `key, store`. This is the central design choice. Every submission becomes **one owned object per record**, transferred on creation to the signer's address. There are no hash tables, no dictionaries, no shared counters. The implications, each of which is load-bearing:

- **Ownership is enforced by the chain.** `creator` equals `ctx.sender()`; it cannot be forged by a third party.
- **Objects are independent units of state.** Two submissions cannot collide or block each other — Sui's parallel execution applies naturally.
- **`PhotoProof` has no `copy` and no `drop`.** A proof cannot be silently duplicated or deleted. Deletion would require publishing a later module with a destructor and moving the object into it — intentional and auditable.
- **Proofs are transferable.** A creator can hand a proof to an escrow agent or a case-collection object without rewriting anything on chain.

This is an unusually good fit between Move's object model and the data. In account-based chains, the same system would require a mapping and a counter, and every write would contend.

### 4.3 Events for off-chain discovery

`create_proof` emits a `ProofCreated` event containing just enough to locate a proof: `proof_id`, `creator`, `image_hash`, `proof_hash`, `created_at`, `coarse_geo_hash`. Off-chain indexers (the Node.js backend and the mobile `verify` screen) subscribe to `MoveEventType = "${PACKAGE_ID}::snapproof::ProofCreated"` and fetch the full object via `getObject(proof_id)` when more fields are needed.

Splitting discovery (event) from hydration (object read) is deliberate: event payloads are charged for, and keeping them lean lets the mobile app scan thousands of proofs cheaply during verification.

### 4.4 Walrus decentralized blob storage

Walrus is used via its standard HTTP surface:

- `PUT /v1/blobs?epochs=5` from the mobile app's `src/services/walrus.ts` uploads the raw image bytes and returns a content-addressed `walrusBlobId`.
- `GET /v1/blobs/:blobId` on the aggregator side serves the bytes back to verifiers, the web `/p/[objectId]` page, and the mobile map thumbnails.

Only the Walrus blob ID goes on chain. This is what makes the per-proof on-chain cost constant regardless of image size, and what lets the same trust model apply to data of any size. Walrus's content-addressing also means duplicate uploads produce the same ID — uploading the same photo twice is idempotent and cheap.

### 4.5 Transactions, gas, and the Sui TypeScript SDK

The mobile app speaks Sui directly using `@mysten/sui` (fullnode RPC + transaction builder). The write path constructs a `Transaction` with a single `moveCall` to `snapproof::create_proof(...)`, signs with the local Ed25519 keypair, and submits. The effects' first created object ID becomes the proof's on-chain ID; the transaction digest becomes the receipt's canonical URL.

The app has a faucet integration (`POST https://faucet.testnet.sui.io/v1/gas`) so first-time users can pay gas without leaving the capture flow. On mainnet this is replaced by sponsored transactions per segment (B6 insurance) or by zkLogin-funded wallets (B1).

### 4.6 Sui's block timestamps as the defensible clock

One subtle but important point: the `created_at` field on `PhotoProof` is **client-supplied**. Any attacker can set it to any `u64`. The claim that actually defends in an adversarial setting is not `created_at` — it is the **block timestamp of the creating transaction**. That value is a property of Sui consensus, not of the signer. The web verifier and the roadmap repeatedly prefer the block timestamp over the client value. This is why anchoring on a fast, globally-consistent chain matters: it substitutes a trustable clock for an untrustable one.

### 4.7 Package publication and the upgrade capability

The contract is published to Sui testnet at package `0x8cb3e3d082971bde081c3af6b794fa3748cc454985cdc98140c20892a5cd3321`. The publish returned an upgrade capability, recorded in `contracts/Published.toml`, which would be needed to preserve the package ID across a future `sui client upgrade`. The MVP does not use the upgrade path yet; the capability is held by the developer who ran `sui client publish` and is part of the project's disaster-recovery plan.

### 4.8 Explorer integration (SuiScan)

Every proof's receipt and every web verifier page links to canonical explorer URLs:

- `https://suiscan.xyz/testnet/tx/<digest>` — the creating transaction (defensible timestamp lives here).
- `https://suiscan.xyz/testnet/object/<objectId>` — the `PhotoProof` object, readable by anyone.

Because both links are resolvable without SnapProof's backend or app, the system would survive losing every off-chain component.

---

## 5. Pain points and what still needs enhancement

Track A is shipped. Track B is next. The honest list of what SnapProof does not yet do — organized by the category of pain the user or operator actually feels.

### 5.1 Identity and key management

- **Lost keypair = lost ownership.** Today the mobile app generates an Ed25519 keypair on first launch and stores it in secure storage. If the device is wiped or lost, the wallet — and the authority to create future proofs on behalf of that creator address — is gone.
- **No social recovery.** There is no backup mnemonic UX and no account abstraction layer on top of the keypair.
- **No real-world identity.** An investigator or insurer cannot tell a staff reporter's proofs apart from a bot's; `creator` is an opaque address.

### 5.2 Provenance strength

- **No cryptographic binding to the actual camera sensor.** Camera-only mode (A2) closes the "pick from library" hole but does not bind the bytes to a specific attested device. A sophisticated attacker can still hook the capture path.
- **No C2PA interop.** Platforms increasingly embed signed capture manifests; SnapProof neither emits nor consumes them yet.

### 5.3 Storage lifetime

- **Walrus blobs expire.** Today epochs are fixed at 5 per upload. The on-chain hash is permanent, but the image itself will vanish after its storage window. Verifications that arrive late see "match hash but no bytes" unless the user supplies their own copy.
- **No tiered storage.** There is no Free/Pro/Team differentiation on blob lifetime, and no scheduled re-certification job.

### 5.4 Data model expressiveness

- **`case_id` is just a string.** Related proofs cannot be grouped on chain; there is no `Case` object that collects many `PhotoProof` IDs.
- **No shared case workflows.** Two parties cannot submit to a shared case under enforced permissions; everything is solo authorship.
- **Metadata is minimal.** The metadata hash covers `{timestamp, fileSize, fileName}` only. Richer provenance (capture app version, device model, camera attestation token) has no home yet.

### 5.5 Distribution and verification

- **Verify share rate is unknown.** The web verifier exists (A1) and analytics are wired (A5), but the value-compounding metric — how often proofs are actually opened by non-creators — is not yet at target.
- **No embeddable verifier.** Editors and partners cannot drop a one-liner into their CMS yet.
- **No mainnet.** Testnet is fine for demos; it is not defensible against the claim "but this is a toy network."

### 5.6 Economics and unit pricing

- **No paid tiers.** There is nothing to sell yet. "Who pays for blob epochs in year 3?" has no answer.
- **No sponsored transactions.** Enterprise flows (B6 insurance couriers) need the insurer to pay gas without asking couriers to hold SUI.
- **No gas-abstracted web flow.** Web-only verifiers and submitters can't currently transact without a wallet extension.

### 5.7 Operational maturity

- **No persistent indexer in production.** A Postgres-backed optional indexer is available (A6) but not yet the default, meaning event scans at high depth can be slow on public fullnodes.
- **No disaster-recovery runbook.** The upgrade capability exists; the procedure to use it does not live beside it.
- **No SLA story for third parties.** The backend's rate limiting and metrics (A6) are in place, but no external API contract has been published.

---

## 6. Sui features that can resolve these pain points

The reason SnapProof sits on Sui specifically — not on some other chain — is that almost every pain point in §5 has a named feature in the Sui ecosystem that addresses it. This section pairs each pain with the feature and the concrete integration path.

### 6.1 zkLogin → recoverable identity without seed phrases

Sui's **zkLogin** lets users derive a Sui address from an OIDC login (Google, Apple, Facebook, Twitch, etc.) using a zero-knowledge proof that does not expose the OIDC subject on chain. For SnapProof, zkLogin turns the keypair problem inside out: the signer is derived from an account the user already has and already recovers through that provider's standard flow.

Applied to the pain points in §5.1:

- **Lost-device recovery** becomes "log in with the same Google account on the new phone." The wallet is reproducible.
- **No-seed-phrase onboarding** cuts time-to-first-proof materially; this is the target metric for the MVP (TTFP < 60 s).
- **Soft identity for regulated segments.** The OIDC provider's sub acts as a weak identity anchor; group entitlements for NGOs (Track B7) can be modeled against verified domains.

Because zkLogin signatures are ordinary Sui signatures downstream, the existing `create_proof` entry function requires **no contract changes**. Integration is mobile-side: swap the local Ed25519 keypair for a zkLogin-derived address and signer. This is the single most strategic Track B item and is the reason it is next on the roadmap.

### 6.2 Sponsored transactions → enterprise gas abstraction

Sui supports **sponsored transactions** (gas payer different from sender). For SnapProof this unlocks two things:

- **Insurance flows (B6).** The insurer pays gas; the courier or customer never touches SUI. The shipment QR opens a sponsored web submit; the end user experiences it as "open link, take photo, done."
- **Web verifier submit path.** The public web app can expose a submit button without requiring a wallet extension, collapsing adoption friction at the verifier boundary.

The contract does not change. Mobile and web add a sponsored signing step; backend exposes a signer that co-signs the gas object.

### 6.3 Package upgrades → safe schema evolution

Sui's **`sui client upgrade`** preserves the package ID across a new version if the upgrade capability is presented. For SnapProof this is the non-negotiable path to evolve `PhotoProof`:

- Add `device_attestation: String` for App Attest / Play Integrity tokens (B2).
- Add `attestation_kind: u8` to discriminate attestation sources.
- Add optional fields (e.g. a pointer to a `Case`) without invalidating historical data.

Because the chain records are immutable, this path matters. The upgrade capability stored in `Published.toml` is the exact primitive that makes this safe.

### 6.4 Shared objects → collaborative `Case` workflows

The current `case_id` is just a string. Sui's **shared objects** let multiple independent signers transact against the same object, with consensus ordering resolved by the chain. A `Case` in SnapProof becomes:

```move
public struct Case has key {
    id: UID,
    owner: address,
    title: String,
    proof_ids: vector<ID>,
    contributors: VecSet<address>,
}
```

Declared shared with `transfer::share_object`, the Case can accept `add_proof` calls from any whitelisted contributor. This gives us the B6 delivery/recipient dual-proof flow natively (both sides submit into the same shared Case) and the B7 NGO bulk-report flow natively (co-reporters contribute into a single case). It also resolves the "no group workflow" pain in §5.4 without changing any existing proof semantics.

### 6.5 Walrus epoch renewal → paid tiers as a storage product

Walrus's blob lifetime is a per-upload `epochs` parameter. Resolving the §5.3 pain means owning that parameter product-side:

- Pass the tier's `epochs` value at upload (Free = 5, Pro = 25, Team = ∞-ish subject to Walrus economics).
- Add a scheduled job that reads `ProofCreated` events for paid users and re-certifies their blobs before the epoch window closes.
- On the verifier, when the blob is gone, display "Bytes no longer available; hash still valid — supply your own file to complete verification." This turns a silent failure into a product tier boundary.

This is the cleanest path from "interesting hackathon" to "subscription with measurable value" and is modeled as Track B5.

### 6.6 Move abilities and custom types → richer, safer proofs

Several of the weaker parts of the current schema can be tightened by using Move's type system more deliberately:

- Replace stringly-typed hash fields with a `Hash256` newtype (a single-field struct wrapping a `vector<u8>`). Off-chain clients still format as hex, but explorers and downstream Move modules get type safety. This is a forward-compatible upgrade delivered via the upgrade capability.
- Introduce a `DeviceAttestation` struct (kind, token, issued_at) for B2.
- Use `VecSet` and `VecMap` to store contributors and role assignments on shared `Case` objects.

Move's abilities (`key, store, copy, drop`) are already doing the right thing on `PhotoProof`: it can be stored inside other objects (hence `store`), can be held as a root object (hence `key`), and cannot be duplicated or silently destroyed. Keeping this posture as the schema grows is how we avoid the subtle bugs that afflict less strict languages.

### 6.7 Programmable Transaction Blocks → atomic batched proofs

Sui's **Programmable Transaction Blocks (PTBs)** let a single transaction chain many moveCalls with shared intermediate values. For SnapProof that unlocks:

- **Atomic Case + proofs**: create a `Case`, create N `PhotoProof`s, add them to the case, all in one block.
- **Batched journalism uploads**: a photographer submits 10 proofs from one event in a single signed transaction, all with the same block timestamp.

This is a pure client-side optimization; no contract changes are required.

### 6.8 Event subscription and indexers → trustworthy verification at scale

The backend already has an optional Postgres indexer that polls `ProofCreated` events. Moving to **subscription-based event consumption** (`subscribeEvent`) and offering the indexer as a **read-replica API** is the path from "MVP backend" to "public API third parties integrate against." Sui's event model is uniform enough that an eventual **open indexer protocol** (C6 on the roadmap) could let SnapProof serve its own data and be served by others, reducing its own single-point-of-failure.

### 6.9 Native ZK primitives → privacy-preserving proofs

For the NGO segment (B7), some metadata is sensitive even in coarse form. Sui's growing support for **zk-friendly primitives** (zkLogin today, future zkSNARK-verification functions) is a natural home for:

- Proving "the reporter belongs to a credentialed set" without revealing which reporter.
- Proving "the proof was created within a date window" without revealing the exact timestamp.

This is not short-term work, but it is the long-term reason privacy-sensitive segments eventually consolidate on a chain that takes ZK seriously at the protocol level rather than bolting it on.

### 6.10 Mainnet and the ecosystem tooling

Finally, the mundane-but-material point: SnapProof runs on Sui testnet today. Moving to **Sui mainnet** (Track B4 on the roadmap) is not a Sui "feature" in the sense of a new primitive — it is the unlock for every feature above to actually be commercially meaningful. Mainnet brings SuiScan indexing, the production faucet equivalent via purchased SUI, durable block history that the insurance and legal segments will accept, and — with zkLogin, sponsored transactions, and shared objects already live on mainnet — the full feature surface SnapProof's roadmap depends on.

---

## 7. How the pain points and Sui features line up

A compact crosswalk so the argument from §5 to §6 is visible at a glance.

| Pain point (§5) | Sui feature that resolves it (§6) | Roadmap item |
|-----------------|------------------------------------|--------------|
| Lost keypair = lost wallet | zkLogin (§6.1) | B1 |
| No real-world identity anchor | zkLogin OIDC linkage (§6.1) | B1, C4 |
| No enterprise gas abstraction | Sponsored transactions (§6.2) | B4, B6 |
| Schema can't evolve safely | Package upgrades (§6.3) | continuous |
| No collaborative case workflow | Shared objects (§6.4) | B3, B6, B7 |
| Walrus blobs expire silently | Epoch-aware uploads + renewal job (§6.5) | B5 |
| No device-level provenance | New struct via upgrade (§6.3) + app-side App Attest / Play Integrity (§6.6) | B2 |
| Weak typing on hashes/IDs | Move newtypes delivered via upgrade (§6.6) | incremental |
| No atomic multi-proof submits | Programmable Transaction Blocks (§6.7) | client change |
| Fullnode polling is slow at depth | `subscribeEvent` + open indexer (§6.8) | A6 (done), C6 |
| Privacy-sensitive metadata leaks | zkLogin, future zk primitives (§6.9) | B7, long-term |
| Not defensible on a test network | Mainnet (§6.10) | B4 |

---

## 8. Reading guide (where to go next)

- **Product and demo track.** [`overview/OVERVIEW.md`](./overview/OVERVIEW.md), then [`overview/DEMO.md`](./overview/DEMO.md).
- **System architecture.** [`dev/ARCHITECTURE.md`](./dev/ARCHITECTURE.md) for the three-tier diagram and data flows.
- **On-chain schema.** [`dev/CONTRACTS.md`](./dev/CONTRACTS.md) and [`dev/DATA_MODEL.md`](./dev/DATA_MODEL.md).
- **HTTP integration.** [`dev/API.md`](./dev/API.md).
- **Prioritized enhancements and mini-PRDs.** [`dev/ROADMAP.md`](./dev/ROADMAP.md).
- **Per-workspace deep dives.** [`dev/MOBILE.md`](./dev/MOBILE.md), [`dev/WEB.md`](./dev/WEB.md), [`dev/BACKEND.md`](./dev/BACKEND.md).
- **Change log.** [`../CHANGELOG.md`](../CHANGELOG.md).

The shortest path for a new reader is: this document → `dev/ARCHITECTURE.md` → `dev/ROADMAP.md`. After those three, every other file is an elaboration of something named in one of them.

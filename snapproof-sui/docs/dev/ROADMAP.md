# SnapProof — Product Roadmap

A prioritized set of enhancements to take SnapProof from hackathon MVP to a real product. Each section is a mini-PRD: **Problem**, **Proposed solution**, **Why it matters**, **Success metric**, **Effort**, **Risks / open questions**.

Covers four tracks in parallel: **product & UX**, **trust & authenticity**, **business & go-to-market**, and **technical robustness**.

## Product thesis (one-paragraph)

The MVP answers "can I prove this photo existed at this time?" Every enhancement below is in service of one of three compounding questions: **(1)** can I make that claim *stronger* (better provenance, less spoofable, device-attested), **(2)** can I make it *easier to create and share* (one tap, shareable link, no wallet for verifiers), and **(3)** can I make it *worth paying for* (pick a segment where the proof is load-bearing and build for it). We should resist the temptation to grow horizontally before the proof itself carries more weight — every dollar of trust added to the core claim is worth more than a dozen new side features.

## Success metrics we're optimizing for

These are the numbers we should be able to answer about the product in six months:

- **Time-to-first-proof (TTFP)** from app open: target < 60 seconds including faucet/fund step.
- **Verify share rate**: % of proofs whose shareable link is opened by at least one non-creator in 30 days. Target: 25%+ (a proof nobody verifies is nearly useless).
- **Proof integrity rate**: % of verifications that resolve to "verified" rather than "not found" or "mismatch". Measures cache miss and data-loss scenarios. Target: 99.5%+.
- **Repeat creator rate**: % of wallets that create a second proof within 30 days. Tells us the product got used for something real, not just a demo. Target: 35%+.
- **Gas-funded conversion** (once on mainnet): % of users who successfully fund their wallet and submit. Target: 70%+.

Every PRD below should tie back to one of these metrics or to a named risk reduction.

---

# Track A — Now (2–4 weeks of focused work)

Quick wins. Each assumes one developer and existing infrastructure.

## A1 — Shareable proof links + web-based verifier (Recommended first ship)

**Problem.** A proof is only valuable if someone else can verify it. Right now verification requires installing the Expo app and rehashing the original image locally. Sharing a receipt produces a block of text nobody outside crypto understands.

**Proposed solution.** Build a minimal Next.js (or plain-HTML) site at, say, `verify.snapproof.app/p/:objectId`. Given an object ID it:

1. Reads the `PhotoProof` via `@mysten/sui`.
2. Pulls the image from Walrus.
3. Rehashes the bytes in the browser and compares against `image_hash`.
4. Renders a clean, social-preview-friendly page with the photo, the creator address (truncated), the creation date, the block timestamp (defensible source), and explorer links.
5. Also accepts `?hash=<image-hash>` for lookups when only the hash is known.

Mobile receipt adds a "Copy link" button next to Share.

**Why it matters.** Turns every proof into a pieceable, embeddable social asset. Creators' existing distribution (Twitter, journalism sites, insurance claim emails) now carries our verification by default. No app install needed on the recipient side.

**Success metric.** Verify share rate ≥ 25% within 30 days of launch.

**Effort.** Small (1–2 weeks).

**Risks.**
- Image byte-reloading from Walrus can hit rate limits — mitigate with a tiny caching Worker.
- Social preview (OG image) should render the image *or* a branded card; CDN the OG image generation.

---

## A2 — Camera-only, live hash preview

**Problem.** Today, users can pick an image from the library. This weakens the provenance claim ("the user had the image before they submitted it"). It also means the app can be fed arbitrary bytes — EXIF date doesn't help, any file can be backdated.

**Proposed solution.**

1. Add a setting **"Camera-only mode"** (on by default in v1.1). When on, the library picker is disabled and only `expo-camera` capture flows through.
2. On the capture screen, show a **live preview of the image hash as soon as the capture completes**. It's computed anyway; exposing it reassures the user nothing is being mutated before upload.
3. Display the capture-time system clock and a small warning if the device clock is off by more than 2 minutes relative to a network time server.

**Why it matters.** Strengthens the single most spoofable surface (submitter's intent). Camera-only closes the "grab any file and timestamp it" loophole. Users who need the library path can still toggle it off; the default posture matters.

**Success metric.** Reduce "NOT FOUND" rate in verify by reducing repeat-submissions of edited versions. Hard to measure directly; track by polling users who successfully verify vs. not.

**Effort.** Small (few days).

**Risks.** Some users have legitimate needs to timestamp an existing file (forensic batch-ups). The setting is opt-out, not a hard wall.

---

## A3 — Onboarding that calibrates trust

**Problem.** First-time users don't know what SnapProof claims and what it doesn't. A naive user might think it "proves the photo is real." Under-promising here protects us legally and reputationally — and under-promising is *more* trustworthy than over-promising.

**Proposed solution.** Three-screen first-launch walkthrough:

1. **"SnapProof gives your photo a receipt."** Short explainer + one-line on integrity.
2. **"Here's what it proves and what it doesn't."** Two bullet lists, honest. Include one sentence on AI generation being out of scope.
3. **"Your wallet is on this device."** One paragraph on local keypair storage, no password, tap to back up the seed (writes a deterministic mnemonic using `bip39`) to the system password manager.

Add a persistent **Info (i)** icon on Capture and Verify that resurfaces the same content.

**Why it matters.** Sets the product's moral perimeter, reduces support load, gives us a clean answer for any "isn't this misleading?" review.

**Success metric.** Qualitative: support emails / app store reviews asking "does this prove the photo isn't AI?" drop to <5%.

**Effort.** Small (2–3 days of copy + UI).

**Risks.** None meaningful. Make it skippable but re-accessible.

---

## A4 — Offline submission queue

**Problem.** Photojournalists in the field, hikers, travelers, and NGOs often capture when online is spotty. Right now a failed upload loses progress; the user has to manually retry.

**Proposed solution.**

1. Persist pending submissions locally (hash, blob upload buffer, intended metadata).
2. On connectivity, auto-retry in FIFO order.
3. Show a small **Outbox** badge on the Home screen with the count.
4. Let users open the Outbox, reorder, cancel, or copy the pending hash.

Implementation: `@react-native-community/netinfo` for connectivity, `expo-sqlite` for durable queue, background fetch on iOS via `expo-background-fetch`.

**Why it matters.** Unlocks the most defensible use cases (field reporting). Converts a moment-of-panic UX into a "submit and forget."

**Success metric.** Measured via pending queue drain time; target < 5 min p50 on a connected device after reconnect.

**Effort.** Small to medium (1 week).

**Risks.** Background tasks on iOS are rate-limited by the OS. Be explicit in UI that "delivery happens when possible," not guaranteed immediately.

---

## A5 — Technical: add crash reporting & analytics

**Problem.** We're going to ship faster than we can manually QA. Without telemetry we're flying blind.

**Proposed solution.** Wire up `sentry-expo` (or equivalent) for the mobile app and `@sentry/node` for the backend. Add a lightweight event tracker (PostHog or plain amplitude-like events) with explicit opt-in (**default on**, prominent toggle in Settings). Track:

- `proof_submit_started`, `proof_submit_succeeded`, `proof_submit_failed{stage}`
- `verify_started`, `verify_result{match|mismatch|not_found}`
- `wallet_funded`, `faucet_requested`
- `share_tapped`, `verify_link_opened`

**Why it matters.** Lets us measure every target metric above. Without it, "Recommended first ship" is guesswork.

**Success metric.** Analytics dashboards cover all five success metrics by end of week 4.

**Effort.** Small (2–3 days + dashboards).

**Risks.** Privacy-sensitive users will want a hard opt-out. Honor it and document it in the onboarding trust screen (A3).

---

## A6 — Technical: tighten the backend

**Problem.** Current backend has no auth, no rate limiting, no persistence, no monitoring. Fine for demo, not for "running at 3am."

**Proposed solution.**

1. Add `express-rate-limit` on `POST` endpoints.
2. Replace the in-memory cache with a Postgres-backed indexer (`@mysten/sui` `subscribeEvent` → Postgres).
3. Standardize error envelope to RFC 7807 (`application/problem+json`).
4. Add `/api/metrics` (Prometheus) and a liveness+readiness probe distinction.
5. Add pagination + cursor semantics on `GET /api/proofs`.

**Why it matters.** Ready the backend for a public HTTP surface behind the web verifier (A1).

**Success metric.** 99.9% `/api/proofs/verify` uptime, p99 < 500 ms over seven days.

**Effort.** Medium (1.5 weeks).

**Risks.** Scope creep. Keep it boring: Postgres, a single Worker, no Kafka.

---

# Track B — Next (1–3 months)

These are the ones that change what the product *is*, not just how it works.

## B1 — zkLogin wallet with recovery

**Problem.** A local Ed25519 keypair on a single device is a UX deal-breaker for non-crypto users. Lose the phone, lose every proof you created (you can still verify, but you can't manage or transfer proofs). For any "serious" use case this fails.

**Proposed solution.** Integrate **zkLogin** so users sign in with Apple, Google, or email OTP. Each login derives a Sui address deterministically from the OIDC identity. Existing proofs stay on the ephemeral address; offer a one-time "migrate my proofs" transfer flow for users who had a local keypair.

Implementation references: `@mysten/zklogin`, Sui's OAuth proving service, the `sui::zklogin` framework docs.

**Why it matters.** Removes the single biggest objection to the product. Converts "local key toy" into "a login you already use." Enables account portability.

**Success metric.** 70%+ of new users choose a social login over "generate local key" when both are offered in onboarding (A3).

**Effort.** Medium (3–4 weeks).

**Risks.**
- zkLogin proof generation on slow devices can take 5–10s. Show a dedicated loading state.
- OIDC providers can deprecate flows. Keep local keys as a supported escape hatch.

---

## B2 — Camera-native provenance + hardware attestation (Recommended differentiator)

**Problem.** Even with camera-only mode (A2), there's no cryptographic binding between "the phone's real camera sensor" and "the bytes we hashed." A sophisticated adversary can hook the picker API.

**Proposed solution.** Layered defense — ship what's feasible at each tier.

1. **iOS `DeviceCheck` + Apple App Attest.** On submit, the app asks for an App Attest assertion over `(proof_hash, nonce)`. Stored in the proof as an optional `device_attestation` string.
2. **Android Play Integrity API.** Same idea, `integrity.requestIntegrityToken(nonce=proof_hash)`.
3. (Future) **C2PA manifest** on capture: when the platform supports signed capture (iOS 18+ Content Credentials), read and include the manifest hash.
4. On the verifier (A1), surface the attestation result with clear iconography: **Device-attested ✓**, **App-attested ✓**, **Unattested (user import)**.

**Why it matters.** Moves SnapProof from "hash of whatever bytes the app saw" to "hash of bytes a real app on a real Apple/Google-attested device saw." This is the provenance story that legal / insurance / journalism need.

**Success metric.** % of proofs with at least one attestation token: target 85%+ three months after shipping.

**Effort.** Medium (4–6 weeks — each platform is ~2 weeks).

**Risks.**
- Rooted/jailbroken devices fail attestation; we must still accept the proof but flag it clearly.
- App Attest limits: Apple quotas assertions at 100/day per app per device initially. Mitigate with server-side attestation caching.

---

## B3 — Cases: group related proofs into a first-class object

**Problem.** A single proof is usually meaningless in isolation. An insurance claim is a story — delivery photo + unpacking photo + damage photo, timestamped minutes apart. A human-rights investigation is dozens of photos over days. Today there's just a free-form `case_id` string.

**Proposed solution.** New Move struct:

```move
public struct Case has key, store {
    id: UID,
    creator: address,
    title: String,
    description: String,
    created_at: u64,
    proof_ids: vector<ID>,
}

public fun create_case(title, description, ctx) -> Case
public fun add_proof(case: &mut Case, proof_id: ID, ctx)
```

In the app, add a **Cases** tab, a case-picker on the Capture screen, and a case view that chronologically lists the member proofs with a shared timeline.

**Why it matters.** Unlocks every narrative use case (insurance, journalism, field reports, creative projects). Makes the product feel like a tool, not a one-shot utility.

**Success metric.** % of proofs created inside a case: target 40%+ six months after shipping. Avg proofs per case ≥ 3.

**Effort.** Medium (3 weeks).

**Risks.** Mutation of the `vector<ID>` increases gas cost. Cap cases at a reasonable size (say 500 proofs) or shard.

---

## B4 — Mainnet launch with pay-per-proof

**Problem.** Testnet is free but the proofs are not credibly durable. Mainnet carries real weight but users need to fund a wallet with real SUI.

**Proposed solution.**

1. Dual-deploy the contract to mainnet. Add a `SUI_NETWORK` toggle in settings; default to mainnet after B1.
2. **Sponsored transactions.** Backend signs and pays gas on behalf of the user, charging them via Stripe (or allowing a free quota on zkLogin sign-in). `@mysten/sui` supports sponsored tx natively.
3. Introduce tier pricing:
   - **Free:** 10 proofs/month per authenticated user.
   - **Pro (\$5/mo):** unlimited proofs, priority Walrus epochs (≥25 epochs), case support.
   - **Team (\$25/user/mo):** shared cases, workflow integrations, CSV export.

**Why it matters.** Converts the project from an open-source demo to a business. Gives us the revenue to keep Walrus blobs paid-for and the backend humming.

**Success metric.** First paying user within 30 days of launch. 50 paying users within 90 days.

**Effort.** Medium (4 weeks including Stripe + sponsored tx infra).

**Risks.**
- Key management for the sponsor wallet is the security bottleneck. Use a dedicated hot wallet funded daily from cold storage, with monitoring on outflow.
- Payment compliance: Stripe for cards avoids most of the mess; don't take crypto in exchange for proofs unless you want to wear the exchange hat.

---

## B5 — Proof expiration / renewal (Walrus lifetime management)

**Problem.** Blobs on Walrus live for a fixed number of epochs (today we set `epochs=5`). After that the image vanishes even though the hash is permanent. A verifier two years later will see "match hash" but no image.

**Proposed solution.**

1. Expose `epochs` as a tier benefit (Free=5, Pro=25, Team=∞-ish).
2. A scheduled job re-certifies blobs before expiry for paid users.
3. On the verifier (A1), if the blob 404s but the hash still matches a Sui event, display "Bytes no longer available, hash still valid — provide your own file to complete verification."

**Why it matters.** Converts a silent failure mode into a clear product tier.

**Success metric.** 0 "silent blob expired" verify failures for paid users.

**Effort.** Small-medium (1.5 weeks).

**Risks.** Walrus mainnet pricing may shift. Keep the renewal job configurable.

---

## B6 — Segment play #1: **Insurance delivery & damage proofs**

**Problem.** Insurance claims for damaged-in-transit goods turn into he-said/she-said. The claimant's timestamped photo is the load-bearing evidence; insurers mistrust it for good reason (photos can be pre-staged).

**Proposed solution.** Productize a **"Delivery Proof"** flow:

1. Delivery courier scans a QR on the package → opens SnapProof (web app — they aren't installing for one job).
2. Web flow captures photo via `navigator.mediaDevices.getUserMedia`, hashes, uploads to Walrus, anchors on Sui via a **courier-side sponsored wallet** keyed to the shipment.
3. Receipient scans a different QR, photographs the condition, creates their own linked proof in the same Case.
4. If either side files a claim, the insurer gets a single link showing both proofs in chronological order with device attestations.

Partner with one mid-size regional carrier for a pilot. Charge per-shipment, not per-user.

**Why it matters.** Finds a willing-to-pay segment where proof is load-bearing and volume is high.

**Success metric.** 10k shipments in pilot quarter. ROI for the carrier = reduction in claim dispute time (self-report and track).

**Effort.** Large (8+ weeks including sales cycle).

**Risks.** Long sales cycle for a pre-launch product. Shortcut: start with SMB carriers and D2C brands (they move faster).

---

## B7 — Segment play #2: **Field reporters / NGO** toolkit

**Problem.** Press-freedom orgs and human-rights NGOs already document events; their workflow is fragmented (SecureDrop, Bellingcat toolkits, plain cameras). No single product gives them tamper-evident timestamping without needing a sysadmin.

**Proposed solution.** A **Field Mode** package:

1. Offline-first (see A4) with large queue (200+ proofs).
2. Case-based organization (see B3) with encrypted case metadata (title/description encrypted, hashes still public).
3. Bulk export to SecureDrop / Signal / USB attached evidence dump.
4. Distribution via press-freedom orgs' existing training / partnerships.
5. Free for verified NGO accounts via zkLogin group entitlement.

**Why it matters.** High-integrity reference users. Their endorsement is more valuable than 100 consumers'.

**Success metric.** 3 NGO partners onboarded in year 1; 1 cited published investigation using SnapProof.

**Effort.** Large — but most of the work is distribution, not code. Partners drive the requirements list.

**Risks.** Threat model is serious. If we market to activists, we must not be a single point of compromise. Code review from external security researchers is non-negotiable before this goes live.

---

# Track C — Later (3–12 months; strategic)

Bigger, riskier bets. Each should be validated by users / data from Tracks A and B before we commit.

## C1 — Video / short-clip proofs

**Problem.** A still photo proves less than a 5-second clip with audio. For journalism and insurance both, motion is far more defensible.

**Proposed solution.** Hash the entire MP4/H.264 stream on device (same flow as images), upload to Walrus (larger blobs, longer epochs), and store an additional `frame_hashes: vector<String>` (Merkle root of per-frame hashes) so you can later prove a *specific frame* is part of the original clip without downloading the whole file.

**Effort.** Large. Walrus cost goes up ~200–500× per proof.

**Risk.** Mobile hashing of a ~50 MB clip is slow and eats battery. Needs native modules for streaming SHA-256.

---

## C2 — Revocation & dispute channels

**Problem.** The chain is immutable. But disputed proofs (incorrect attribution, unauthorized upload of private imagery, legal takedowns) need *some* signal of "this is contested," without rewriting history.

**Proposed solution.** A **DisputeObject** on chain that references a `PhotoProof` by ID and is owned by a trusted multisig ("SnapProof Ethics Committee" or a DAO). The verifier surfaces "⚠ disputed — see reason" next to any proof referenced by a DisputeObject, with a link to the filed reason. The proof itself is never deleted.

**Effort.** Medium. Governance is the hard part.

**Risk.** This is a political object. We must publish clear policy *before* taking first dispute. Otherwise it becomes a tool for abuse.

---

## C3 — SDK and embed partners

**Problem.** News CMSs, Shopify, insurance portals, lab notebooks — none of them are ever installing our app. They'd happily embed a snippet if we handed them one.

**Proposed solution.** Two deliverables:

1. **`@snapproof/verify` JS library.** Takes an image file or URL, returns `{ verified, proof, creator, createdAt }`. Pure client-side, no backend dependency.
2. **`<snapproof-badge>` web component.** Drop-in for any CMS — renders the "Verified on SnapProof" seal with on-hover details and a click-through to the proof page (A1). 50 kB total.

**Effort.** Small-medium (3 weeks) once A1 and A6 exist.

**Metric.** Track `snapproof-badge` loads from non-owned domains.

---

## C4 — Creator identity layer (opt-in)

**Problem.** Anonymous proofs are fine for many use cases but useless for journalist bylines or influencer endorsements. Today the only identity is a 32-byte address.

**Proposed solution.** Let creators optionally link a verified identity (domain-based via well-known file, Keybase-style PGP, X account via OAuth + signed tweet). Store the association off-chain in our indexer (not on chain — identity claims can change). The verifier renders "Proof by @jane.com (verified via DNS TXT)" instead of `0xabc1...def`.

**Effort.** Medium. Small attack surface if we stick to DNS + OAuth.

**Risk.** Identity is UX quicksand. Ship the humblest version first — one domain claim, one verification method.

---

## C5 — The "verified media" open protocol play

**Problem.** Competing products (C2PA / Content Credentials, Numbers Protocol, Project Origin) each solve slices of the authenticity problem. A walled-garden SnapProof that doesn't talk to them won't win.

**Proposed solution.** Make SnapProof a **proof anchoring** layer that can ingest and emit C2PA manifests. On capture, if a C2PA manifest is present (from a supported camera / editing tool), include its hash in the proof. On verify, if the image has a C2PA manifest and an on-chain SnapProof, render both signals together.

**Effort.** Large. Also requires political work (joining C2PA as a participant).

**Metric.** Number of external tools that emit C2PA manifests readable by our verifier.

---

## C6 — Verifier protocol + incentives for independent indexers

**Problem.** Our backend indexer is a single point of convenience. If it goes down, the mobile and web verifiers fall back to direct Sui RPC — which works, but is slow and hard to paginate.

**Proposed solution.** Publish a minimal **indexer spec** (event format, endpoints we expect), open-source a reference implementation, and offer bounties / Walrus storage credits for third parties running compliant indexers. The mobile and web clients accept a list of indexer URLs and fan out.

**Effort.** Medium (spec + reference). Ongoing to maintain.

**Risk.** If nobody runs a third-party indexer, we just maintain our own. Not a downside, just a fallback.

---

# Non-goals (explicit cuts)

Things *not* to build, at least through year 1:

- **Deepfake detection classifiers.** We'd be taking a position on content authenticity that the underlying tech cannot defend. Out of scope.
- **On-chain identity / KYC.** Push to opt-in identity (C4) — never mandated.
- **Own chain / fork.** We benefit from Sui and Walrus. Forking either is a massive cost for no product gain.
- **Rich editor / filters / social feed.** Not our product.
- **Decentralized moderation DAO.** Interesting topic, wrong season.
- **Wholesale integration of every C2PA feature.** Pick one hand-off (manifest round-trip) and do it well (C5).

# Prioritization matrix

| Rank | Item | Pay-off | Effort | Confidence |
|------|------|---------|--------|------------|
| 1 | A1 — Shareable link + web verifier | High | Small | High |
| 2 | A3 — Trust-calibrating onboarding | Medium | Small | High |
| 3 | A2 — Camera-only + live hash | Medium | Small | High |
| 4 | A5 — Analytics & crash reporting | Medium | Small | High |
| 5 | A6 — Backend tightening | Medium | Medium | High |
| 6 | A4 — Offline queue | Medium | Small-Med | Medium |
| 7 | B1 — zkLogin | High | Medium | High |
| 8 | B2 — Device attestation | High | Medium | Medium |
| 9 | B3 — Cases | High | Medium | High |
| 10 | B4 — Mainnet + paid tiers | Blocker-for-revenue | Medium | Medium |
| 11 | B5 — Blob lifetime mgmt | Medium | Small-Med | High |
| 12 | B6 — Insurance segment pilot | Very high | Large | Low |
| 13 | B7 — Journalism / NGO pilot | Very high (brand) | Large | Low |
| 14 | C1 — Video proofs | High | Large | Medium |
| 15 | C2 — Dispute channel | Medium | Medium | Low |
| 16 | C3 — SDK / embed | High (viral) | Small-Med | High |
| 17 | C4 — Identity layer | Medium | Medium | Medium |
| 18 | C5 — C2PA interop | Medium | Large | Medium |
| 19 | C6 — Indexer protocol | Low-Medium | Medium | Medium |

# Suggested sequencing

**Weeks 1–2.** A5, A3, A2.
**Weeks 2–4.** A1, A6.
**Weeks 4–6.** A4. Start B1.
**Weeks 6–10.** B1 ships. B3 starts. A-track polish.
**Weeks 10–14.** B2 ships. B3 ships. B5 in design.
**Weeks 14–20.** B4 ships (mainnet + pricing). B6 pilot sales begin.
**Weeks 20–30.** B7 partnership work. C3 SDK drop.
**Weeks 30+.** C1 / C2 / C4 / C5 based on data and partner demand.

# Competitive landscape — quick snapshot

Not a full analysis — just the ones that matter for positioning.

| Project | What it does | How SnapProof differs |
|---------|--------------|------------------------|
| **C2PA / Content Credentials** | Standard for embedded manifest-based provenance in files; adopted by Adobe, Sony, Leica. | Standards, not a product. SnapProof complements by anchoring on Sui; we can both emit and consume C2PA (C5). |
| **Numbers Protocol** | Blockchain-anchored photo registration with an SDK, NFT angle. | We're Sui-native, use Walrus for storage (content-addressed, not NFTified), and we're building for verified-media-as-utility not collectibles. |
| **TruePic** | Enterprise platform for controlled camera capture with secure enclaves; primarily B2B. | Open consumer app + protocol, developer-embeddable, chain-anchored by default. Less secure-enclave-dependent. |
| **Project Origin (BBC et al.)** | News industry signed-media initiative, overlaps with C2PA. | Not a competitor — a target partner for C5. |
| **Photo EXIF-plus** solutions (various startups) | Capture app + cloud receipt. | We lean on Sui + Walrus for durability without running a central receipt server. Our backend is optional; theirs is typically load-bearing. |

# Risks register (top five)

1. **Walrus availability or pricing shifts.** Mitigation: keep storage behind an abstraction; have an IPFS fallback path even if unused today.
2. **Sui fullnode cost at scale.** Mitigation: our own indexer + fallbacks (A6, C6). Most reads can be served locally.
3. **Regulatory scrutiny of "verified photo" claims.** Mitigation: A3 and the explicit what-we-don't-claim posture; legal review before any enterprise pitch (B6).
4. **Sponsor wallet compromise on mainnet.** Mitigation: rate limit, per-user caps, hot/cold wallet split, on-chain monitoring.
5. **Bad actors using proofs to "launder" doctored images.** Mitigation: A2, B2 make it measurably harder; C2 gives a response channel when it still happens.

# Ask: what to build first

If one thing ships next: **A1 (shareable link + web verifier)**. It's small, compounds every other feature's value, and turns every existing proof into its own marketing surface.

If we can run two in parallel: **A1 + A5** (analytics). That way the data on A1's adoption immediately informs whether the next bet is A3 (trust story), A4 (reliability), or jumping to B1 (recoverable wallets).

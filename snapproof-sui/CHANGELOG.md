# Changelog

All notable changes to SnapProof are tracked here. Dates are YYYY-MM-DD.
The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased] — Track A enhancements

### Added

**Backend (`backend/`)**
- RFC 7807 `application/problem+json` error envelope for every API response.
- Prometheus metrics at `GET /api/metrics` (request count, latency histogram,
  query result classes, verify outcomes).
- Liveness and readiness probes at `GET /api/health` and `GET /api/health/ready`.
- Cursor-based pagination on `GET /api/proofs?limit=&cursor=`.
- Optional Postgres indexer that polls `ProofCreated` events every
  `INDEXER_POLL_MS` (default 15 s) and mirrors them into a `proofs` table.
  Activated by setting `DATABASE_URL`; `pg` is a dynamic optional dependency.
- Optional Sentry wiring (`SENTRY_DSN`) via dynamic import of `@sentry/node`.
- `pino` + `pino-http` structured logging.
- Write-endpoint rate limiting (30 req/min/IP by default, configurable).
- Hash input validation (regex `/^[0-9a-f]{64}$/i`) on all `by-hash`
  and `verify` routes.

**Mobile (`mobile/`)**
- `src/services/proofDetails.ts` — deduplicating, TTL-backed cache that
  resolves `PhotoProof` objects to Walrus image URLs (10 min on success,
  30 s on failure), plus a concurrency-limited batch prefetcher.
- Map screen now shows Walrus photo thumbnails in markers, callouts, and
  list cards. First 8 pins are prefetched (concurrency 6); remaining
  pins hydrate on marker tap (map mode) or when list items enter the
  viewport (30% visibility threshold, concurrency 4). Markers render a
  40px circular photo ringed in red; the custom callout (tooltip mode)
  shows a 160px preview plus an "Open Verifier →" link that deep-links
  into the web verifier. List cards now include the thumbnail, a
  capture date, and a new "Verify" action button.
- `src/services/analytics.ts` — Sentry-optional wrapper with a stable event
  catalog (`proof_submit_*`, `verify_*`, `faucet_*`, `wallet_*`,
  `map_proof_opened`, etc.).
- `src/services/settings.ts` — persistent user settings via `expo-secure-store`
  (native) / `localStorage` (web).
- `src/services/outbox.ts` — offline submission queue backed by
  `expo-file-system`. Auto-retries on reconnect via a `NetInfo` listener in
  `_layout.tsx`.
- `app/outbox.tsx` — outbox UI with pending items, retry, and delete.
- `app/settings.tsx` — privacy and capture settings.
- `src/components/OnboardingModal.tsx` — 3-step first-launch walkthrough.
- Camera-only mode: disables the library picker and surfaces a banner.
- Live image-hash preview: hash is computed immediately after capture
  (not just at submit), shown in a monospace chip under the preview.
- Device clock-skew warning when > 2 minutes off `worldtimeapi.org`.
- Persistent `ℹ️` header button to re-open onboarding.
- "Copy Link" on the receipt screen now uses `EXPO_PUBLIC_WEB_VERIFIER_URL`.

**Web (`web/`)**
- Home page accepts both Sui object IDs (`0x…`) and 64-hex image hashes.
- New `/h/[hash]` route that looks up a proof by hash through the backend
  (with an on-chain fallback) and redirects to the canonical `/p/[objectId]`.
- Dynamic OG image endpoint at `/p/[id]/opengraph-image` for social
  previews (Walrus photo + verification card).
- Updated `<title>` and metadata (replacing the Next.js default).
- `NEXT_PUBLIC_BACKEND_URL` + `NEXT_PUBLIC_PROOF_PACKAGE_ID` wired through.

**Docs**
- `backend/.env.example`, `mobile/.env.example`, `web/.env.example`.
- This `CHANGELOG.md`.
- New `docs/dev/WEB.md` covering the Next.js verifier (routes, OG
  images, fallback chain).
- Refreshed `docs/dev/API.md` for RFC 7807, `/api/metrics`,
  `/api/health/ready`, cursor pagination, and rate limiting.
- Refreshed `docs/dev/BACKEND.md` for the new `src/` layout, Postgres
  indexer preference order, pino logging, metrics, and rate limiting.
- Refreshed `docs/dev/MOBILE.md` for the outbox, settings, onboarding,
  analytics service, new env vars, the `proofDetails` cache, and the
  map screen's thumbnail/callout/verifier path.
- `docs/dev/ROADMAP.md` marks A1–A6 as ✅ Shipped and the prioritization
  matrix reflects the same. Track B (B1 zkLogin) is now "next."
- Updated `docs/README.md` index to include `WEB.md` and mention the
  `web/` workspace.

### Changed

- `mobile/src/config.ts` now exports `WEB_VERIFIER_URL` for the receipt screen.
- Backend `GET /api/proofs` preference order: Postgres indexer → on-chain events →
  in-memory cache (fallback).
- Backend `package.json` bumped to 0.2.0 with `pino`, `pino-http`, and
  `express-rate-limit` added.

### Security

- Write endpoints are now rate-limited per IP by default.
- Input hash validation rejects malformed strings before hitting the chain.
- The backend disables `x-powered-by`.

# SnapProof — Documentation

Documentation for SnapProof is split into two tracks based on who's reading.

## Start here

- [`PROJECT.md`](./PROJECT.md) — end-to-end project documentation: the problem SnapProof resolves, the real-world scenarios it handles, the Sui features it applies today, the pain points that still need work, and the Sui capabilities that can close those gaps. Best single document for anyone evaluating the project from scratch.
- [`ARCHITECTURE_AND_WORKFLOWS.md`](./ARCHITECTURE_AND_WORKFLOWS.md) — detailed architecture (per-tier responsibilities, data model, deployment topology) and every workflow end to end (capture, verify, map, outbox, wallet bootstrap, backend, indexer, web verifier) with sequence diagrams, failure modes, and ADR-style design decisions.

## Overview track (for non-developers)

Start here if you're evaluating the project — hackathon judge, product reviewer, or first-time reader who just wants to know what this is and see it working.

- [`overview/OVERVIEW.md`](./overview/OVERVIEW.md) — what SnapProof is, why it matters, and what it does and doesn't claim.
- [`overview/DEMO.md`](./overview/DEMO.md) — two-minute live demo script with recovery tips.

## Developer track

Start here if you're contributing code, reviewing the design, or integrating against the app's building blocks.

- [`dev/ARCHITECTURE.md`](./dev/ARCHITECTURE.md) — three-tier system overview, diagrams, and data-flow walkthroughs.
- [`dev/WORKFLOWS.md`](./dev/WORKFLOWS.md) — every user and developer workflow step by step, with file/function references.
- [`dev/MOBILE.md`](./dev/MOBILE.md) — stack, directory layout, screen-by-screen tour, services, and platform branches.
- [`dev/CONTRACTS.md`](./dev/CONTRACTS.md) — Move package, `PhotoProof` struct, `create_proof` entry function, event, tests.
- [`dev/BACKEND.md`](./dev/BACKEND.md) — Express service, Sui client layer, Postgres indexer, metrics, rate limiting.
- [`dev/WEB.md`](./dev/WEB.md) — Next.js web verifier, routes, client-side re-hashing, OG images.
- [`dev/API.md`](./dev/API.md) — REST endpoints, RFC 7807 error format, request/response shapes, and `curl` examples.
- [`dev/DATA_MODEL.md`](./dev/DATA_MODEL.md) — canonical field reference for on-chain, off-chain, and storage.
- [`dev/SETUP.md`](./dev/SETUP.md) — clone-to-running instructions for all three workspaces, plus troubleshooting.
- [`dev/GLOSSARY.md`](./dev/GLOSSARY.md) — one-line definitions for every domain term.
- [`dev/ROADMAP.md`](./dev/ROADMAP.md) — prioritized enhancements to take SnapProof from MVP to product: mini-PRDs across product/UX, trust, GTM, and technical robustness.

## At a glance

```
snapproof-sui/
├── mobile/       # Expo + React Native app
├── web/          # Next.js web verifier (public proof pages)
├── contracts/    # Sui Move package (snapproof::snapproof)
├── backend/      # Node/Express indexer + REST API
└── docs/
    ├── README.md         (this file)
    ├── overview/         OVERVIEW.md, DEMO.md
    └── dev/              ARCHITECTURE.md, WORKFLOWS.md, MOBILE.md,
                          CONTRACTS.md, BACKEND.md, WEB.md, API.md,
                          DATA_MODEL.md, SETUP.md, GLOSSARY.md,
                          ROADMAP.md
```

## Reading orders

**I have five minutes:** `overview/OVERVIEW.md`.

**I'm giving a demo:** `overview/OVERVIEW.md` → `overview/DEMO.md`.

**I'm onboarding as a developer:** `overview/OVERVIEW.md` → `dev/ARCHITECTURE.md` → `dev/SETUP.md` → `dev/WORKFLOWS.md` → the workspace doc you'll be touching first (`MOBILE.md`, `WEB.md`, `CONTRACTS.md`, or `BACKEND.md`).

**I need to integrate via HTTP:** `dev/DATA_MODEL.md` → `dev/API.md`.

**I want to extend the on-chain schema:** `dev/DATA_MODEL.md` → `dev/CONTRACTS.md` → `dev/WORKFLOWS.md` section 9 ("Add a new field to a proof").

**I'm planning what to build next:** `overview/OVERVIEW.md` → `dev/ROADMAP.md`.

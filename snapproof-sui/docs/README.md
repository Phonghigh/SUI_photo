# SnapProof — Documentation

Documentation for SnapProof is split into two tracks based on who's reading.

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
- [`dev/BACKEND.md`](./dev/BACKEND.md) — Express service, Sui client layer, cache, what's intentionally missing.
- [`dev/API.md`](./dev/API.md) — REST endpoints, request/response shapes, and `curl` examples.
- [`dev/DATA_MODEL.md`](./dev/DATA_MODEL.md) — canonical field reference for on-chain, off-chain, and storage.
- [`dev/SETUP.md`](./dev/SETUP.md) — clone-to-running instructions for all three workspaces, plus troubleshooting.
- [`dev/GLOSSARY.md`](./dev/GLOSSARY.md) — one-line definitions for every domain term.

## At a glance

```
snapproof-sui/
├── mobile/       # Expo + React Native app
├── contracts/    # Sui Move package (snapproof::snapproof)
├── backend/      # Node/Express indexer + REST API
└── docs/
    ├── README.md         (this file)
    ├── overview/         OVERVIEW.md, DEMO.md
    └── dev/              ARCHITECTURE.md, WORKFLOWS.md, MOBILE.md,
                          CONTRACTS.md, BACKEND.md, API.md,
                          DATA_MODEL.md, SETUP.md, GLOSSARY.md
```

## Reading orders

**I have five minutes:** `overview/OVERVIEW.md`.

**I'm giving a demo:** `overview/OVERVIEW.md` → `overview/DEMO.md`.

**I'm onboarding as a developer:** `overview/OVERVIEW.md` → `dev/ARCHITECTURE.md` → `dev/SETUP.md` → `dev/WORKFLOWS.md` → the workspace doc you'll be touching first (`MOBILE.md`, `CONTRACTS.md`, or `BACKEND.md`).

**I need to integrate via HTTP:** `dev/DATA_MODEL.md` → `dev/API.md`.

**I want to extend the on-chain schema:** `dev/DATA_MODEL.md` → `dev/CONTRACTS.md` → `dev/WORKFLOWS.md` section 9 ("Add a new field to a proof").

# CLAUDE.md

## Project
SnapProof is a mobile-first Sui app for timestamping and verifying photo evidence.

Users capture a photo, the app computes a hash of the image and selected metadata, uploads the image to Walrus, and stores a proof object on Sui.

## Goal
Build a hackathon-ready MVP first, not a production system.

## MVP scope
Focus only on:
1. Mobile photo capture
2. Local SHA-256 hashing
3. Walrus upload
4. Sui proof creation
5. Proof details screen
6. Verification by re-uploading the same image
7. Optional coarse location support

Do not implement advanced moderation, AI image detection, or full encryption workflows unless explicitly requested.

## Tech stack
- Mobile: React Native with Expo and TypeScript
- Smart contracts: Sui Move
- Backend: Node.js with TypeScript
- Storage: Walrus
- Maps: Google Maps
- Package manager: npm

## Architecture
- `mobile/` contains the client app
- `contracts/` contains the Move package
- `backend/` contains API endpoints and indexing helpers

## Data model
Each proof should include:
- creator address
- walrus blob id
- image hash
- metadata hash
- combined proof hash
- created timestamp
- optional coarse geolocation
- optional case/report id

## Coding rules
- Use TypeScript everywhere outside Move
- Keep files small and modular
- Prefer explicit types
- Avoid overengineering
- Add comments only when logic is non-obvious
- Use clear naming
- Do not add dependencies unless necessary

## Working style
When asked to implement something:
1. Briefly state the plan
2. List files to create or modify
3. Implement the smallest working version first
4. Explain how to run or test it
5. Mention assumptions

## Output style
- Prefer complete file contents for new files
- Prefer focused diffs for existing files
- Do not rewrite unrelated files
- Do not invent APIs without marking them as placeholders

## Priorities
1. End-to-end proof flow
2. Clean project structure
3. Easy local testing
4. Demo readiness

## Avoid
- Full auth system in v1
- Complex role systems
- Fancy UI before core flow works
- Premature optimization

## First implementation targets
1. Scaffold `mobile/`
2. Scaffold `contracts/`
3. Create proof object spec
4. Add local hashing utility
5. Add Walrus upload service interface
6. Add proof creation flow

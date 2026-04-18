# SnapProof

SnapProof is a mobile app on Sui for timestamping and verifying photo evidence.

## Core idea
Users take a photo in the mobile app. The app computes a hash of the image and metadata, uploads the photo to Walrus, and stores a proof record on Sui. Anyone can later verify that the photo existed at a certain time and matches the stored proof.

## MVP features
- Capture photo from mobile app
- Compute SHA-256 hash locally
- Upload image to Walrus
- Create proof record on Sui
- View proof receipt
- Verify a photo by recomputing the hash
- Optional coarse geolocation

## Tech stack
- React Native / Expo
- TypeScript
- Sui Move
- Walrus
- Node.js backend/indexer
- Google Maps

## Monorepo structure
- `mobile/`: React Native app
- `contracts/`: Sui Move package
- `backend/`: API + indexing services

## Main flows
1. Capture photo
2. Compute image + metadata hash
3. Upload photo to Walrus
4. Create proof on Sui
5. Display verification receipt
6. Re-verify image later

## Status
Planning / scaffold stage

## Next milestones
- Scaffold mobile app
- Define Move contract data model
- Build proof creation flow
- Build verification screen

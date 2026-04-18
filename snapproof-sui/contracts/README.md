# SnapProof Sui Move Contracts

## Data Model

### PhotoProof object
| Field            | Type    | Description                          |
|------------------|---------|--------------------------------------|
| creator          | address | Proof creator's Sui address          |
| walrus_blob_id   | String  | Walrus storage blob ID               |
| image_hash       | String  | SHA-256 hash of image bytes          |
| metadata_hash    | String  | SHA-256 hash of selected metadata    |
| proof_hash       | String  | Combined proof hash                  |
| created_at       | u64     | Creation timestamp (ms)              |
| coarse_geo_hash  | String  | Optional coarse location geohash     |
| case_id          | String  | Optional case/report identifier      |

## Build

```bash
sui move build
```

## Test

```bash
sui move test
```

## Deploy

```bash
sui client publish --gas-budget 100000000
```

After deploying, update `PROOF_PACKAGE_ID` in `mobile/src/config.ts`.

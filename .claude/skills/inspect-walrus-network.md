---
name: sui-walrus
description: Use when storing or retrieving files using Walrus — SUI's decentralized blob storage. Triggers on "Walrus", "blob storage", "upload", "decentralized storage".
---

# SUI Walrus Integration

**Decentralized blob storage for SnapProof evidence.**

## 1. Overview
Walrus provides decentralized, content-addressable storage for your photo evidence and proofs.

## 2. CLI Usage
```bash
# Configuration
walrus config --network testnet

# Uploading a file
walrus upload proof.jpg
# Returns a Blob ID
```

## 3. Move Integration
Store the `blob_id` in your Sui objects.

```move
public struct Evidence has key, store {
    id: UID,
    photo_blob_id: vector<u8>,
    timestamp: u64,
}
```

## 4. Frontend/Backend SDK
```typescript
import { WalrusClient } from '@walrus-sdk/client';
const client = new WalrusClient({ network: 'testnet' });

async function uploadAndGetUrl(file: File) {
  const blobId = await client.upload(file);
  return `https://walrus-testnet.storage/${blobId}`;
}
```

## 5. Best Practices
- **Store ID, not URL**: URLs change; store the 32-byte blob ID on-chain.
- **Verification**: Verify the local hash matches the blob ID before linking to a Sui transaction.
- **Gateways**: Use reliable Walrus gateways for image retrieval in the mobile app.

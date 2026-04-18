---
name: sui-ts-sdk
description: Sui TypeScript SDK — PTB construction, client setup, transaction execution, and on-chain queries. Covers backend verification, indexing, and service logic.
---

# Sui TypeScript SDK & Backend Engineering

You are building a backend for **SnapProof on Sui**. Use this skill for writing, reviewing, or debugging TypeScript code that interacts with the Sui blockchain.

## 1. Key Responsibilities
- **Verification API**: Logic to verify on-chain hashes against local data.
- **Indexing Service**: Querying transaction blocks and events to track proof submissions.
- **Service Architecture**: Clean, production-ready TypeScript patterns for Sui services.

## 2. Sui SDK Core Patterns

### Client Setup (v2)
Use `SuiGrpcClient` for best performance in backend services.

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
```

### PTB Construction
```typescript
import { Transaction } from '@mysten/sui/transactions';
const tx = new Transaction();

// Split and Transfer pattern
const [coin] = tx.splitCoins(tx.gas, [1000]);
tx.transferObjects([coin], recipientAddress);
```

### Verification Logic
```typescript
async function verifyProof(digest: string) {
  const tx = await client.waitForTransaction({ digest });
  if (tx.$kind === 'FailedTransaction') return false;
  
  // Extract events or object changes to verify the hash
  const events = tx.effects.events;
  return events.some(e => e.type.includes('ProofCreatedEvent'));
}
```

## 3. Best Practices
- **Always check transaction status**: Use `result.$kind === 'FailedTransaction'`.
- **Wait for indexing**: Use `client.waitForTransaction()` before querying for the results of an execution.
- **Type Safety**: Use subpath imports like `@mysten/sui/transactions`.
- **BCS**: Use `tx.pure.u64()`, `tx.pure.address()`, etc. for inputs.

## 4. Backend-Specific Patterns
- Use **Environment Variables** for package IDs and gateway URLs.
- Implement **Retry Logic** with exponential backoff for network calls.
- Use **Fastify or Express** with TypeScript for the verification endpoints.

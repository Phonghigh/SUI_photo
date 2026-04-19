import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { PrismaClient } from '@prisma/client';

const SUI_NETWORK = 'testnet';
const PROOF_PACKAGE_ID = process.env.NEXT_PUBLIC_PROOF_PACKAGE_ID ?? '';

const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
const prisma = new PrismaClient();

async function main() {
  console.log(`[Indexer] Starting SnapProof Indexer on ${SUI_NETWORK}...`);
  console.log(`[Indexer] Listening for events from package: ${PROOF_PACKAGE_ID}`);

  // Subscribe to the ProofCreated event
  const unsubscribe = await client.subscribeEvent({
    filter: {
      MovePackage: PROOF_PACKAGE_ID,
    },

    onMessage: async (event) => {
      console.log(`[Indexer] Received event: ${event.type}`);
      try {
        const parsedJson = event.parsedJson as any;
        
        await prisma.proof.upsert({
          where: { txDigest: event.id.txDigest },
          update: {},
          create: {
            id: parsedJson.proof_id, // Ensure your Move event emits the new object ID
            txDigest: event.id.txDigest,
            creator: parsedJson.creator,
            imageHash: parsedJson.image_hash,
            metadataHash: parsedJson.metadata_hash,
            proofHash: parsedJson.proof_hash,
            walrusBlobId: parsedJson.walrus_blob_id,
            coarseGeoHash: parsedJson.coarse_geo_hash || null,
            createdAt: new Date(Number(parsedJson.created_at)),
          },
        });
        
        console.log(`[Indexer] ✅ Indexed proof ${parsedJson.proof_id}`);
      } catch (error) {
        console.error(`[Indexer] ❌ Failed to index event:`, error);
      }
    },
  });

  console.log("[Indexer] Subscribed successfully. Waiting for events...");

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log("[Indexer] Shutting down...");
    await unsubscribe();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

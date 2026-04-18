/**
 * Persistent indexer scaffold.
 *
 * When DATABASE_URL is set and `pg` is installed, this module will:
 *   - initialize the `proofs` table
 *   - subscribe to ProofCreated events via polling (cursor-based)
 *   - write records into Postgres
 *
 * When DATABASE_URL is empty, all functions are no-ops and the existing
 * in-memory cache path serves requests.
 *
 * The module uses dynamic `import` so `pg` is optional at install time.
 */

import { logger } from "../logger.js";
import { queryProofEvents } from "./sui-client.js";
import type { ProofRecord } from "../types/proof.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const INDEXER_POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 15_000);

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

let pool: PgPool | null = null;
let indexerTimer: NodeJS.Timeout | null = null;

export function indexerEnabled(): boolean {
  return !!DATABASE_URL && pool !== null;
}

export async function startIndexer(): Promise<void> {
  if (!DATABASE_URL) {
    logger.info("indexer: DATABASE_URL not set — indexer disabled");
    return;
  }

  const pg: any = await import("pg" as string).catch(() => null);
  if (!pg) {
    logger.warn("indexer: DATABASE_URL set but `pg` not installed — indexer disabled");
    return;
  }

  pool = new pg.Pool({ connectionString: DATABASE_URL });

  await pool!.query(`
    CREATE TABLE IF NOT EXISTS proofs (
      object_id       TEXT PRIMARY KEY,
      tx_digest       TEXT NOT NULL,
      image_hash      TEXT NOT NULL,
      metadata_hash   TEXT,
      proof_hash      TEXT NOT NULL,
      walrus_blob_id  TEXT,
      creator         TEXT NOT NULL,
      created_at      BIGINT NOT NULL,
      coarse_geo_hash TEXT,
      case_id         TEXT,
      indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool!.query(`CREATE INDEX IF NOT EXISTS proofs_image_hash_idx ON proofs (image_hash);`);
  await pool!.query(`CREATE INDEX IF NOT EXISTS proofs_created_at_idx ON proofs (created_at DESC);`);
  await pool!.query(`CREATE INDEX IF NOT EXISTS proofs_creator_idx ON proofs (creator);`);

  logger.info("indexer: connected + migrated");

  // Poll loop.
  const tick = async () => {
    try {
      const events = await queryProofEvents(100);
      for (const r of events) {
        if (!r.objectId) continue;
        await upsertProof(r);
      }
      logger.debug({ count: events.length }, "indexer: tick complete");
    } catch (err) {
      logger.warn({ err }, "indexer: tick failed");
    }
  };
  await tick();
  indexerTimer = setInterval(tick, INDEXER_POLL_MS);
}

export async function stopIndexer(): Promise<void> {
  if (indexerTimer) clearInterval(indexerTimer);
  indexerTimer = null;
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function upsertProof(r: ProofRecord): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO proofs
       (object_id, tx_digest, image_hash, metadata_hash, proof_hash,
        walrus_blob_id, creator, created_at, coarse_geo_hash, case_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (object_id) DO UPDATE SET
       tx_digest       = EXCLUDED.tx_digest,
       image_hash      = EXCLUDED.image_hash,
       proof_hash      = EXCLUDED.proof_hash,
       creator         = EXCLUDED.creator,
       created_at      = EXCLUDED.created_at,
       coarse_geo_hash = EXCLUDED.coarse_geo_hash;
    `,
    [
      r.objectId,
      r.txDigest,
      r.imageHash,
      r.metadataHash || null,
      r.proofHash,
      r.walrusBlobId || null,
      r.creator,
      r.createdAt,
      r.coarseGeoHash || null,
      r.caseId || null,
    ]
  );
}

export async function findProofByHashPg(imageHash: string): Promise<ProofRecord | null> {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM proofs WHERE image_hash = $1 LIMIT 1`,
    [imageHash]
  );
  return rows[0] ? rowToProof(rows[0]) : null;
}

export async function listProofsPg(
  limit: number,
  cursor?: string
): Promise<{ proofs: ProofRecord[]; nextCursor: string | null }> {
  if (!pool) return { proofs: [], nextCursor: null };
  const params: unknown[] = [];
  let where = "";
  if (cursor) {
    params.push(Number(cursor));
    where = `WHERE created_at < $${params.length}`;
  }
  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT * FROM proofs ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(rowToProof);
  const nextCursor = hasMore ? String(page[page.length - 1].createdAt) : null;
  return { proofs: page, nextCursor };
}

function rowToProof(row: any): ProofRecord {
  return {
    imageHash: row.image_hash,
    metadataHash: row.metadata_hash ?? "",
    proofHash: row.proof_hash,
    walrusBlobId: row.walrus_blob_id ?? "",
    createdAt: Number(row.created_at),
    txDigest: row.tx_digest,
    objectId: row.object_id,
    creator: row.creator,
    coarseGeoHash: row.coarse_geo_hash ?? undefined,
    caseId: row.case_id ?? undefined,
  };
}

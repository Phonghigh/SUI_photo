import { Router, type Request, type Response, type NextFunction } from "express";
import type { ProofRecord } from "../types/proof.js";
import {
  queryProofEvents,
  getProofObject,
  findProofByImageHash,
} from "../services/sui-client.js";
import {
  indexerEnabled,
  findProofByHashPg,
  listProofsPg,
} from "../services/indexer.js";
import { badRequest, notFound, internal } from "../errors.js";
import { proofQueryTotal, verifyResult } from "../metrics.js";
import { track } from "../analytics.js";

export const proofRoutes = Router();

// In-memory cache as a last-ditch fallback when both on-chain + indexer fail.
const proofCache: ProofRecord[] = [];

// --- helpers ---

function parsePositiveInt(raw: unknown, fallback: number, cap: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), cap);
}

function wrap(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => handler(req, res).catch(next);
}

// --- routes ---

// GET /api/proofs?limit=20&cursor=<createdAtMs>
proofRoutes.get(
  "/",
  wrap(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    // Preferred path: Postgres indexer.
    if (indexerEnabled()) {
      const { proofs, nextCursor } = await listProofsPg(limit, cursor);
      proofQueryTotal.inc({ result: "indexer" });
      res.json({ proofs, nextCursor });
      return;
    }

    // Fallback: on-chain events.
    try {
      const onChain = await queryProofEvents(limit);
      proofQueryTotal.inc({ result: "onchain" });
      res.json({ proofs: onChain, nextCursor: null });
    } catch {
      proofQueryTotal.inc({ result: "cache_fallback" });
      res.json({ proofs: proofCache.slice(0, limit), nextCursor: null });
    }
  })
);

// GET /api/proofs/by-id/:objectId
proofRoutes.get(
  "/by-id/:objectId",
  wrap(async (req, res) => {
    const proof = await getProofObject(req.params.objectId).catch(() => null);
    if (!proof) {
      throw notFound(`No proof object with id ${req.params.objectId}.`);
    }
    res.json({ proof });
  })
);

// GET /api/proofs/by-hash/:imageHash
proofRoutes.get(
  "/by-hash/:imageHash",
  wrap(async (req, res) => {
    const imageHash = req.params.imageHash;
    if (!/^[0-9a-f]{64}$/i.test(imageHash)) {
      throw badRequest("imageHash must be a 64-character lowercase hex string.");
    }

    let proof: ProofRecord | null = null;

    if (indexerEnabled()) {
      proof = await findProofByHashPg(imageHash);
    }
    if (!proof) {
      proof = await findProofByImageHash(imageHash).catch(() => null);
    }
    if (!proof) {
      proof = proofCache.find((p) => p.imageHash === imageHash) ?? null;
    }
    if (!proof) throw notFound(`No proof found for imageHash ${imageHash}.`);
    res.json({ proof });
  })
);

// POST /api/proofs — cache insert (best-effort)
proofRoutes.post(
  "/",
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const required = ["imageHash", "proofHash", "txDigest"];
    for (const k of required) {
      if (!body[k]) throw badRequest(`Missing required field: ${k}`);
    }
    const record: ProofRecord = {
      imageHash: String(body.imageHash),
      metadataHash: String(body.metadataHash ?? ""),
      proofHash: String(body.proofHash),
      walrusBlobId: String(body.walrusBlobId ?? ""),
      createdAt: Number(body.createdAt ?? Date.now()),
      txDigest: String(body.txDigest),
      objectId: String(body.objectId ?? ""),
      creator: String(body.creator ?? ""),
      coarseGeoHash: body.coarseGeoHash ? String(body.coarseGeoHash) : undefined,
      caseId: body.caseId ? String(body.caseId) : undefined,
    };
    proofCache.unshift(record);
    if (proofCache.length > 500) proofCache.length = 500;
    track({ name: "proof_indexed", props: { imageHash: record.imageHash } });
    res.status(201).json({ proof: record });
  })
);

// POST /api/proofs/verify — { imageHash: string }
proofRoutes.post(
  "/verify",
  wrap(async (req, res) => {
    const imageHash = (req.body?.imageHash ?? "").toString();
    if (!/^[0-9a-f]{64}$/i.test(imageHash)) {
      throw badRequest("imageHash must be a 64-character lowercase hex string.");
    }

    let proof: ProofRecord | null = null;
    if (indexerEnabled()) proof = await findProofByHashPg(imageHash);
    if (!proof) proof = await findProofByImageHash(imageHash).catch(() => null);
    if (!proof) proof = proofCache.find((p) => p.imageHash === imageHash) ?? null;

    const verified = !!proof;
    verifyResult.inc({ result: verified ? "match" : "not_found" });
    track({ name: "proof_verified", props: { result: verified ? "match" : "not_found" } });
    res.json({ verified, proof });
  })
);

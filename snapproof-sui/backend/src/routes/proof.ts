import { Router } from "express";
import type { ProofRecord } from "../types/proof.js";
import {
  queryProofEvents,
  getProofObject,
  findProofByImageHash,
} from "../services/sui-client.js";

export const proofRoutes = Router();

// In-memory cache for indexed proofs (supplements on-chain queries)
const proofCache: ProofRecord[] = [];

// Get recent proofs from on-chain events
proofRoutes.get("/", async (_req, res) => {
  try {
    const limit = Number(_req.query.limit) || 20;
    const onChainProofs = await queryProofEvents(limit);
    res.json({ proofs: onChainProofs });
  } catch (error) {
    // Fallback to cache if on-chain query fails
    res.json({ proofs: proofCache });
  }
});

// Get proof by object ID (on-chain lookup)
proofRoutes.get("/by-id/:objectId", async (req, res) => {
  try {
    const proof = await getProofObject(req.params.objectId);
    if (!proof) {
      res.status(404).json({ error: "Proof not found" });
      return;
    }
    res.json({ proof });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch proof" });
  }
});

// Get proof by image hash (on-chain event search)
proofRoutes.get("/by-hash/:imageHash", async (req, res) => {
  try {
    const proof = await findProofByImageHash(req.params.imageHash);
    if (!proof) {
      // Fallback to cache
      const cached = proofCache.find(
        (p) => p.imageHash === req.params.imageHash
      );
      if (!cached) {
        res.status(404).json({ error: "Proof not found" });
        return;
      }
      res.json({ proof: cached });
      return;
    }
    res.json({ proof });
  } catch (error) {
    res.status(500).json({ error: "Failed to search proofs" });
  }
});

// Index a new proof (called by mobile after on-chain creation for caching)
proofRoutes.post("/", (req, res) => {
  const record: ProofRecord = {
    imageHash: req.body.imageHash,
    metadataHash: req.body.metadataHash,
    proofHash: req.body.proofHash,
    walrusBlobId: req.body.walrusBlobId,
    createdAt: req.body.createdAt ?? Date.now(),
    txDigest: req.body.txDigest,
    objectId: req.body.objectId ?? "",
    creator: req.body.creator ?? "",
    coarseGeoHash: req.body.coarseGeoHash,
    caseId: req.body.caseId,
  };

  proofCache.push(record);
  res.status(201).json({ proof: record });
});

// Verify: check if an image hash has a proof on-chain
proofRoutes.post("/verify", async (req, res) => {
  const { imageHash } = req.body;

  if (!imageHash) {
    res.status(400).json({ error: "imageHash is required" });
    return;
  }

  try {
    const proof = await findProofByImageHash(imageHash);
    res.json({
      verified: !!proof,
      proof: proof ?? null,
    });
  } catch (error) {
    // Fallback to cache
    const cached = proofCache.find((p) => p.imageHash === imageHash);
    res.json({
      verified: !!cached,
      proof: cached ?? null,
    });
  }
});

import { Router } from "express";
import { getSuiClient } from "../services/sui-client.js";
import { indexerEnabled } from "../services/indexer.js";

export const healthRoutes = Router();

/** Liveness probe — answers "is the process running?" */
healthRoutes.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "snapproof-backend",
    timestamp: new Date().toISOString(),
    now: Date.now(),
  });
});

/**
 * Readiness probe — answers "can this instance serve traffic?"
 * Checks Sui RPC reachability. Returns 503 if unhealthy.
 */
healthRoutes.get("/ready", async (_req, res) => {
  const checks: Record<string, { ok: boolean; error?: string }> = {};
  try {
    const client = getSuiClient();
    await client.getLatestCheckpointSequenceNumber();
    checks.sui = { ok: true };
  } catch (e) {
    checks.sui = { ok: false, error: (e as Error).message };
  }
  checks.indexer = { ok: indexerEnabled() };
  const allOk = Object.values(checks).every((c) => c.ok);
  res.status(allOk ? 200 : 503).json({ status: allOk ? "ready" : "degraded", checks });
});

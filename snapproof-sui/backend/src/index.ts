import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import { proofRoutes } from "./routes/proof.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes } from "./routes/metrics.js";
import { problemHandler } from "./errors.js";
import { metricsMiddleware, writeRateLimiter } from "./middleware.js";
import { logger } from "./logger.js";
import { initAnalytics, track } from "./analytics.js";
import { startIndexer, stopIndexer } from "./services/indexer.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.disable("x-powered-by");
app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(metricsMiddleware);

app.use("/api/health", healthRoutes);
app.use("/api/metrics", metricsRoutes);

// Rate-limit only write endpoints.
app.use("/api/proofs", (req, res, next) => {
  if (req.method === "POST") return writeRateLimiter(req, res, next);
  return next();
});
app.use("/api/proofs", proofRoutes);

// 404 → problem+json.
app.use((req, res) => {
  res.status(404).type("application/problem+json").send({
    type: "https://snapproof.app/problems/not-found",
    title: "Not Found",
    status: 404,
    detail: `No route: ${req.method} ${req.originalUrl}`,
    instance: req.originalUrl,
  });
});

// Error handler last.
app.use(problemHandler);

async function main() {
  await initAnalytics();
  await startIndexer();

  const server = app.listen(PORT, () => {
    logger.info(`SnapProof backend running on http://localhost:${PORT}`);
    track({ name: "backend_started", props: { port: PORT } });
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close();
    await stopIndexer();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { httpRequests, httpDuration } from "./metrics.js";

/**
 * Lightweight Prometheus-style latency + count middleware.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = (req.route?.path as string) ?? req.path;
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequests.inc(labels);
    const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
    httpDuration.observe(elapsed, labels);
  });
  next();
}

/**
 * Rate limiter for write endpoints. 30 requests/minute/IP by default.
 * Sits in front of POST routes only; GET is cheap + safe.
 */
export const writeRateLimiter = rateLimit({
  windowMs: Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.WRITE_RATE_LIMIT_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .type("application/problem+json")
      .send({
        type: "https://snapproof.app/problems/too-many-requests",
        title: "Too Many Requests",
        status: 429,
        detail: "Rate limit exceeded for write endpoints.",
      });
  },
});

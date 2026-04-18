import { Router } from "express";
import { renderMetrics } from "../metrics.js";

export const metricsRoutes = Router();

metricsRoutes.get("/", (_req, res) => {
  res.type("text/plain; version=0.0.4").send(renderMetrics());
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { proofRoutes } from "./routes/proof.js";
import { healthRoutes } from "./routes/health.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/proofs", proofRoutes);

app.listen(PORT, () => {
  console.log(`SnapProof backend running on http://localhost:${PORT}`);
});

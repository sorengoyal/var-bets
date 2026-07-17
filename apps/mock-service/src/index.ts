import express from "express";
import { PORT } from "./config";
import fixturesRouter from "./routes/fixtures";
import scoresRouter from "./routes/scores";
import simulateRouter from "./routes/simulate";

const app = express();

// Set server boot time for the virtual clock
(global as any).SERVER_BOOT_TIME = Date.now();

app.use(express.json());

// Base path /api
app.use("/api/fixtures", fixturesRouter);
app.use("/api/scores", scoresRouter);

// Simulation control
app.use("/simulate", simulateRouter);

app.listen(PORT, () => {
  console.log(`TxLine Mock Service running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`- GET /api/fixtures`);
  console.log(`- GET /api/scores/updates/:fixtureId`);
  console.log(`- POST /simulate/reset`);
  console.log(`- POST /simulate/fast-forward`);
});

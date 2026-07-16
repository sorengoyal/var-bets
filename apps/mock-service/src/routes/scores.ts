import { Request, Response, Router } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { getDataDir } from "../config";

const router = Router();

/**
 * Helper to get the current virtual time.
 * Logic: VirtualTime = START_TIME + (RealNow - ServerBootTime)
 */
const getVirtualCurrentTime = (): Date => {
  const startTime = new Date(process.env.START_TIME!).getTime();
  const bootTime = (global as any).SERVER_BOOT_TIME;
  return new Date(startTime + (Date.now() - bootTime));
};

router.get("/updates/:fixtureId", async (req: Request, res: Response) => {
  const { fixtureId } = req.params;
  try {
    const virtualNow = getVirtualCurrentTime();
    const filePath = path.join(getDataDir(), `scores-${fixtureId}.json`);
    const data = await fs.readFile(filePath, "utf8");
    const events = JSON.parse(data);

    const filteredEvents = events.filter((event: any) => {
      return new Date(event.timestamp) <= virtualNow;
    });

    res.json(filteredEvents);
  } catch {
    res
      .status(404)
      .json({ error: `Scores for fixture ${fixtureId} not found` });
  }
});

export default router;

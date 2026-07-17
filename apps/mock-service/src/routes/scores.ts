import { Request, Response, Router } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { getDataDir, START_TIME } from "../config";

const router = Router();

const getVirtualCurrentTime = (): number => {
  const bootTime = (global as any).SERVER_BOOT_TIME;
  return START_TIME + (Date.now() - bootTime);
};

router.get("/updates/:fixtureId", async (req: Request, res: Response) => {
  const { fixtureId } = req.params;
  try {
    const virtualNow = getVirtualCurrentTime();
    console.log("Current Time", virtualNow);
    const filePath = path.join(getDataDir(), `scores-${fixtureId}.json`);
    const data = await fs.readFile(filePath, "utf8");
    const events = JSON.parse(data);

    const filteredEvents = events.filter((event: any) => {
      return event.Ts <= virtualNow;
    });

    res.json(filteredEvents);
  } catch {
    res
      .status(404)
      .json({ error: `Scores for fixture ${fixtureId} not found` });
  }
});

export default router;

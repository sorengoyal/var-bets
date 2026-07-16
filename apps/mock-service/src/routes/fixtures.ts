import { Request, Response, Router } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { getDataDir } from "../config";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const filePath = path.join(getDataDir(), "fixtures.json");
    const data = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(data));
  } catch {
    res.status(500).json({ error: "Could not read fixtures.json" });
  }
});

export default router;

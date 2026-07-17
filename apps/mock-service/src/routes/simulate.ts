import { Request, Response, Router } from "express";
import { START_TIME } from "../config";

const router = Router();

const getVirtualCurrentTime = (): number => {
  const bootTime = (global as any).SERVER_BOOT_TIME;
  return START_TIME + (Date.now() - bootTime);
};

// POST /simulate/reset
router.post("/reset", (_req: Request, res: Response) => {
  (global as any).SERVER_BOOT_TIME = Date.now();
  console.log("Simulation reset. Virtual time set to START_TIME.", START_TIME);
  const currentTime = new Date(getVirtualCurrentTime()).toISOString();
  res.json({ currentTime });
});

// POST /simulate/fast-forward — advances by exactly 1 minute
router.post("/fast-forward", (_req: Request, res: Response) => {
  (global as any).SERVER_BOOT_TIME -= 60_000;
  const currentTime = new Date(getVirtualCurrentTime()).toISOString();
  res.json({ currentTime });
});

export default router;

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const START_TIME = process.env.START_TIME;
const DATA_DIR = process.env.DATA_DIR || './data';

if (!START_TIME) {
  console.error('ERROR: START_TIME is not defined in .env');
  process.exit(1);
}

const startTimeDate = new Date(START_TIME);

/**
 * Virtual Clock Logic
 * calculates the current "virtual time" based on real-time passage
 * since the server started.
 */
const getVirtualCurrentTime = (): Date => {
  const now = new Date();
  const elapsed = now.getTime() - startTimeDate.getTime();
  // For testing purposes, we assume the server started "at" startTimeDate.
  // However, since the server starts later, we calculate virtual time as:
  // VirtualTime = StartTime + (RealNow - ServerStartTime)
  // But typically for these mocks, the simple "startTime + elapsed" is used where
  // elapsed is simply real time if we treat the server start as the anchor.
  // Let's implement the "Real-time match" where virtual clock increments 1:1.
  
  // If the server was started at RealTime T_start, and virtual start is V_start:
  // VirtualTime = V_start + (RealNow - T_start)
  // We need to track when the process actually started.
  return new Date(startTimeDate.getTime() + (Date.now() - process.uptime() * 1000));
};

// We'll use a simpler approach: the virtual time is just START_TIME + real time elapsed since server boot.
const SERVER_BOOT_TIME = Date.now();

const getCurrentVirtualTime = () => {
  const elapsed = Date.now() - SERVER_BOOT_TIME;
  return new Date(startTimeDate.getTime() + elapsed);
};

app.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const filePath = path.join(DATA_DIR, 'fixtures.json');
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Could not read fixtures.json' });
  }
});

app.get('/scores', async (req: Request, res: Response) => {
  const fixtureId = req.query.fixtureId;
  if (!fixtureId) {
    return res.status(400).json({ error: 'fixtureId is required' });
  }

  try {
    const virtualNow = getCurrentVirtualTime();
    const filePath = path.join(DATA_DIR, `scores-${fixtureId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    const events = JSON.parse(data);

    const filteredEvents = events.filter((event: any) => {
      return new Date(event.timestamp) <= virtualNow;
    });

    res.json(filteredEvents);
  } catch (error) {
    res.status(404).json({ error: `Scores for fixture ${fixtureId} not found` });
  }
});

app.listen(PORT, () => {
  console.log(`TxLine Mock Service running on port ${PORT}`);
  console.log(`Virtual Clock started at: ${START_TIME}`);
});

import * as dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const START_TIME = Number(process.env.START_TIME);
export const DATA_DIR = process.env.DATA_DIR || "./data";

export const getDataDir = () => DATA_DIR;

if (!START_TIME || isNaN(START_TIME)) {
  console.error("ERROR: START_TIME is not a valid Unix timestamp in .env");
  process.exit(1);
}

import * as dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const START_TIME = process.env.START_TIME;
export const DATA_DIR = process.env.DATA_DIR || "./data";

export const getDataDir = () => DATA_DIR;

if (!START_TIME) {
  console.error("ERROR: START_TIME is not defined in .env");
  process.exit(1);
}

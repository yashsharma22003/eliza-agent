// keeper.js
import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import { mainCall } from './index.js'; // Ensure this is also ESM

const LOW_FILE = path.resolve('.local-kv-strategy:low.json');
const HIGH_FILE = path.resolve('.local-kv-strategy:high.json');
const INTERVAL_MS = 150000;

let lastLow = null;
let lastHigh = null;

function allocate(risk, trend) {
  if (risk === 'high' && trend === 'uptrend') return 75;
  if (risk === 'high' && trend === 'downtrend') return 25;
  if (risk === 'low' && trend === 'uptrend') return 25;
  if (risk === 'low' && trend === 'downtrend') return 75;
  return 0;
}

async function readFileSafe(file) {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
}

function tryParseJSON(data) {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function checkAndAct() {
  mainCall("low");
  mainCall("high");

  const [low, high] = await Promise.all([
    readFileSafe(LOW_FILE),
    readFileSafe(HIGH_FILE),
  ]);

  let changed = false;

  if (low && low !== lastLow) {
    const lowObj = tryParseJSON(low);
    if (lowObj) {
      const allocation = allocate(lowObj.risk, lowObj.trend);
      console.log(`🔔 Low strategy output changed! Creating new mock pool...`);
      console.log('New low strategy:', low);
      console.log(`➡️  Allocation for low risk, ${lowObj.trend}: ${allocation}%`);
    }
    lastLow = low;
    changed = true;
  }

  if (high && high !== lastHigh) {
    const highObj = tryParseJSON(high);
    if (highObj) {
      const allocation = allocate(highObj.risk, highObj.trend);
      console.log(`🔔 High strategy output changed! Creating new mock pool...`);
      console.log('New high strategy:', high);
      console.log(`➡️  Allocation for high risk, ${highObj.trend}: ${allocation}%`);
    }
    lastHigh = high;
    changed = true;
  }

  if (!changed) {
    console.log('No change detected.');
  }
}

async function main() {
  console.log('🟢 Mock Chainlink Keeper started. Watching for KV output changes...');

  lastLow = await readFileSafe(LOW_FILE);
  lastHigh = await readFileSafe(HIGH_FILE);
  setInterval(checkAndAct, INTERVAL_MS);

  const app = express();
  const PORT = process.env.PORT || 4000;

  app.get("/latest/low", (_req, res) => {
    const parsed = tryParseJSON(lastLow);
    if (!parsed) return res.status(404).json({ error: "No low strategy found." });
    res.json(parsed);
  });

  app.get("/latest/high", (_req, res) => {
    const parsed = tryParseJSON(lastHigh);
    if (!parsed) return res.status(404).json({ error: "No high strategy found." });
    res.json(parsed);
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
  });
}

main();

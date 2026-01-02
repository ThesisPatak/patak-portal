import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

// Simple hardcoded credentials for demo (house -> password)
const CREDENTIALS = {
  'house1': 'password123',
  'house2': 'password456',
  // Add more houses and passwords as needed
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
let store = { readings: [], summary: {} };
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    store = JSON.parse(raw);
  }
} catch (e) {
  console.error("Failed to load existing data:", e);
}

const clients = new Set();

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// Cleanup: remove readings older than 30 seconds
function cleanupOldReadings() {
  const now = Date.now();
  const thirtySecondsAgo = now - (30 * 1000);
  const before = store.readings.length;
  store.readings = store.readings.filter(r => {
    const timestamp = r.receivedAt ? new Date(r.receivedAt).getTime() : new Date(r.timestamp).getTime();
    return timestamp > thirtySecondsAgo;
  });
  const after = store.readings.length;
  if (before !== after) {
    console.log(`Cleaned up ${before - after} readings older than 30 seconds`);
    persist();
  }
}

// Run cleanup every 5 seconds
setInterval(cleanupOldReadings, 5000);

// Return a normalized, filtered summary for clients.
function getFilteredSummary() {
  const out = {};
  const src = store.summary || {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (!v) continue;
    const k = (key || '').toString().toLowerCase();
    // hide explicit test house key
    if (k === 'test') continue;
    const cm = Number(v.cubicMeters ?? (v.last && v.last.cubicMeters) ?? 0);
    const tl = Number(v.totalLiters ?? (v.last && v.last.totalLiters) ?? 0);
    if (cm === 0.1 || tl === 100) continue; // hide test entries
    if (!out[k]) out[k] = { totalLiters: v.totalLiters, cubicMeters: v.cubicMeters, last: v.last };
    else {
      try {
        const a = new Date(out[k].last?.receivedAt || out[k].last?.timestamp || 0).getTime();
        const b = new Date(v.last?.receivedAt || v.last?.timestamp || 0).getTime();
        if (b > a) out[k] = { totalLiters: v.totalLiters, cubicMeters: v.cubicMeters, last: v.last };
      } catch (e) {
        out[k] = { totalLiters: v.totalLiters, cubicMeters: v.cubicMeters, last: v.last };
      }
    }
  }
  return out;
}

function addReading(r) {
  const ts = r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString();
  const reading = { ...r, timestamp: ts };
  // normalize house id to lowercase to avoid duplicate keys like 'House1' vs 'house1'
  reading.house = (reading.house || 'unknown').toString().toLowerCase();

  store.readings.push(reading);
  const h = reading.house;
  if (!store.summary[h]) store.summary[h] = { totalLiters: 0, cubicMeters: 0, last: null };
  const s = store.summary[h];
  if (typeof reading.totalLiters === "number") s.totalLiters = reading.totalLiters;
  if (typeof reading.cubicMeters === "number") s.cubicMeters = reading.cubicMeters;
  s.last = reading;
  persist();
  // notify SSE clients: send the single reading and the updated summary
  for (const res of clients) {
    try {
      res.write(`event: reading\n`);
      res.write(`data: ${JSON.stringify(reading)}\n\n`);
      res.write(`event: summary\n`);
      res.write(`data: ${JSON.stringify({ summary: getFilteredSummary() })}\n\n`);
    } catch (e) {
      // ignore write errors for closed clients
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/houses", (req, res) => {
  res.json({ summary: getFilteredSummary() });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, server: 'patak' });
});

app.post("/api/houses/:house", (req, res) => {
  const h = (req.params.house || '').toString().toLowerCase();
  const pwd = req.body?.password || '';
  const expectedPwd = CREDENTIALS[h];
  if (!expectedPwd || pwd !== expectedPwd) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  // Password correct; return house data
  const history = store.readings.filter(r => (r.house || '').toString().toLowerCase() === h);
  res.json({ house: h, token: h, history, latest: store.summary[h] || null });
});

app.get("/api/houses/:house", (req, res) => {
  const h = (req.params.house || '').toString().toLowerCase();
  const history = store.readings.filter(r => (r.house || '').toString().toLowerCase() === h);
  res.json({ house: h, history, latest: store.summary[h] || null });
});

app.post("/api/readings", (req, res) => {
  const body = req.body;
  if (!body || !body.house) return res.status(400).json({ error: "house field required" });
  // Normalize numeric fields when possible
  if (body.totalLiters) body.totalLiters = Number(body.totalLiters);
  if (body.cubicMeters) body.cubicMeters = Number(body.cubicMeters);
  body.receivedAt = new Date().toISOString();
  // normalize house id early
  body.house = body.house.toString().toLowerCase();

  // simple guard: ignore obvious test readings
  const cm = Number(body.cubicMeters || 0);
  const tl = Number(body.totalLiters || 0);
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (cm === 0.1 || tl === 100) {
    console.log(`Ignored test reading from ${body.house} (ip=${ip}) payload=${JSON.stringify(body)}`);
    return res.json({ ok: true, ignored: true });
  }

  console.log(`Received reading from ${body.house} (ip=${ip}): ${JSON.stringify(body)}`);
  addReading(body);
  res.json({ ok: true });
});

// Simple Server-Sent Events stream for real-time
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  // send immediate summary so clients have current state
  res.write(`event: summary\n`);
  res.write(`data: ${JSON.stringify({ summary: getFilteredSummary() })}\n\n`);
  clients.add(res);
  console.log('SSE client connected, total clients=' + clients.size);
  req.on("close", () => {
    clients.delete(res);
    console.log('SSE client disconnected, total clients=' + clients.size);
  });
});

const port = process.env.PORT || 4000;
// Bind to 0.0.0.0 so devices on the LAN (ESP32, phone, emulator) can reach this server
app.listen(port, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${port}`));

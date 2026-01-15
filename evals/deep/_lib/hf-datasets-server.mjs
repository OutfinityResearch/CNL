import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const BASE_URL = "https://datasets-server.huggingface.co";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${url}: ${text.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err?.message ?? err}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on("error", reject);
  });
}

export async function hfInfo({ dataset, timeoutMs = 60000 }) {
  const url = `${BASE_URL}/info?dataset=${encodeURIComponent(dataset)}`;
  return getJson(url, { timeoutMs });
}

export async function hfRows({ dataset, config, split, offset, length, timeoutMs = 60000 }) {
  const url =
    `${BASE_URL}/rows?dataset=${encodeURIComponent(dataset)}` +
    `&config=${encodeURIComponent(config)}` +
    `&split=${encodeURIComponent(split)}` +
    `&offset=${encodeURIComponent(String(offset))}` +
    `&length=${encodeURIComponent(String(length))}`;
  return getJson(url, { timeoutMs });
}

export function defaultCacheDirFromSuiteDir(suiteDir) {
  // suiteDir = <repo>/evals/deep/<suite-id>
  // cache root = <repo>/evals/deep/cache/<suite-id>
  return path.join(path.dirname(suiteDir), "cache", path.basename(suiteDir));
}

export async function ensureRowsCached({
  suiteDir,
  cacheKey,
  dataset,
  config,
  split,
  maxRows = null,
  pageSize = 100,
  timeoutMs = 60000,
}) {
  const cacheDir = defaultCacheDirFromSuiteDir(suiteDir);
  ensureDir(cacheDir);

  const outJsonl = path.join(cacheDir, `${cacheKey}.jsonl`);
  const outMeta = path.join(cacheDir, `${cacheKey}.meta.json`);

  if (fs.existsSync(outJsonl)) {
    return { jsonlPath: outJsonl, metaPath: outMeta, cached: true };
  }

  // Backward-compatible seeding:
  // If we previously cached keyed-by-limit files, seed the canonical cache file
  // and then fetch additional pages until maxRows is satisfied.
  // Example legacy name: "<cacheKey>__limit-20.jsonl"
  const legacy = (fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [])
    .filter((f) => f.startsWith(`${cacheKey}__limit-`) && f.endsWith(".jsonl"))
    .map((f) => {
      const m = f.match(/__limit-(\d+)\.jsonl$/);
      const limit = m ? Number(m[1]) : 0;
      return { file: f, limit };
    })
    .sort((a, b) => b.limit - a.limit);

  let numTotal = null;
  let written = 0;
  let offset = 0;
  let seededFromLegacy = null;

  if (legacy.length > 0 && maxRows) {
    const picked = legacy[0];
    const legacyPath = path.join(cacheDir, picked.file);
    const raw = fs.readFileSync(legacyPath, "utf8");
    const lines = raw.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
    const seedCount = Math.min(lines.length, maxRows);

    // Create canonical jsonl from legacy (exclusive create), then append new rows.
    fs.copyFileSync(legacyPath, outJsonl, fs.constants.COPYFILE_EXCL);
    written = seedCount;
    offset = seedCount;
    seededFromLegacy = { file: picked.file, rows: seedCount };

    if (written >= maxRows) {
      const meta = {
        dataset,
        config,
        split,
        pageSize,
        maxRows,
        rowsWritten: written,
        numRowsTotal: null,
        fetchedAt: new Date().toISOString(),
        seededFromLegacy,
      };
      fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2) + "\n", "utf8");
      return { jsonlPath: outJsonl, metaPath: outMeta, cached: false, seededFromLegacy };
    }
  }

  const stream = fs.createWriteStream(outJsonl, { flags: seededFromLegacy ? "a" : "wx" });

  try {
    while (true) {
      const batch = await hfRows({ dataset, config, split, offset, length: pageSize, timeoutMs });
      if (numTotal === null) numTotal = batch.num_rows_total ?? null;
      const rows = batch.rows || [];
      for (const entry of rows) {
        stream.write(JSON.stringify(entry.row) + "\n");
        written += 1;
        if (maxRows && written >= maxRows) break;
      }
      if (maxRows && written >= maxRows) break;
      offset += rows.length;
      if (rows.length === 0) break;
      if (numTotal !== null && offset >= numTotal) break;
    }
  } catch (err) {
    stream.close();
    try {
      fs.unlinkSync(outJsonl);
    } catch {
      // ignore
    }
    throw err;
  }

  await new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });

  const meta = {
    dataset,
    config,
    split,
    pageSize,
    maxRows,
    rowsWritten: written,
    numRowsTotal: numTotal,
    fetchedAt: new Date().toISOString(),
    ...(seededFromLegacy ? { seededFromLegacy } : {}),
  };
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2) + "\n", "utf8");

  return { jsonlPath: outJsonl, metaPath: outMeta, cached: false };
}

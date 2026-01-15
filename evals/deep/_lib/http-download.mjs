import fs from "node:fs";
import path from "node:path";
import https from "node:https";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function requestOnce(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const headers = options.headers ?? {};

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers, timeout: timeoutMs },
      (res) => resolve(res),
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
  });
}

async function downloadWithRedirects(url, options = {}) {
  const maxRedirects = options.maxRedirects ?? 5;
  let current = url;

  for (let i = 0; i <= maxRedirects; i += 1) {
    const res = await requestOnce(current, options);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;

    if ([301, 302, 303, 307, 308].includes(status) && location) {
      res.resume();
      current = new URL(location, current).toString();
      continue;
    }

    if (status < 200 || status >= 300) {
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString("utf8").slice(0, 500);
      throw new Error(`HTTP ${status} for ${current}. Body (first 500 chars): ${body}`);
    }

    return { res, finalUrl: current };
  }

  throw new Error(`Too many redirects for ${url}`);
}

export async function downloadToFile(url, outPath, options = {}) {
  ensureDir(path.dirname(outPath));
  const { res, finalUrl } = await downloadWithRedirects(url, options);

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath);
    res.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { finalUrl, outPath };
}


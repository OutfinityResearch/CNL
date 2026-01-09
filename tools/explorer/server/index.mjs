import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, initSession } from './api.mjs';

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '../client');

async function serveStatic(res, filePath) {
  try {
    const fullPath = path.join(CLIENT_DIR, filePath === '/' ? 'index.html' : filePath);
    // Security check to prevent directory traversal
    if (!fullPath.startsWith(CLIENT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const content = await fs.readFile(fullPath);
    const ext = path.extname(fullPath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      console.error(err);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
}

async function startServer() {
  await initSession(); // Initialize the CNL Session

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // API Routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, res, url);
    }

    // Static Files
    if (req.method === 'GET') {
      return serveStatic(res, url.pathname);
    }

    res.writeHead(405);
    res.end('Method Not Allowed');
  });

  server.listen(PORT, () => {
    console.log(`CNL KB Explorer running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

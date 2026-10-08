import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const indexHtml = path.join(distDir, 'index.html');

// Build if dist does not exist yet
if (!fs.existsSync(indexHtml)) {
  console.log('Dist directory not found, running build script...');
  execFileSync('node', ['build.js'], { stdio: 'inherit' });
}

const app = express();

// Parse CLI flags (--port 3000 --host 0.0.0.0) or environment variables
let PORT = process.env.PORT || 3000;
let HOST = process.env.HOST || '0.0.0.0';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10);
  }
  if ((args[i] === '--host' || args[i] === '-h') && args[i + 1]) {
    HOST = args[i + 1];
  }
}

// Middleware for relaxed headers suited for iframe embedding and WASM execution
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow running inside iFrames
  res.removeHeader('X-Frame-Options');
  next();
});

// Live enhance directory (serve directly from enhance/src during development)
const enhanceSrcDir = path.join(__dirname, 'enhance', 'src');
if (fs.existsSync(enhanceSrcDir)) {
  app.use('/enhance', express.static(enhanceSrcDir, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
}

// Serve static assets from dist
app.use(express.static(distDir, {
  etag: true,
  maxAge: '0',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.webmanifest') || filePath.endsWith('.manifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    } else if (filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
  }
}));

// SPA routing fallback
app.use((req, res) => {
  if (fs.existsSync(indexHtml)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`AVGUST CARE 360 server running on http://${HOST}:${PORT}`);
});

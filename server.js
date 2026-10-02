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
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Set proper MIME types
express.static.mime.define({
  'application/wasm': ['wasm'],
  'application/manifest+json': ['webmanifest'],
  'font/woff2': ['woff2'],
  'image/svg+xml': ['svg']
});

// Middleware for relaxed headers suited for iframe embedding and WASM execution
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow running inside iFrames
  res.removeHeader('X-Frame-Options');
  next();
});

// Serve static assets
app.use(express.static(distDir, {
  etag: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// SPA routing fallback
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`AVGUST CARE 360 server running on http://${HOST}:${PORT}`);
});

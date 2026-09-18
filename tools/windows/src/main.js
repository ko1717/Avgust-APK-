/**
 * AVGUST CARE 360 — shell Electron para Windows.
 * Sirve la misma UI web del APK (desktop/ui) con persistencia local vía
 * AvgustFileBridge → archivo sqlite en userData.
 */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const VERSION = app.getVersion();
const UI_ROOT = path.join(__dirname, "..", "ui");
const STORE_FILE = () => path.join(app.getPath("userData"), "avgust-care360.sqlite");
const STORE_TMP = () => STORE_FILE() + ".tmp";

/** @type {Buffer} */
let pendingStore = Buffer.alloc(0);
/** @type {import('http').Server | null} */
let server = null;
let serverPort = 0;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0].split("#")[0]);
  const rel = decoded.replace(/^\/+/, "") || "index.html";
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(path.normalize(root + path.sep)) && full !== path.normalize(root)) {
    return null;
  }
  return full;
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let filePath = safeJoin(UI_ROOT, req.url || "/");
        if (!filePath) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
        if (!fs.existsSync(filePath)) {
          // SPA fallback
          filePath = path.join(UI_ROOT, "index.html");
        }
        const ext = path.extname(filePath).toLowerCase();
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        res.end(data);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err && err.message ? err.message : err));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      serverPort = typeof addr === "object" && addr ? addr.port : 0;
      resolve(serverPort);
    });
    server.on("error", reject);
  });
}

function registerStoreBridge() {
  ipcMain.on("c360:storeLength", (event) => {
    try {
      const file = STORE_FILE();
      event.returnValue = fs.existsSync(file) ? fs.statSync(file).size : 0;
    } catch {
      event.returnValue = 0;
    }
  });

  ipcMain.on("c360:storeSlice", (event, start, end) => {
    try {
      const file = STORE_FILE();
      if (!fs.existsSync(file)) {
        event.returnValue = "";
        return;
      }
      const fd = fs.openSync(file, "r");
      try {
        const len = Math.max(0, (end | 0) - (start | 0));
        const buf = Buffer.alloc(len);
        const read = fs.readSync(fd, buf, 0, len, start | 0);
        event.returnValue = buf.subarray(0, read).toString("base64");
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      event.returnValue = "";
    }
  });

  ipcMain.on("c360:storeStart", (event) => {
    try {
      pendingStore = Buffer.alloc(0);
      if (fs.existsSync(STORE_TMP())) fs.unlinkSync(STORE_TMP());
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("c360:storeAppend", (event, chunkB64) => {
    try {
      const chunk = Buffer.from(String(chunkB64 || ""), "base64");
      pendingStore = Buffer.concat([pendingStore, chunk]);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("c360:storeCommit", (event) => {
    try {
      const tmp = STORE_TMP();
      const finalPath = STORE_FILE();
      fs.mkdirSync(path.dirname(finalPath), { recursive: true });
      fs.writeFileSync(tmp, pendingStore);
      fs.renameSync(tmp, finalPath);
      pendingStore = Buffer.alloc(0);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: `AVGUST CARE 360 v${VERSION}`,
    backgroundColor: "#f5f5f6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await win.loadURL(`http://127.0.0.1:${serverPort}/`);
  return win;
}

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(UI_ROOT, "index.html"))) {
    throw new Error(
      "No se encontró tools/windows/ui/. Ejecuta tools/build-windows.sh primero."
    );
  }
  registerStoreBridge();
  await startStaticServer();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
  }
  if (process.platform !== "darwin") app.quit();
});

// Silenciar referencia no usada en empaquetado (pathToFileURL queda disponible).
void pathToFileURL;

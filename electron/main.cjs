const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 45173;

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'text/javascript',
  '.mjs':   'text/javascript',
  '.css':   'text/css',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.json':  'application/json',
};

function startServer(distDir) {
  const server = http.createServer((req, res) => {
    const urlPath  = req.url.split('?')[0];
    let   filePath = path.join(distDir, urlPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('error', () => {}); // port already in use (second window) — fine
  server.listen(PORT);
  return server;
}

function createWindow() {
  const win = new BrowserWindow({
    width:    1300,
    height:   860,
    minWidth: 900,
    minHeight: 600,
    title: 'After AD',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  win.loadURL(isDev ? 'http://localhost:5173' : `http://localhost:${PORT}`);

  // Open external links (e.g. openai.com) in the default browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

let server;

app.whenReady().then(() => {
  const distDir = app.isPackaged
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '../dist');

  server = startServer(distDir);
  createWindow();
});

app.on('before-quit', () => server?.close());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const avatarsDir = path.join(publicDir, 'avatars');

// ---- Config ----
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const WORLD_W = 2000;
const WORLD_H = 1400;
const HEAR_RADIUS = 300; // px: only players within this distance receive chat
const PLAYER_SPEED = 260; // px/s (used by the client; sent in welcome)
const TICK_RATE = 20; // state broadcasts per second
const MAX_NAME = 20;
const MAX_CHAT = 200;
const CHAT_MIN_INTERVAL = 250; // ms between messages
const CHAT_BURST = 8; // max messages per 10s window

const AVATAR_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ---- Helpers ----
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function cleanText(value, max) {
  // Strip control chars, trim, and cap length. (Display is via textContent /
  // canvas fillText on the client, so this is belt-and-suspenders.)
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function listAvatars() {
  try {
    return fs
      .readdirSync(avatarsDir)
      .filter((f) => !f.startsWith('.') && AVATAR_EXT.has(path.extname(f).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

// ---- Static file server ----
function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(publicDir, rel));
  if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/avatars') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ avatars: listAvatars() }));
    return;
  }
  serveStatic(url.pathname, res);
});

// ---- Realtime ----
const wss = new WebSocketServer({ server });
/** @type {Map<string, any>} */
const players = new Map();
let counter = 0;

const sendTo = (ws, obj) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
};

function handle(p, ws, msg) {
  switch (msg.type) {
    case 'join': {
      if (p.joined) break;
      p.name = cleanText(msg.name, MAX_NAME) || 'Player';
      const avatars = listAvatars();
      p.avatar = avatars.includes(msg.avatar) ? msg.avatar : avatars[0] || '';
      p.x = rand(150, WORLD_W - 150);
      p.y = rand(150, WORLD_H - 150);
      p.facing = 1;
      p.joined = true;
      sendTo(ws, {
        type: 'welcome',
        id: p.id,
        config: { worldW: WORLD_W, worldH: WORLD_H, hearRadius: HEAR_RADIUS, speed: PLAYER_SPEED },
        you: { x: Math.round(p.x), y: Math.round(p.y), name: p.name, avatar: p.avatar },
      });
      break;
    }
    case 'move': {
      if (!p.joined) break;
      const x = Number(msg.x);
      const y = Number(msg.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        p.x = clamp(x, 0, WORLD_W);
        p.y = clamp(y, 0, WORLD_H);
      }
      const f = Number(msg.facing);
      if (f === 1 || f === -1) p.facing = f;
      break;
    }
    case 'chat': {
      if (!p.joined) break;
      const now = Date.now();
      p.chatTimes = (p.chatTimes || []).filter((t) => now - t < 10000);
      if (p.chatTimes.length >= CHAT_BURST) break;
      if (p.lastChat && now - p.lastChat < CHAT_MIN_INTERVAL) break;
      const text = cleanText(msg.text, MAX_CHAT);
      if (!text) break;
      p.lastChat = now;
      p.chatTimes.push(now);
      const out = JSON.stringify({ type: 'chat', id: p.id, name: p.name, text, ts: now });
      const r2 = HEAR_RADIUS * HEAR_RADIUS;
      for (const q of players.values()) {
        if (!q.joined) continue;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        if (dx * dx + dy * dy <= r2 && q.ws.readyState === q.ws.OPEN) q.ws.send(out);
      }
      break;
    }
    default:
      break;
  }
}

wss.on('connection', (ws) => {
  const id = 'p' + ++counter;
  const p = { id, ws, name: '', avatar: '', x: 0, y: 0, facing: 1, joined: false, chatTimes: [], lastChat: 0 };
  players.set(id, p);

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    handle(p, ws, msg);
  });

  ws.on('close', () => {
    players.delete(id);
    const out = JSON.stringify({ type: 'leave', id });
    for (const q of players.values()) {
      if (q.joined && q.ws.readyState === q.ws.OPEN) q.ws.send(out);
    }
  });

  ws.on('error', () => {});
});

// Broadcast authoritative snapshots.
setInterval(() => {
  const list = [];
  for (const p of players.values()) {
    if (!p.joined) continue;
    list.push({ id: p.id, name: p.name, avatar: p.avatar, x: Math.round(p.x), y: Math.round(p.y), facing: p.facing });
  }
  const msg = JSON.stringify({ type: 'state', players: list });
  for (const p of players.values()) {
    if (p.joined && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}, 1000 / TICK_RATE);

// Drop dead connections.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, 30000);

server.listen(PORT, HOST, () => {
  console.log('Walk & Chat server running.');
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  Network: http://${ip}:${PORT}  (share this with players on your Wi‑Fi/LAN)`);
  }
  console.log('Press Ctrl+C to stop.');
});

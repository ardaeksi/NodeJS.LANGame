import { getAvatarImage } from './avatars.js';

const AVATAR_R = 28;
const BUBBLE_MS = 5000;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const KEYS = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
};

function colorFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 55%)`;
}

export class Game {
  constructor(canvas, net, welcome) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.net = net;

    this.world = { w: welcome.config.worldW, h: welcome.config.worldH };
    this.hearRadius = welcome.config.hearRadius || 300;
    this.speed = welcome.config.speed || 260;

    this.meId = welcome.id;
    this.me = {
      id: welcome.id,
      name: welcome.you.name,
      avatar: welcome.you.avatar,
      x: welcome.you.x,
      y: welcome.you.y,
      facing: 1,
    };

    // id -> { id, name, avatar, x, y (target), rx, ry (rendered), facing, bubbleText, bubbleExpire }
    this.players = new Map();
    this.players.set(this.meId, {
      ...this.me,
      rx: this.me.x,
      ry: this.me.y,
      bubbleText: '',
      bubbleExpire: 0,
    });

    this.keys = new Set();
    this.cam = { x: 0, y: 0 };
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.running = false;
    this.last = 0;

    this.lastSent = 0;
    this.lastSentX = null;
    this.lastSentY = null;

    this.chatInput = document.getElementById('chatinput');
    this.chatLog = document.getElementById('chatlog');
    this.fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';

    this._kd = this._onKeyDown.bind(this);
    this._ku = this._onKeyUp.bind(this);
    this._rz = this.resize.bind(this);
    this._loop = this._frame.bind(this);
    this._chatKey = this._onChatKey.bind(this);
    this._blur = () => this.keys.clear();
  }

  start() {
    this.running = true;
    this.last = performance.now();
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('resize', this._rz);
    window.addEventListener('blur', this._blur);
    this.chatInput.addEventListener('keydown', this._chatKey);
    this.resize();
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('resize', this._rz);
    window.removeEventListener('blur', this._blur);
    this.chatInput.removeEventListener('keydown', this._chatKey);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.viewW = w;
    this.viewH = h;
  }

  // ---------- input ----------
  _typing() {
    return document.activeElement === this.chatInput;
  }

  _onKeyDown(e) {
    if (this._typing()) return;
    const k = e.key.toLowerCase();
    if (k === 'enter') {
      e.preventDefault();
      this.keys.clear();
      this.chatInput.focus();
      return;
    }
    if (
      KEYS.up.includes(k) ||
      KEYS.down.includes(k) ||
      KEYS.left.includes(k) ||
      KEYS.right.includes(k)
    ) {
      e.preventDefault();
      this.keys.add(k);
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  _onChatKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (text) this.net.send({ type: 'chat', text });
      this.chatInput.value = '';
      this.chatInput.blur();
    } else if (e.key === 'Escape') {
      this.chatInput.value = '';
      this.chatInput.blur();
    }
  }

  _has(dir) {
    for (const k of KEYS[dir]) if (this.keys.has(k)) return true;
    return false;
  }

  // ---------- network events ----------
  onState(m) {
    const seen = new Set();
    for (const sp of m.players || []) {
      seen.add(sp.id);
      if (sp.id === this.meId) continue; // local player is client-authoritative
      let p = this.players.get(sp.id);
      if (!p) {
        this.players.set(sp.id, {
          id: sp.id,
          name: sp.name,
          avatar: sp.avatar,
          x: sp.x,
          y: sp.y,
          rx: sp.x,
          ry: sp.y,
          facing: sp.facing,
          bubbleText: '',
          bubbleExpire: 0,
        });
      } else {
        p.name = sp.name;
        p.avatar = sp.avatar;
        p.x = sp.x;
        p.y = sp.y;
        p.facing = sp.facing;
      }
    }
    for (const id of this.players.keys()) {
      if (id !== this.meId && !seen.has(id)) this.players.delete(id);
    }
  }

  onChat(m) {
    const p = this.players.get(m.id);
    if (p) {
      p.bubbleText = m.text;
      p.bubbleExpire = performance.now() + BUBBLE_MS;
    }
    this._addLog(m.name, m.text, m.id === this.meId);
  }

  onLeave(m) {
    if (m.id !== this.meId) this.players.delete(m.id);
  }

  _addLog(name, text, self) {
    const line = document.createElement('div');
    line.className = 'line' + (self ? ' self' : '');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = name + ': ';
    const body = document.createElement('span');
    body.textContent = text; // textContent => no HTML injection
    line.appendChild(who);
    line.appendChild(body);
    this.chatLog.appendChild(line);
    while (this.chatLog.children.length > 80) this.chatLog.removeChild(this.chatLog.firstChild);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  // ---------- loop ----------
  _frame(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
    this.last = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    let vx = 0;
    let vy = 0;
    if (this._has('up')) vy -= 1;
    if (this._has('down')) vy += 1;
    if (this._has('left')) vx -= 1;
    if (this._has('right')) vx += 1;
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
      this.me.x = clamp(this.me.x + vx * this.speed * dt, 0, this.world.w);
      this.me.y = clamp(this.me.y + vy * this.speed * dt, 0, this.world.h);
      if (vx < 0) this.me.facing = -1;
      else if (vx > 0) this.me.facing = 1;
    }

    // keep my own entry in sync (no smoothing for self)
    const meE = this.players.get(this.meId);
    if (meE) {
      meE.x = meE.rx = this.me.x;
      meE.y = meE.ry = this.me.y;
      meE.facing = this.me.facing;
      meE.name = this.me.name;
      meE.avatar = this.me.avatar;
    }

    // smooth everyone else toward their latest server position
    const a = Math.min(1, dt * 12);
    for (const p of this.players.values()) {
      if (p.id === this.meId) continue;
      p.rx += (p.x - p.rx) * a;
      p.ry += (p.y - p.ry) * a;
    }

    // throttle movement updates to the server
    const now = performance.now();
    if (now - this.lastSent > 50 && (this.me.x !== this.lastSentX || this.me.y !== this.lastSentY)) {
      this.net.send({ type: 'move', x: Math.round(this.me.x), y: Math.round(this.me.y), facing: this.me.facing });
      this.lastSentX = this.me.x;
      this.lastSentY = this.me.y;
      this.lastSent = now;
    }

    // camera follows me, clamped to the room
    this.cam.x = clamp(this.me.x - this.viewW / 2, 0, Math.max(0, this.world.w - this.viewW));
    this.cam.y = clamp(this.me.y - this.viewH / 2, 0, Math.max(0, this.world.h - this.viewH));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(-this.cam.x, -this.cam.y);

    this._drawWorld(ctx);

    // hearing radius around me, so proximity chat is visible
    ctx.beginPath();
    ctx.arc(this.me.x, this.me.y, this.hearRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99,102,241,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    const now = performance.now();
    const list = [...this.players.values()].sort((p1, p2) => p1.ry - p2.ry);
    for (const p of list) this._drawPlayer(ctx, p, now);
  }

  _drawWorld(ctx) {
    const { w, h } = this.world;
    ctx.fillStyle = '#121a33';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 100) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#3a4569';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }

  _drawPlayer(ctx, p, now) {
    const x = p.rx;
    const y = p.ry;
    const R = AVATAR_R;
    const isMe = p.id === this.meId;

    // shadow
    ctx.beginPath();
    ctx.ellipse(x, y + R + 4, R * 0.8, R * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // avatar (circular)
    const img = p.avatar ? getAvatarImage(p.avatar) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max((2 * R) / img.naturalWidth, (2 * R) / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = colorFor(p.name || p.id);
      ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${R}px ${this.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((p.name || '?').charAt(0).toUpperCase(), x, y + 1);
    }
    ctx.restore();

    // ring
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = isMe ? '#34d399' : 'rgba(255,255,255,0.65)';
    ctx.stroke();

    // name
    this._drawLabel(ctx, p.name || 'Player', x, y + R + 14);

    // speech bubble
    if (p.bubbleText && now < p.bubbleExpire) {
      this._drawBubble(ctx, p.bubbleText, x, y - R - 10, p.bubbleExpire - now);
    }
  }

  _drawLabel(ctx, text, x, y) {
    ctx.font = `600 13px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this._roundRect(ctx, x - w / 2, y - 10, w, 20, 8);
    ctx.fill();
    ctx.fillStyle = '#e8ecf6';
    ctx.fillText(text, x, y + 1);
  }

  _drawBubble(ctx, text, cx, bottomY, remaining) {
    ctx.font = `13px ${this.fontFamily}`;
    const maxW = 200;
    const lines = this._wrap(ctx, text, maxW);
    const lineH = 17;
    const padX = 10;
    const padY = 8;
    let tw = 0;
    for (const ln of lines) tw = Math.max(tw, ctx.measureText(ln).width);
    const bw = Math.min(maxW, tw) + padX * 2;
    const bh = lines.length * lineH + padY * 2;
    const x = cx - bw / 2;
    const y = bottomY - bh;

    const alpha = remaining < 600 ? Math.max(0, remaining / 600) : 1;
    ctx.globalAlpha = alpha;

    ctx.fillStyle = '#f5f7ff';
    this._roundRect(ctx, x, y, bw, bh, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 7, y + bh);
    ctx.lineTo(cx + 7, y + bh);
    ctx.lineTo(cx, y + bh + 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0b1020';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((ln, i) => ctx.fillText(ln, cx, y + padY + i * lineH));
    ctx.globalAlpha = 1;
  }

  _wrap(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 5);
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

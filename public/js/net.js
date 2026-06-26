// Tiny WebSocket wrapper with a pub/sub API keyed by server message `type`.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
  }

  on(type, cb) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(cb);
  }

  emit(type, data) {
    const list = this.handlers.get(type);
    if (list) for (const cb of list) cb(data);
  }

  connect() {
    // Connect back to whatever host served the page (works on localhost + LAN).
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.addEventListener('open', () => this.emit('open'));
    this.ws.addEventListener('close', () => this.emit('close'));
    this.ws.addEventListener('error', (e) => this.emit('error', e));
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg && typeof msg.type === 'string') this.emit(msg.type, msg);
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}

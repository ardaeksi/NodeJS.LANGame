# Walk & Chat

A tiny 2D "walk around and chat" room. Pick a name and an avatar, move with the
keyboard, and talk to people near you (proximity chat with speech bubbles).

- **Client:** plain HTML5 Canvas + vanilla JS (no build step).
- **Server:** Node.js + WebSockets (`ws`). The same process serves the page,
  the avatar images, and the realtime connection.
- **Only dependency:** `ws`.
- **Suggested version:** `0.1.0` for the initial release, with `0.2.0` for
  new features and `0.1.x` for bug fixes.

## Run it locally

```
npm install
npm start
```

Then open <http://localhost:3000> in your browser. Open a second tab (or another
browser) to see two players move and chat at once.

## Play with others on your network (LAN)

1. Start the server (`npm start`). It prints a `Network:` URL, e.g.
   `http://192.168.1.23:3000`.
2. Make sure everyone is on the **same Wi‑Fi/LAN**.
3. Each player opens that `http://<your-ip>:3000` URL.
4. **Windows firewall:** the first time you run it, Windows may pop up "Allow
   Node.js to communicate on these networks" — allow **Private networks**. If you
   missed it, allow `node` in Windows Defender Firewall, or temporarily test with
   the firewall prompt enabled.

> Find your IP manually with `ipconfig` (look for the IPv4 address of your active
> adapter) if the printed one isn't reachable.

## Choosing / adding avatars

Avatars are just image files in `public/avatars/`. Supported types: `.png`,
`.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`.

- Drop your own images into `public/avatars/`.
- Refresh the page — they show up in the avatar picker automatically (the server
  reads the folder live; no restart needed).
- Square images look best (they're shown in a circle).

Six starter characters are included so it works out of the box.

## Controls

- **Move:** `W A S D` or the arrow keys.
- **Chat:** press **Enter** to focus the chat box, type, press **Enter** to send
  (**Esc** to cancel). Only players within the hearing radius see your message.

## Configuration

Edit the constants at the top of `server/server.js`:

- `WORLD_W`, `WORLD_H` — room size in pixels (default 2000 × 1400).
- `HEAR_RADIUS` — how close you must be to hear chat (default 300).
- `PLAYER_SPEED` — walk speed in px/s (default 260).
- `TICK_RATE` — position updates per second (default 20).
- `PORT` — listen port (or set the `PORT` env var).

## How it works

- The browser connects a WebSocket back to whatever host served the page, so LAN
  players don't configure anything.
- The client predicts your own movement locally and smooths everyone else between
  the server's 20 Hz snapshots.
- The **server** is authoritative: it clamps positions to the room, sanitizes and
  rate-limits chat, and only forwards a message to players within `HEAR_RADIUS`.

## Logic flow

1. Client loads `index.html` and requests avatar options from the server.
2. User enters a name, selects an avatar, and joins the room.
3. The client opens a WebSocket connection to the server.
4. User input is translated into movement commands and sent to the server.
5. The server updates the authoritative player state on every tick.
6. The server broadcasts periodic position snapshots and nearby chat messages.
7. The client renders the world, shows avatars and speech bubbles, and
   interpolates remote players between updates.


Future development ideas:

- Add persistent player accounts and session storage.
- Support multiple rooms or private lobbies.
- Add obstacles, collision detection, and better map layout.
- Improve UI for mobile and add touch controls.
- Support internet hosting and NAT traversal instead of LAN-only.
- Add audio chat, reactions, or richer chat bubbles.

## Project layout

```
walk-chat-room/
├─ server/server.js     # static server + avatar API + WebSocket game loop
├─ public/
│  ├─ index.html
│  ├─ style.css
│  ├─ js/{main,net,game,avatars}.js
│  └─ avatars/          # drop your avatar images here
├─ package.json
└─ README.md
```

## Not included (yet)

Accounts, persistence, multiple rooms, obstacles/collisions, mobile touch
controls, and internet (non-LAN) hosting. The code is intentionally small so
these are easy to add later.

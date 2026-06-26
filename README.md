# Walk & Chat

A tiny 2D game where people on the same network can walk around and chat.
Pick a name and an avatar, move with the keyboard, and speak with players who
are nearby.

## Quick start for anyone

1. Download and install Node.js:
   - Go to https://nodejs.org
   - Download the **LTS** version for Windows, macOS, or Linux.
   - Run the installer and accept the default options.
2. Open the folder for this project:
   - On Windows: open File Explorer, go to the project folder, then `Shift` +
     right-click an empty area and choose **Open PowerShell window here** or
     **Open in Terminal**.
3. Install the project dependencies:

   ```bash
   npm install
   ```

4. Start the game server:

   ```bash
   npm start
   ```

5. Open your web browser and go to:

   ```text
   http://localhost:3000
   ```

6. To play with others on the same Wi‑Fi/LAN, share the **Network** URL printed
   in the terminal.

## Does Node.js need special network permission?

- The project requires Node.js to be installed separately; it does not ship
  with Node built in.
- When the server starts, Windows may ask to allow `node.exe` on your network.
- If that happens, choose **Allow access** and allow it for **Private networks**.
- Node.js does not automatically open on private networks without this permission.
- If you miss the prompt, you can allow `node.exe` in Windows Defender Firewall
  later.

## What the project does

- **Client:** browser page with HTML, CSS, and JavaScript.
- **Server:** Node.js app in `server/server.js`.
- **Network:** players on the same local network can connect and walk/chat.

## Run it locally

In the project folder:

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser. Open a second tab or another
browser to see two players at once.

## Play with others on your network (LAN)

1. Start the server (`npm start`). It prints a `Network:` URL, for example:
   `http://192.168.1.23:3000`.
2. Make sure everyone is on the **same Wi‑Fi/LAN**.
3. Each player opens the printed `http://<your-ip>:3000` URL.
4. If Windows prompts for firewall permission, allow **Private networks**.

> If the printed IP is unreachable, use `ipconfig` on Windows to find your
> IPv4 address for the active network adapter.

## Selecting avatars

Avatars are image files in `public/avatars/`.

- Supported file types: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`.
- Drop your own images into `public/avatars/`.
- Refresh the browser page and the new avatars appear automatically.
- Square images look best because the game displays them in a circle.

## Controls

- **Move:** `W A S D` or arrow keys.
- **Chat:** press **Enter** to type, then **Enter** again to send.
- Press **Esc** to cancel typing.
- Only players within the hearing radius see your message.

## Configuration

Edit the constants at the top of `server/server.js`:

- `WORLD_W`, `WORLD_H` — room size in pixels (default 2000 × 1400).
- `HEAR_RADIUS` — how close you must be to hear chat (default 300).
- `PLAYER_SPEED` — walk speed in px/s (default 260).
- `TICK_RATE` — position updates per second (default 20).
- `PORT` — listen port (or set the `PORT` environment variable).

## How it works

- The browser loads `index.html` from the server.
- The client selects a name and avatar, then opens a WebSocket connection.
- The server manages player positions and forwards chat to nearby players.
- The browser renders the world and smoothly updates other players.

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

## Not included yet

Accounts, persistence, multiple rooms, obstacles/collisions, mobile touch
controls, and internet (non-LAN) hosting are not included yet. The code is kept
small so these can be added later.

import { Net } from './net.js';
import { Game } from './game.js';

const joinEl = document.getElementById('join');
const avatarsEl = document.getElementById('avatars');
const nameEl = document.getElementById('name');
const enterBtn = document.getElementById('enter');
const joinMsg = document.getElementById('joinmsg');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');

let selectedAvatar = null;
let net = null;
let game = null;

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.classList.toggle('ok', !!ok);
}

function updateEnabled() {
  enterBtn.disabled = !(nameEl.value.trim() && selectedAvatar);
}

async function loadAvatars() {
  let list = [];
  try {
    const res = await fetch('api/avatars');
    const data = await res.json();
    list = Array.isArray(data.avatars) ? data.avatars : [];
  } catch {
    list = [];
  }

  avatarsEl.textContent = '';
  if (list.length === 0) {
    const note = document.createElement('div');
    note.className = 'noav';
    note.textContent = 'No avatars found. Add images to public/avatars/ and refresh.';
    avatarsEl.appendChild(note);
    return;
  }

  list.forEach((file, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar';
    btn.title = file;
    const img = document.createElement('img');
    img.src = 'avatars/' + encodeURIComponent(file);
    img.alt = file;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      selectedAvatar = file;
      for (const child of avatarsEl.children) child.classList.remove('sel');
      btn.classList.add('sel');
      updateEnabled();
    });
    avatarsEl.appendChild(btn);
    if (i === 0) {
      selectedAvatar = file;
      btn.classList.add('sel');
    }
  });
  updateEnabled();
}

function enter() {
  if (enterBtn.disabled) return;
  const name = nameEl.value.trim();
  const avatar = selectedAvatar;
  enterBtn.disabled = true;
  joinMsg.textContent = 'Connecting…';
  setStatus('connecting…', false);

  net = new Net();
  net.on('open', () => net.send({ type: 'join', name, avatar }));
  net.on('welcome', (m) => {
    joinMsg.textContent = '';
    joinEl.classList.add('hidden');
    setStatus('connected', true);
    game = new Game(canvas, net, m);
    game.start();
  });
  net.on('state', (m) => game && game.onState(m));
  net.on('chat', (m) => game && game.onChat(m));
  net.on('leave', (m) => game && game.onLeave(m));
  net.on('close', () => {
    setStatus('disconnected', false);
    if (game) {
      game.stop();
      game = null;
    }
    joinEl.classList.remove('hidden');
    joinMsg.textContent = 'Disconnected. Click “Enter room” to rejoin.';
    updateEnabled();
  });
  net.on('error', () => {
    joinMsg.textContent = 'Connection error — is the server running?';
    updateEnabled();
  });
  net.connect();
}

nameEl.addEventListener('input', updateEnabled);
nameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enter();
});
enterBtn.addEventListener('click', enter);

loadAvatars();

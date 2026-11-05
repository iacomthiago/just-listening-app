// Just Listening — player de músicas locais (PWA)
import * as db from './db.js';
import { readTags } from './id3.js';

const VERSION = '1.0.1';

// ---------------------------------------------------------------- utilidades
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const hue = (s) => { let h = 0; for (const c of String(s || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtLong(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim();
}
function fmtMinutes(m) {
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`;
}
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const stroke = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const fill = (d) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
const I = {
  play: fill('<path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z"/>'),
  pause: fill('<rect x="6" y="5" width="4.2" height="14" rx="1.3"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.3"/>'),
  next: fill('<path d="M5 6.3v11.4a1 1 0 0 0 1.55.83L15 12.83a1 1 0 0 0 0-1.66L6.55 5.47A1 1 0 0 0 5 6.3z"/><rect x="16.6" y="5.5" width="2.4" height="13" rx="1.2"/>'),
  prev: fill('<path d="M19 6.3v11.4a1 1 0 0 1-1.55.83L9 12.83a1 1 0 0 1 0-1.66l8.45-5.7A1 1 0 0 1 19 6.3z"/><rect x="5" y="5.5" width="2.4" height="13" rx="1.2"/>'),
  shuffle: stroke('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>'),
  repeat: stroke('<path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  repeatOne: stroke('<path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M10.6 10.2 12.4 9v6" stroke-width="1.9"/>'),
  moon: stroke('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  more: fill('<circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>'),
  plus: stroke('<path d="M12 5v14M5 12h14"/>'),
  minus: stroke('<path d="M5 12h14"/>'),
  back: stroke('<path d="m15 18-6-6 6-6"/>'),
  down: stroke('<path d="m6 9 6 6 6-6"/>'),
  up: stroke('<path d="m18 15-6-6-6 6"/>'),
  note: stroke('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  list: stroke('<path d="M3 6h13M3 12h13M3 18h8"/><circle cx="19" cy="17" r="2"/><path d="M21 17V8"/>'),
  upload: stroke('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  edit: stroke('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: stroke('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
  check: stroke('<path d="M20 6 9 17l-5-5"/>'),
  updown: stroke('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
  goto: stroke('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
};

// ---------------------------------------------------------------- estado
// Dois <audio>: a próxima música começa no segundo player um instante antes da atual
// acabar. Assim o iPhone não desliga o som entre uma faixa e outra com a tela bloqueada.
const players = [$('#audio'), $('#audio2')];
let audio = players[0];
const spare = () => (audio === players[0] ? players[1] : players[0]);
const unlockedEls = new Set();
const LS_KEY = 'just-listening-state';
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
// O iOS não deixa páginas mudarem o volume (audio.volume é sempre 1).
const volumeWorks = (() => { try { const a = document.createElement('audio'); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; } catch { return false; } })();

const state = {
  tracks: new Map(),
  playlists: [],
  view: { name: 'library' }, // library | playlists | playlist (id, reorder)
  q: { source: 'library', ids: [], order: [], pos: -1 },
  currentId: null,
  repeat: 'off', // off | all | one
  shuffle: false,
  fade: true,
};
const timer = { end: 0, fadeMs: 0, endOfTrack: false };
let fadeFactor = 1;

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      repeat: state.repeat, shuffle: state.shuffle, fade: state.fade,
      source: state.q.source, currentId: state.currentId, time: isSilent() ? 0 : audio.currentTime || 0,
    }));
  } catch { /* armazenamento indisponível */ }
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

// ---------------------------------------------------------------- dados
async function loadData() {
  const [tracks, playlists] = await Promise.all([db.getAll('tracks'), db.getAll('playlists')]);
  state.tracks = new Map(tracks.map((t) => [t.id, t]));
  state.playlists = playlists.sort((a, b) => a.createdAt - b.createdAt);
  for (const p of state.playlists) {
    const clean = p.trackIds.filter((id) => state.tracks.has(id));
    if (clean.length !== p.trackIds.length) { p.trackIds = clean; db.put('playlists', p); }
  }
}
const libraryIds = () => [...state.tracks.values()].sort((a, b) => b.addedAt - a.addedAt).map((t) => t.id);
const playlistById = (id) => state.playlists.find((p) => p.id === id);
function sourceIds(src) {
  if (src === 'library') return libraryIds();
  const p = playlistById(src);
  return p ? p.trackIds.filter((id) => state.tracks.has(id)) : null;
}
const sourceName = (src) => (src === 'library' ? 'Todas as músicas' : playlistById(src)?.name || 'Playlist');
const viewSource = () => (state.view.name === 'playlist' ? state.view.id : 'library');

// ---------------------------------------------------------------- capas
const coverUrls = new Map();
const coverDataUrls = new Map();
function coverUrl(t) {
  if (!t?.cover) return null;
  let u = coverUrls.get(t.id);
  if (!u) { u = URL.createObjectURL(new Blob([t.cover.data], { type: t.cover.type })); coverUrls.set(t.id, u); }
  return u;
}
function dropCover(id) {
  const u = coverUrls.get(id);
  if (u) URL.revokeObjectURL(u);
  coverUrls.delete(id);
  coverDataUrls.delete(id);
}
function coverHTML(t, cls = '', key, icon = I.note) {
  const u = coverUrl(t);
  if (u) return `<div class="cover ${cls}"><img src="${u}" alt="" decoding="async"></div>`;
  return `<div class="cover ${cls} noart" style="--h:${hue(key ?? t?.id)}">${icon}</div>`;
}
function coverDataUrl(t) {
  if (coverDataUrls.has(t.id)) return Promise.resolve(coverDataUrls.get(t.id));
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => { coverDataUrls.set(t.id, r.result); resolve(r.result); };
    r.onerror = () => resolve(null);
    r.readAsDataURL(new Blob([t.cover.data], { type: t.cover.type }));
  });
}
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
    img.src = url;
  });
}
// Reduz a capa para no máximo 512px (economiza espaço e memória).
async function shrinkImage(blob, max = 512) {
  try {
    const img = await loadImage(blob);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    return out ? { type: 'image/jpeg', data: await out.arrayBuffer() } : null;
  } catch {
    return null;
  }
}
// Cor média da capa, para o brilho de fundo do player.
async function averageColor(t) {
  const u = coverUrl(t);
  if (!u) return null;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return `${Math.round(r / n)} ${Math.round(gg / n)} ${Math.round(b / n)}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- áudio
// URLs dos arquivos ficam em cache só para a música atual e a próxima,
// assim a troca de faixa com a tela bloqueada acontece sem esperar o banco.
const urlCache = new Map();
async function urlFor(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.get('audio', id);
  if (!rec) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.type || 'audio/mpeg' }));
  urlCache.set(id, url);
  return url;
}
function pruneUrls() {
  const keep = new Set([state.currentId, peekNext()]);
  for (const [id, url] of urlCache) if (!keep.has(id)) { URL.revokeObjectURL(url); urlCache.delete(id); }
}
async function prefetchNext() {
  const n = peekNext();
  if (n && !urlCache.has(n)) await urlFor(n).catch(() => {});
}

// Um som mudo bem curto, usado para "destravar" o áudio no iPhone
// no instante do toque (o iOS exige um gesto para começar a tocar).
const SILENT_URL = (() => {
  const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
})();
const isSilent = (el = audio) => el.src === SILENT_URL;
function silentPlay(el) {
  try {
    el.src = SILENT_URL;
    unlockedEls.add(el);
    const p = el.play();
    if (p) p.catch((err) => { if (err.name === 'NotAllowedError') unlockedEls.delete(el); });
  } catch { unlockedEls.delete(el); }
}
// Chamado sempre num toque do usuário: libera o player reserva para uso futuro.
function unlockSpare() {
  const s = spare();
  if (!unlockedEls.has(s)) silentPlay(s);
}
function unlockFor(id) {
  unlockSpare();
  if (unlockedEls.has(audio) || urlCache.has(id)) return;
  silentPlay(audio);
}

let loadTok = 0;
let pendingSeek = 0;
async function startTrack(id, autoplay, seekTo = 0, swap = false) {
  clearHandoff();
  const tok = ++loadTok;
  let url = urlCache.get(id);
  if (!url) {
    url = await urlFor(id).catch(() => null);
    if (tok !== loadTok) return;
  }
  if (!url) { toast('Não consegui abrir esta música'); return; }
  state.currentId = id;
  pendingSeek = 0;
  const old = audio;
  if (swap && autoplay && unlockedEls.has(spare())) audio = spare();
  if (audio.src !== url) { pendingSeek = seekTo; audio.src = url; } else audio.currentTime = seekTo;
  audio.loop = shouldLoop();
  applyVolume();
  if (autoplay) {
    const p = audio.play();
    if (p) p.catch((err) => { if (err.name !== 'AbortError') console.warn('play()', err); renderControls(); });
  }
  if (audio !== old) { old.loop = false; old.pause(); }
  onTrackChanged();
}

// Troca antecipada de faixa: prepara a próxima no player reserva e começa a tocar
// pouco antes do fim da atual, sem deixar o áudio parar.
let handoffTimer = 0;
function clearHandoff() { clearTimeout(handoffTimer); handoffTimer = 0; }
function checkHandoff() {
  if (audio.paused || audio.loop || isSilent() || timer.endOfTrack) return;
  const d = audio.duration;
  if (!isFinite(d) || d <= 0) return;
  const left = d - audio.currentTime;
  if (left > 4) { clearHandoff(); return; }
  const s = spare();
  if (!unlockedEls.has(s)) return;
  const nid = peekNext();
  const url = nid && urlCache.get(nid);
  if (!url) return;
  if (s.src !== url) { s.src = url; s.preload = 'auto'; s.load(); }
  if (left < 0.9) { handoff(); return; }
  if (!handoffTimer) handoffTimer = setTimeout(handoff, Math.max(0, (left - 0.15) * 1000));
}
function handoff() {
  clearHandoff();
  if (audio.paused || audio.ended || audio.loop || timer.endOfTrack) return;
  const left = audio.duration - audio.currentTime;
  if (!(left < 1.5)) return; // o usuário mudou a posição
  next(true, true);
}
function shouldLoop() {
  if (timer.endOfTrack) return false;
  return state.repeat === 'one' || (state.repeat === 'all' && state.q.order.length === 1);
}
function onTrackChanged() {
  pruneUrls();
  prefetchNext();
  renderNow();
  render();
  updateMediaSession();
  saveState();
}

// ---------------------------------------------------------------- fila
const qid = (p) => state.q.ids[state.q.order[p]];
function buildQueue(ids, currentId) {
  const q = state.q;
  q.ids = ids.slice();
  const order = [...ids.keys()];
  const ci = currentId ? ids.indexOf(currentId) : -1;
  if (state.shuffle) {
    shuffleArr(order);
    if (ci >= 0) { order.splice(order.indexOf(ci), 1); order.unshift(ci); }
    q.pos = ci >= 0 || !currentId ? 0 : -1;
  } else {
    q.pos = ci >= 0 ? ci : currentId ? -1 : 0;
  }
  q.order = order;
}
function syncQueue() {
  let ids = sourceIds(state.q.source);
  if (!ids) { state.q.source = 'library'; ids = libraryIds(); }
  buildQueue(ids, state.currentId);
  audio.loop = shouldLoop();
  pruneUrls();
  prefetchNext();
}
function peekNext() {
  const q = state.q, n = q.order.length;
  if (!n) return null;
  if (state.repeat === 'one' && !timer.endOfTrack) return state.currentId;
  if (q.pos + 1 < n) return qid(q.pos + 1);
  if (state.repeat === 'all') return qid(0);
  return null;
}
function userPlay(src, startId, shuffle) {
  const ids = sourceIds(src);
  if (!ids?.length) return;
  if (startId && startId === state.currentId && state.q.source === src) {
    if (audio.paused) togglePlay();
    openPlayer();
    return;
  }
  if (typeof shuffle === 'boolean') state.shuffle = shuffle;
  state.q.source = src;
  buildQueue(ids, startId || (state.shuffle ? null : ids[0]));
  const id = qid(Math.max(0, state.q.pos));
  state.q.pos = Math.max(0, state.q.pos);
  unlockFor(id);
  startTrack(id, true);
}
function next(auto = false, swap = false) {
  const q = state.q, n = q.order.length;
  if (!n) return;
  if (q.pos + 1 < n) q.pos++;
  else if (state.repeat === 'all' || !auto) q.pos = 0;
  else { // acabou a fila sem repetição
    audio.pause();
    renderControls();
    return;
  }
  const id = qid(q.pos);
  if (!auto) unlockFor(id);
  startTrack(id, true, 0, swap);
}
function prev() {
  const q = state.q;
  if (audio.currentTime > 3 || !q.order.length) { audio.currentTime = 0; return; }
  if (q.pos > 0) q.pos--;
  else if (state.repeat === 'all') q.pos = q.order.length - 1;
  else { audio.currentTime = 0; return; }
  const id = qid(q.pos);
  unlockFor(id);
  startTrack(id, true);
}
function togglePlay() {
  if (!state.currentId) { userPlay(viewSource(), null); return; }
  if (audio.paused || isSilent()) {
    if (!audio.getAttribute('src') || isSilent()) { unlockFor(state.currentId); startTrack(state.currentId, true); return; }
    resetFadeIfIdle();
    unlockSpare();
    const p = audio.play();
    if (p) p.catch(() => {});
  } else {
    audio.pause();
  }
}
function setShuffle(on) {
  state.shuffle = on;
  syncQueue();
  renderControls();
  saveState();
  toast(on ? 'Aleatório ligado' : 'Aleatório desligado');
}
function cycleRepeat() {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  audio.loop = shouldLoop();
  pruneUrls();
  prefetchNext();
  renderControls();
  saveState();
  toast({ off: 'Repetição desligada', all: 'Repetir playlist', one: 'Repetir esta música' }[state.repeat]);
}

// ---------------------------------------------------------------- timer
function setTimer(minutes) {
  const ms = minutes * 60000;
  timer.end = Date.now() + ms;
  timer.fadeMs = Math.min(60000, ms / 3);
  timer.endOfTrack = false;
  fadeFactor = 1; applyVolume();
  audio.loop = shouldLoop();
  renderTimer();
  toast(`A música para em ${fmtMinutes(minutes)}`);
}
function setTimerEndOfTrack() {
  timer.end = 0;
  timer.endOfTrack = true;
  fadeFactor = 1; applyVolume();
  audio.loop = shouldLoop();
  renderTimer();
  toast('A música para quando esta faixa terminar');
}
function cancelTimer() {
  timer.end = 0;
  timer.endOfTrack = false;
  fadeFactor = 1; applyVolume();
  audio.loop = shouldLoop();
  pruneUrls(); prefetchNext();
  renderTimer();
}
function applyVolume() {
  if (volumeWorks) audio.volume = Math.max(0, Math.min(1, fadeFactor * fadeFactor));
}
function resetFadeIfIdle() {
  if (!timer.end && fadeFactor !== 1) { fadeFactor = 1; applyVolume(); }
}
function tickTimer() {
  if (!timer.end) return;
  const left = timer.end - Date.now();
  if (left <= 0) { timerFire(); return; }
  if (state.fade && volumeWorks && left < timer.fadeMs) { fadeFactor = left / timer.fadeMs; applyVolume(); }
  renderTimerLabel(left);
}
function timerFire() {
  audio.pause();
  timer.end = 0;
  timer.endOfTrack = false;
  audio.loop = shouldLoop();
  setTimeout(() => { fadeFactor = 1; applyVolume(); }, 400);
  renderTimer();
  saveState();
  toast('Timer: música pausada. Boa noite!');
}
function renderTimerLabel(left) {
  const label = timer.end ? fmt(Math.ceil(left / 1000)) : timer.endOfTrack ? 'Fim da faixa' : 'Timer';
  $('#timerLabel').textContent = label;
  const tl = $('#tsLeft');
  if (tl) tl.textContent = label;
}
function renderTimer() {
  const on = !!(timer.end || timer.endOfTrack);
  $('#btnTimer').classList.toggle('on', on);
  renderTimerLabel(timer.end - Date.now());
  const badge = $('#miniBadge');
  if (badge) badge.hidden = !on;
}

// ---------------------------------------------------------------- Media Session (tela bloqueada)
const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
async function updateMediaSession() {
  if (!ms) return;
  const t = state.tracks.get(state.currentId);
  if (!t) return;
  const fallbackArt = [{ src: new URL('icons/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }];
  const set = (artwork) => {
    try {
      ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist || 'Just Listening', album: sourceName(state.q.source), artwork });
    } catch { /* ignore */ }
  };
  const cached = t.cover && coverDataUrls.get(t.id);
  set(cached ? [{ src: cached, sizes: '512x512', type: t.cover.type }] : fallbackArt);
  if (t.cover && !cached) {
    const d = await coverDataUrl(t);
    if (d && state.currentId === t.id) set([{ src: d, sizes: '512x512', type: t.cover.type }]);
  }
}
function updatePosition() {
  if (!ms || !('setPositionState' in ms)) return;
  try {
    if (isFinite(audio.duration) && audio.duration > 0) {
      ms.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
    }
  } catch { /* ignore */ }
}
function setupMediaSession() {
  if (!ms) return;
  const h = (action, fn) => { try { ms.setActionHandler(action, fn); } catch { /* não suportado */ } };
  h('play', () => togglePlayFromRemote(true));
  h('pause', () => audio.pause());
  h('stop', () => audio.pause());
  h('previoustrack', () => prev());
  h('nexttrack', () => next(false));
  h('seekto', (d) => { if (d.seekTime != null) { audio.currentTime = d.seekTime; updatePosition(); } });
}
function togglePlayFromRemote() {
  if (audio.paused) togglePlay();
}

// ---------------------------------------------------------------- importação
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm|aiff?|mp4|caf)$/i;
const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf' };
const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const isAudioFile = (f) => (f.type && f.type.startsWith('audio/')) || AUDIO_EXT.test(f.name);
const stripExt = (name) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim();

function probeDuration(blob) {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (d) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(isFinite(d) ? d : 0);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => finish(a.duration);
    a.onerror = () => finish(0);
    setTimeout(() => finish(0), 4000);
    a.src = url;
  });
}

let importTarget = null;
let importing = false;
function pickFiles(pid = null) {
  if (importing) { toast('Aguarde a importação terminar'); return; }
  importTarget = pid;
  const inp = $('#fileInput');
  inp.value = '';
  inp.click();
}
async function importFiles(files, pid) {
  files = files.filter(isAudioFile).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  if (!files.length) { toast('Nenhum arquivo de áudio encontrado'); return; }
  importing = true;
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  const existing = new Map([...state.tracks.values()].map((t) => [`${t.fileName}|${t.size}`, t.id]));
  const base = Date.now();
  const ids = [];
  let added = 0, skipped = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    toast(`Importando ${i + 1} de ${files.length}…`, true);
    const key = `${f.name}|${f.size}`;
    if (existing.has(key)) { skipped++; ids.push(existing.get(key)); continue; }
    try {
      const type = f.type || MIME[extOf(f.name)] || 'audio/mpeg';
      const tags = await readTags(f).catch(() => ({}));
      const data = await f.arrayBuffer();
      const cover = tags.picture ? await shrinkImage(tags.picture) : null;
      const duration = await probeDuration(f);
      const id = uid();
      const t = {
        id,
        title: (tags.title || stripExt(f.name) || 'Sem nome').trim(),
        artist: (tags.artist || '').trim(),
        duration,
        cover,
        fileName: f.name,
        size: f.size,
        type,
        addedAt: base + (files.length - i),
      };
      await db.put('audio', { type, data }, id);
      await db.put('tracks', t);
      state.tracks.set(id, t);
      existing.set(key, id);
      ids.push(id);
      added++;
    } catch (err) {
      console.error('importar', f.name, err);
      failed++;
      if (err && err.name === 'QuotaExceededError') { toast('Acabou o espaço disponível para o app'); break; }
    }
  }
  importing = false;

  const p = pid && playlistById(pid);
  if (p) {
    const add = ids.filter((id) => !p.trackIds.includes(id));
    p.trackIds.push(...add);
    await db.put('playlists', p);
  }
  if (state.q.source === 'library' || (p && state.q.source === p.id)) syncQueue();
  render();

  const parts = [];
  if (added) parts.push(plural(added, 'música importada', 'músicas importadas'));
  if (skipped) parts.push(plural(skipped, 'já existia', 'já existiam'));
  if (failed) parts.push(plural(failed, 'falhou', 'falharam'));
  toast((parts.join(' · ') || 'Nada importado') + (p ? ` → ${p.name}` : ''));
}

// ---------------------------------------------------------------- edição
async function deleteTrack(id) {
  const wasCurrent = id === state.currentId;
  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.currentId = null;
  }
  await db.del('audio', id);
  await db.del('tracks', id);
  state.tracks.delete(id);
  dropCover(id);
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
  for (const p of state.playlists) {
    if (p.trackIds.includes(id)) { p.trackIds = p.trackIds.filter((x) => x !== id); await db.put('playlists', p); }
  }
  syncQueue();
  renderNow();
  render();
  saveState();
  toast('Música excluída');
}
async function addToPlaylist(pid, ids) {
  const p = playlistById(pid);
  if (!p) return;
  const add = ids.filter((id) => !p.trackIds.includes(id));
  p.trackIds.push(...add);
  await db.put('playlists', p);
  if (state.q.source === pid) syncQueue();
  render();
  if (!add.length) toast('Já estava na playlist');
  else toast(add.length === 1 ? `Adicionada em “${p.name}”` : `${add.length} músicas adicionadas em “${p.name}”`);
}
async function removeFromPlaylist(pid, id) {
  const p = playlistById(pid);
  if (!p) return;
  p.trackIds = p.trackIds.filter((x) => x !== id);
  await db.put('playlists', p);
  if (state.q.source === pid) syncQueue();
  render();
  toast('Removida da playlist');
}
async function movePlaylistTrack(pid, i, dir) {
  const p = playlistById(pid);
  const j = i + dir;
  if (!p || j < 0 || j >= p.trackIds.length) return;
  [p.trackIds[i], p.trackIds[j]] = [p.trackIds[j], p.trackIds[i]];
  await db.put('playlists', p);
  if (state.q.source === pid) syncQueue();
  render();
}
async function newPlaylist(ids = []) {
  const name = await promptSheet({ title: 'Nova playlist', placeholder: 'Ex.: Para dormir', ok: 'Criar' });
  if (!name) return;
  const p = { id: uid(), name, trackIds: [...ids], createdAt: Date.now() };
  state.playlists.push(p);
  await db.put('playlists', p);
  if (ids.length) { toast(`Playlist “${name}” criada`); render(); }
  else setView({ name: 'playlist', id: p.id });
}
async function deletePlaylist(pid) {
  state.playlists = state.playlists.filter((p) => p.id !== pid);
  await db.del('playlists', pid);
  if (state.q.source === pid) { state.q.source = 'library'; syncQueue(); renderNow(); }
  setView({ name: 'playlists' });
  toast('Playlist excluída');
}

// ---------------------------------------------------------------- folhas (sheets)
function openSheet(html, mount, cls = '') {
  closeSheet(true);
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  root.classList.add('open');
  const sheet = root.querySelector('.sheet');
  root.querySelector('.backdrop').addEventListener('click', () => closeSheet());
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
  // arrastar a alça para baixo fecha
  let y0 = null;
  sheet.querySelector('.grab').addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 60) closeSheet(); y0 = null; });
  void sheet.offsetHeight;
  root.classList.add('show');
  mount?.(sheet);
  return sheet;
}
function closeSheet(instant) {
  const root = $('#sheetRoot');
  root.classList.remove('show');
  const clear = () => { root.innerHTML = ''; root.classList.remove('open'); };
  if (instant) { clear(); return; }
  setTimeout(() => { if (!root.classList.contains('show')) clear(); }, 260);
}
const sheetOpen = () => $('#sheetRoot').classList.contains('show');

function actionSheet(titleHTML, items) {
  openSheet(
    `${titleHTML ? `<div class="sheet-title">${titleHTML}</div>` : ''}<div class="actions">${items
      .map((it, i) => `<button class="action ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon || ''}<span>${esc(it.label)}</span></button>`)
      .join('')}</div>`,
    (s) => s.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { closeSheet(); items[+b.dataset.i].run(); })),
  );
}
function promptSheet({ title, value = '', placeholder = '', ok = 'Salvar', type = 'text' }) {
  return new Promise((resolve) => {
    openSheet(
      `<h3>${esc(title)}</h3>
      <form class="prompt">
        <input name="v" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done" ${type === 'number' ? 'inputmode="numeric" min="1" max="1440"' : 'maxlength="80"'}>
        <div class="sheet-buttons"><button type="button" class="pill ghost" data-close>Cancelar</button><button class="pill" type="submit">${esc(ok)}</button></div>
      </form>`,
      (s) => {
        const f = s.querySelector('form');
        const inp = f.querySelector('input');
        setTimeout(() => { try { inp.focus(); inp.select(); } catch { /* ignore */ } }, 60);
        f.addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; closeSheet(); resolve(v); });
        s.querySelector('[data-close]').addEventListener('click', () => resolve(null));
      },
    );
  });
}
function confirmSheet({ title, text, ok = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    openSheet(
      `<h3>${esc(title)}</h3><p>${esc(text)}</p>
       <div class="sheet-buttons"><button class="pill ghost" data-close>Cancelar</button><button class="pill ${danger ? 'danger' : ''}" id="cOk">${esc(ok)}</button></div>`,
      (s) => {
        s.querySelector('#cOk').addEventListener('click', () => { closeSheet(); resolve(true); });
        s.querySelector('[data-close]').addEventListener('click', () => resolve(false));
      },
    );
  });
}

function trackMenu(id, src) {
  const t = state.tracks.get(id);
  if (!t) return;
  const items = [
    { label: 'Tocar agora', icon: I.play, run: () => { if (id === state.currentId && state.q.source === src) { if (audio.paused) togglePlay(); } else userPlay(src, id); } },
    { label: 'Adicionar à playlist', icon: I.plus, run: () => addToPlaylistSheet([id]) },
    { label: 'Editar nome e capa', icon: I.edit, run: () => editTrackSheet(id) },
  ];
  if (src !== 'library') items.push({ label: 'Remover desta playlist', icon: I.minus, run: () => removeFromPlaylist(src, id) });
  items.push({
    label: 'Excluir do app', icon: I.trash, danger: true,
    run: async () => {
      if (await confirmSheet({ title: 'Excluir música?', text: `“${t.title}” será apagada deste aparelho e de todas as playlists.`, ok: 'Excluir', danger: true })) deleteTrack(id);
    },
  });
  actionSheet(`${coverHTML(t, 'sm')}<div><div class="t">${esc(t.title)}</div><div class="s">${esc(t.artist || fmt(t.duration))}</div></div>`, items);
}
function playlistMenu(pid) {
  const p = playlistById(pid);
  if (!p) return;
  actionSheet(`<div><div class="t">${esc(p.name)}</div><div class="s">${plural(sourceIds(pid).length, 'música', 'músicas')}</div></div>`, [
    { label: 'Adicionar músicas', icon: I.plus, run: () => addSongsSheet(pid) },
    { label: 'Importar arquivos para esta playlist', icon: I.upload, run: () => pickFiles(pid) },
    { label: 'Reordenar', icon: I.updown, run: () => setView({ name: 'playlist', id: pid, reorder: true }) },
    {
      label: 'Renomear', icon: I.edit,
      run: async () => {
        const n = await promptSheet({ title: 'Renomear playlist', value: p.name });
        if (n) { p.name = n; await db.put('playlists', p); render(); renderNow(); updateMediaSession(); }
      },
    },
    {
      label: 'Excluir playlist', icon: I.trash, danger: true,
      run: async () => {
        if (await confirmSheet({ title: 'Excluir playlist?', text: `“${p.name}” será apagada. As músicas continuam no app.`, ok: 'Excluir', danger: true })) deletePlaylist(pid);
      },
    },
  ]);
}
function addToPlaylistSheet(ids) {
  const items = state.playlists.map((p) => ({ label: p.name, icon: I.list, run: () => addToPlaylist(p.id, ids) }));
  items.unshift({ label: 'Nova playlist…', icon: I.plus, run: () => newPlaylist(ids) });
  actionSheet('<div><div class="t">Adicionar à playlist</div></div>', items);
}
function addSongsSheet(pid) {
  const p = playlistById(pid);
  const all = libraryIds();
  if (!all.length) { toast('Importe músicas primeiro'); return; }
  const sel = new Set();
  openSheet(
    `<div class="sheet-head"><h3>Adicionar a “${esc(p.name)}”</h3><button class="link-btn" id="selAll">Selecionar todas</button></div>
     <ul class="pick-list">${all.map((id) => {
       const t = state.tracks.get(id), has = p.trackIds.includes(id);
       return `<li><label class="pick ${has ? 'has' : ''}"><input type="checkbox" value="${id}" ${has ? 'checked disabled' : ''}>${coverHTML(t, 'xs')}<span class="t">${esc(t.title)}</span><span class="check">${I.check}</span></label></li>`;
     }).join('')}</ul>
     <div class="sheet-buttons"><button class="pill ghost" data-close>Cancelar</button><button class="pill" id="addGo" disabled>Adicionar</button></div>`,
    (s) => {
      const go = s.querySelector('#addGo');
      const refresh = () => { go.disabled = !sel.size; go.textContent = sel.size ? `Adicionar (${sel.size})` : 'Adicionar'; };
      s.querySelector('.pick-list').addEventListener('change', (e) => {
        const c = e.target;
        if (c.checked) sel.add(c.value); else sel.delete(c.value);
        refresh();
      });
      s.querySelector('#selAll').addEventListener('click', () => {
        s.querySelectorAll('.pick input:not(:disabled)').forEach((c) => { c.checked = true; sel.add(c.value); });
        refresh();
      });
      go.addEventListener('click', () => { closeSheet(); addToPlaylist(pid, all.filter((id) => sel.has(id))); });
    },
    'col',
  );
}
function pickCover(cb) {
  const inp = $('#coverInput');
  inp.value = '';
  inp.onchange = () => { const f = inp.files[0]; if (f) cb(f); };
  inp.click();
}
function editTrackSheet(id) {
  const t = state.tracks.get(id);
  if (!t) return;
  let newCover; // undefined = sem mudança, null = remover
  openSheet(
    `<h3>Editar música</h3>
     <div class="edit-cover">
       <div id="ecPrev">${coverHTML(t, 'lg')}</div>
       <div class="edit-cover-btns">
         <button class="pill ghost" id="ecPick">Trocar capa</button>
         <button class="pill ghost" id="ecRemove" ${t.cover ? '' : 'hidden'}>Remover capa</button>
       </div>
     </div>
     <label class="field"><span>Nome</span><input id="ecTitle" type="text" value="${esc(t.title)}" autocomplete="off" maxlength="120"></label>
     <label class="field"><span>Artista</span><input id="ecArtist" type="text" value="${esc(t.artist || '')}" autocomplete="off" maxlength="120" placeholder="Opcional"></label>
     <div class="sheet-buttons"><button class="pill ghost" data-close>Cancelar</button><button class="pill" id="ecSave">Salvar</button></div>`,
    (s) => {
      let previewUrl;
      s.querySelector('#ecPick').addEventListener('click', () => pickCover(async (file) => {
        const c = await shrinkImage(file);
        if (!c) { toast('Não consegui ler essa imagem'); return; }
        newCover = c;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(new Blob([c.data], { type: c.type }));
        s.querySelector('#ecPrev').innerHTML = `<div class="cover lg"><img src="${previewUrl}" alt=""></div>`;
        s.querySelector('#ecRemove').hidden = false;
      }));
      s.querySelector('#ecRemove').addEventListener('click', (e) => {
        newCover = null;
        s.querySelector('#ecPrev').innerHTML = coverHTML(null, 'lg', t.id);
        e.currentTarget.hidden = true;
      });
      s.querySelector('#ecSave').addEventListener('click', async () => {
        t.title = s.querySelector('#ecTitle').value.trim() || t.title;
        t.artist = s.querySelector('#ecArtist').value.trim();
        if (newCover !== undefined) { t.cover = newCover; dropCover(id); }
        await db.put('tracks', t);
        closeSheet();
        render();
        if (id === state.currentId) { renderNow(); updateMediaSession(); }
        toast('Alterações salvas');
      });
    },
  );
}
function timerSheet() {
  const active = timer.end || timer.endOfTrack;
  const opts = [15, 30, 45, 60, 90, 120];
  openSheet(
    `<h3>Timer para dormir</h3>
     ${active ? `<div class="timer-active"><div><small>A música para em</small><b id="tsLeft"></b></div><button class="pill ghost" id="tCancel">Cancelar</button></div>` : ''}
     <div class="grid">
       ${opts.map((m) => `<button class="opt" data-min="${m}">${fmtMinutes(m)}</button>`).join('')}
       <button class="opt wide" data-eot>Quando esta música acabar</button>
       <button class="opt wide" data-custom>Outro tempo…</button>
     </div>
     <label class="switch-row"><span>Diminuir o volume aos poucos no final</span><input type="checkbox" class="switch" id="fadeChk" ${state.fade ? 'checked' : ''}></label>
     ${volumeWorks ? '' : '<p class="note">No iPhone, o iOS não deixa apps da web mudarem o volume. Por isso, nele a música pausa sem diminuir aos poucos.</p>'}`,
    (s) => {
      renderTimer();
      s.querySelectorAll('[data-min]').forEach((b) => b.addEventListener('click', () => { closeSheet(); setTimer(+b.dataset.min); }));
      s.querySelector('[data-eot]').addEventListener('click', () => {
        closeSheet();
        if (!state.currentId) { toast('Nada tocando agora'); return; }
        setTimerEndOfTrack();
      });
      s.querySelector('[data-custom]').addEventListener('click', async () => {
        const v = await promptSheet({ title: 'Parar depois de quantos minutos?', type: 'number', placeholder: 'Ex.: 75', ok: 'Iniciar' });
        const m = Math.round(Number(v));
        if (m > 0) setTimer(Math.min(m, 1440));
      });
      s.querySelector('#tCancel')?.addEventListener('click', () => { closeSheet(); cancelTimer(); toast('Timer cancelado'); });
      s.querySelector('#fadeChk').addEventListener('change', (e) => {
        state.fade = e.target.checked;
        if (!state.fade) { fadeFactor = 1; applyVolume(); }
        saveState();
      });
    },
  );
}
let installEvent = null;
async function infoSheet() {
  let storage = '';
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (est) {
      const used = (est.usage || 0) / 1048576, quota = (est.quota || 0) / 1048576;
      const f = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
      storage = `<div class="info-block"><h4>Espaço usado</h4><p>${f(used)} de ${f(quota)} disponíveis${persisted ? ' · protegido contra limpeza automática' : ''}</p><div class="meter"><div style="width:${Math.min(100, (used / Math.max(1, quota)) * 100).toFixed(1)}%"></div></div></div>`;
    }
  } catch { /* ignore */ }
  const tracks = state.tracks.size;
  openSheet(
    `<h3>Just Listening</h3>
     ${installEvent ? '<div class="info-block"><h4>Instalar o app</h4><p>Coloque o Just Listening na tela inicial deste aparelho.</p><div class="sheet-buttons" style="justify-content:flex-start;margin-top:10px"><button class="pill" id="doInstall">Instalar</button></div></div>' : ''}
     <div class="info-block"><h4>Instalar no iPhone</h4><ol><li>Abra este site no Safari.</li><li>Toque em Compartilhar (quadrado com seta).</li><li>Escolha “Adicionar à Tela de Início”.</li><li>Abra pelo ícone e importe as músicas lá.</li></ol></div>
     <div class="info-block"><h4>Instalar no Android</h4><ol><li>Abra este site no Chrome.</li><li>Toque no menu ⋮.</li><li>Escolha “Instalar app” ou “Adicionar à tela inicial”.</li></ol></div>
     ${storage}
     <div class="info-block"><p>${plural(tracks, 'música guardada', 'músicas guardadas')} · ${plural(state.playlists.length, 'playlist', 'playlists')}. Suas músicas ficam só neste aparelho: nada é enviado para a internet.</p><p class="note">Versão ${VERSION}</p></div>`,
    (s) => {
      s.querySelector('#doInstall')?.addEventListener('click', async () => {
        closeSheet();
        try { installEvent.prompt(); await installEvent.userChoice; } catch { /* ignore */ }
        installEvent = null;
        renderBanner();
      });
    },
  );
}

// ---------------------------------------------------------------- telas
function setView(v) {
  const changed = v.name !== state.view.name || v.id !== state.view.id;
  state.view = v;
  render();
  if (changed) window.scrollTo(0, 0);
}
function render() {
  const tab = state.view.name === 'playlist' ? 'playlists' : state.view.name;
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  if (state.view.name === 'library') renderLibrary();
  else if (state.view.name === 'playlists') renderPlaylists();
  else renderPlaylist(state.view.id);
}
const playingNow = () => state.currentId && !audio.paused && !isSilent();
function eqHTML() { return `<span class="eq ${playingNow() ? '' : 'paused'}"><i></i><i></i><i></i></span>`; }
function trackRow(t, src) {
  const playing = t.id === state.currentId;
  const sub = [t.artist, t.duration ? fmt(t.duration) : ''].filter(Boolean).join(' · ');
  return `<li class="row ${playing ? 'playing' : ''}" data-id="${t.id}">
    <button class="row-main" data-act="play">${coverHTML(t, 'sm')}<div class="row-text"><div class="t">${esc(t.title)}</div><div class="s">${esc(sub)}</div></div>${playing ? eqHTML() : ''}</button>
    <button class="icon-btn" data-act="more" aria-label="Opções de ${esc(t.title)}">${I.more}</button>
  </li>`;
}
function renderLibrary() {
  const ids = libraryIds();
  const view = $('#view');
  if (!ids.length) {
    view.innerHTML = `<div class="empty">
      <div class="empty-art">${I.note}</div>
      <h2>Suas músicas, do seu jeito</h2>
      <p>Importe os arquivos que você baixou (MP3, M4A, WAV…). Eles ficam guardados neste aparelho e tocam sem internet.</p>
      <button class="pill big" data-act="import">${I.upload} Importar músicas</button>
      <p class="hint">${isIOS ? 'No iPhone, os arquivos aparecem no app Arquivos (normalmente em “Downloads”). Dá para selecionar vários de uma vez.' : 'Você pode selecionar vários arquivos de uma vez.'}</p>
    </div>`;
    return;
  }
  const total = ids.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
  view.innerHTML = `<div class="list-head">
      <div class="count">${plural(ids.length, 'música', 'músicas')}${total ? ' · ' + fmtLong(total) : ''}</div>
      <div class="head-actions"><button class="pill ghost" data-act="shuffleAll">${I.shuffle} Aleatório</button><button class="pill" data-act="playAll">${I.play} Tocar</button></div>
    </div>
    <ul class="list">${ids.map((id) => trackRow(state.tracks.get(id), 'library')).join('')}</ul>`;
}
function renderPlaylists() {
  const view = $('#view');
  const rows = state.playlists.map((p) => {
    const ids = sourceIds(p.id);
    const coverTrack = state.tracks.get(ids.find((id) => state.tracks.get(id).cover));
    const dur = ids.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
    const playing = state.q.source === p.id && state.currentId;
    return `<li class="row ${playing ? 'playing' : ''}" data-pid="${p.id}">
      <button class="row-main" data-act="openPlaylist">${coverHTML(coverTrack, 'sm', p.id, I.list)}<div class="row-text"><div class="t">${esc(p.name)}</div><div class="s">${plural(ids.length, 'música', 'músicas')}${dur ? ' · ' + fmtLong(dur) : ''}</div></div>${playing ? eqHTML() : ''}</button>
      <button class="icon-btn" data-act="playlistMore" aria-label="Opções da playlist">${I.more}</button>
    </li>`;
  }).join('');
  view.innerHTML = `<div class="list-head">
      <div class="count">${plural(state.playlists.length, 'playlist', 'playlists')}</div>
      <button class="pill" data-act="newPlaylist">${I.plus} Nova playlist</button>
    </div>
    ${rows ? `<ul class="list">${rows}</ul>` : '<div class="empty small"><p>Crie playlists para organizar suas músicas. Por exemplo, uma só para dormir, com repetição ligada.</p></div>'}`;
}
function renderPlaylist(pid) {
  const p = playlistById(pid);
  if (!p) { state.view = { name: 'playlists' }; renderPlaylists(); return; }
  const view = $('#view');
  const ids = sourceIds(pid);
  const reorder = !!state.view.reorder;
  const dur = ids.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
  const head = `<div class="pl-head">
      <button class="icon-btn" data-act="back" aria-label="Voltar">${I.back}</button>
      <div class="pl-head-text"><h2>${esc(p.name)}</h2><div class="s">${plural(ids.length, 'música', 'músicas')}${dur ? ' · ' + fmtLong(dur) : ''}</div></div>
      <button class="icon-btn" data-act="playlistMenu" aria-label="Opções da playlist">${I.more}</button>
    </div>`;
  const actions = reorder
    ? `<div class="list-head"><div class="count">Use as setas para mudar a ordem</div><button class="pill" data-act="reorderDone">Concluído</button></div>`
    : `<div class="list-head"><button class="pill ghost" data-act="addSongs">${I.plus} Adicionar</button><div class="head-actions"><button class="pill ghost" data-act="shuffleAll" ${ids.length ? '' : 'disabled'}>${I.shuffle} Aleatório</button><button class="pill" data-act="playAll" ${ids.length ? '' : 'disabled'}>${I.play} Tocar</button></div></div>`;
  const list = ids.length
    ? `<ul class="list">${ids.map((id, i) => {
        const t = state.tracks.get(id);
        if (!reorder) return trackRow(t, pid);
        return `<li class="row" data-id="${id}"><div class="row-main">${coverHTML(t, 'sm')}<div class="row-text"><div class="t">${esc(t.title)}</div><div class="s">${i + 1}</div></div></div>
          <div class="reorder-btns"><button class="icon-btn" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${I.up}</button><button class="icon-btn" data-act="down" data-i="${i}" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="Descer">${I.down}</button></div></li>`;
      }).join('')}</ul>`
    : `<div class="empty small"><p>Esta playlist está vazia.</p><button class="pill" data-act="addSongs">${I.plus} Adicionar músicas</button></div>`;
  view.innerHTML = head + actions + list;
}
function renderBanner() {
  const el = $('#banner');
  if (isIOS && !isStandalone()) {
    el.innerHTML = `<div class="banner">${I.info}<div><b>Instale antes de importar.</b> No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Assim o iPhone guarda suas músicas com segurança.</div></div>`;
  } else if (installEvent) {
    el.innerHTML = `<div class="banner">${I.info}<div>Instale o Just Listening para abrir como um app.</div><button class="pill" id="bannerInstall">Instalar</button></div>`;
    $('#bannerInstall').addEventListener('click', async () => {
      try { installEvent.prompt(); await installEvent.userChoice; } catch { /* ignore */ }
      installEvent = null;
      renderBanner();
    });
  } else {
    el.innerHTML = '';
  }
}

// mini player + player completo
let glowFor = null;
function renderNow() {
  const t = state.tracks.get(state.currentId);
  const mini = $('#mini');
  if (!t) {
    mini.hidden = true;
    document.body.classList.remove('has-mini');
    closePlayer();
    updateMediaSessionEmpty();
    return;
  }
  mini.hidden = false;
  document.body.classList.add('has-mini');
  $('#miniCover').innerHTML = coverHTML(t, 'sm');
  $('#miniTitle').textContent = t.title;
  $('#miniSub').innerHTML = `<span class="moon-badge" id="miniBadge" hidden>${I.moon}</span>${esc(t.artist || sourceName(state.q.source))}`;
  $('#plCover').innerHTML = coverHTML(t, 'xl');
  $('#plTitle').textContent = t.title;
  $('#plArtist').textContent = t.artist || '';
  $('#plSource').textContent = sourceName(state.q.source);
  if (glowFor !== t.id) {
    glowFor = t.id;
    const h = hue(t.id);
    $('#player').style.setProperty('--glow', `${Math.round(60 + 40 * Math.cos(h))} ${Math.round(50 + 30 * Math.sin(h))} 120`);
    averageColor(t).then((c) => { if (c && glowFor === t.id) $('#player').style.setProperty('--glow', c); });
  }
  renderControls();
  updateProgress();
}
function updateMediaSessionEmpty() {
  if (ms) { try { ms.metadata = null; ms.playbackState = 'none'; } catch { /* ignore */ } }
}
function renderControls() {
  const playing = playingNow();
  for (const b of [$('#miniPlay'), $('#btnPlay')]) {
    b.innerHTML = playing ? I.pause : I.play;
    b.setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
  }
  $('#btnShuffle').classList.toggle('on', state.shuffle);
  $('#btnShuffle').setAttribute('aria-pressed', state.shuffle);
  $('#btnRepeat').innerHTML = state.repeat === 'one' ? I.repeatOne : I.repeat;
  $('#btnRepeat').classList.toggle('on', state.repeat !== 'off');
  $('#btnRepeat').setAttribute('aria-label', { off: 'Repetir: desligado', all: 'Repetir: playlist', one: 'Repetir: esta música' }[state.repeat]);
  $('#repeatLabel').textContent = { off: '', all: 'Repetindo a playlist', one: 'Repetindo esta música' }[state.repeat];
  renderTimer();
}
let seeking = false;
function updateProgress() {
  const t = state.tracks.get(state.currentId);
  const d = isFinite(audio.duration) && audio.duration > 0 && !isSilent() ? audio.duration : t?.duration || 0;
  const c = isSilent() ? 0 : audio.currentTime || 0;
  const pct = d > 0 ? Math.min(1, c / d) : 0;
  if (!seeking) {
    const seek = $('#seek');
    seek.value = Math.round(pct * 1000);
    seek.style.setProperty('--p', `${pct * 100}%`);
    $('#tCur').textContent = fmt(c);
  }
  $('#tDur').textContent = fmt(d);
  $('#miniBar').style.width = `${pct * 100}%`;
}
function openPlayer() {
  const pl = $('#player');
  if (pl.classList.contains('open') || !state.currentId) return;
  pl.classList.add('open');
  document.body.classList.add('lock');
  try { history.pushState({ jl: 'player' }, ''); } catch { /* ignore */ }
}
function closePlayer(fromPop) {
  const pl = $('#player');
  if (!pl.classList.contains('open')) return;
  pl.classList.remove('open');
  document.body.classList.remove('lock');
  if (!fromPop && history.state?.jl === 'player') history.back();
}
function playerMenu() {
  const t = state.tracks.get(state.currentId);
  if (!t) return;
  const src = state.q.source;
  actionSheet(`${coverHTML(t, 'sm')}<div><div class="t">${esc(t.title)}</div><div class="s">${esc(sourceName(src))}</div></div>`, [
    { label: 'Adicionar à playlist', icon: I.plus, run: () => addToPlaylistSheet([t.id]) },
    { label: 'Editar nome e capa', icon: I.edit, run: () => editTrackSheet(t.id) },
    { label: `Ir para ${src === 'library' ? 'todas as músicas' : 'a playlist'}`, icon: I.goto, run: () => { closePlayer(); setView(src === 'library' ? { name: 'library' } : { name: 'playlist', id: src }); } },
  ]);
}

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg, sticky = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------- eventos
function bindEvents() {
  $('#btnInfo').innerHTML = I.info;
  $('#btnImport').innerHTML = `${I.upload}<span>Importar</span>`;
  $('#plClose').innerHTML = I.down;
  $('#plMore').innerHTML = I.more;
  $('#miniNext').innerHTML = I.next;
  $('#btnPrev').innerHTML = I.prev;
  $('#btnNext').innerHTML = I.next;
  $('#btnShuffle').innerHTML = I.shuffle;
  $('#timerIcon').innerHTML = I.moon;

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setView({ name: b.dataset.tab })));
  $('#btnImport').addEventListener('click', () => pickFiles(state.view.name === 'playlist' ? state.view.id : null));
  $('#btnInfo').addEventListener('click', infoSheet);
  $('#fileInput').addEventListener('change', (e) => {
    const files = [...e.target.files];
    if (files.length) importFiles(files, importTarget);
  });

  $('#view').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const pid = b.closest('[data-pid]')?.dataset.pid;
    const src = viewSource();
    switch (b.dataset.act) {
      case 'play': userPlay(src, id); break;
      case 'more': trackMenu(id, src); break;
      case 'playAll': userPlay(src, null, false); break;
      case 'shuffleAll': userPlay(src, null, true); break;
      case 'import': pickFiles(); break;
      case 'newPlaylist': newPlaylist(); break;
      case 'openPlaylist': setView({ name: 'playlist', id: pid }); break;
      case 'playlistMore': playlistMenu(pid); break;
      case 'playlistMenu': playlistMenu(state.view.id); break;
      case 'back': setView({ name: 'playlists' }); break;
      case 'addSongs': addSongsSheet(state.view.id); break;
      case 'reorderDone': setView({ name: 'playlist', id: state.view.id }); break;
      case 'up': movePlaylistTrack(state.view.id, +b.dataset.i, -1); break;
      case 'down': movePlaylistTrack(state.view.id, +b.dataset.i, 1); break;
    }
  });

  $('#miniOpen').addEventListener('click', openPlayer);
  $('#miniPlay').addEventListener('click', togglePlay);
  $('#miniNext').addEventListener('click', () => next(false));
  $('#plClose').addEventListener('click', () => closePlayer());
  $('#plMore').addEventListener('click', playerMenu);
  $('#btnPlay').addEventListener('click', togglePlay);
  $('#btnNext').addEventListener('click', () => next(false));
  $('#btnPrev').addEventListener('click', prev);
  $('#btnShuffle').addEventListener('click', () => setShuffle(!state.shuffle));
  $('#btnRepeat').addEventListener('click', cycleRepeat);
  $('#btnTimer').addEventListener('click', timerSheet);
  window.addEventListener('popstate', () => {
    if (sheetOpen()) closeSheet();
    if ($('#player').classList.contains('open')) closePlayer(true);
  });

  // arrastar o player para baixo fecha
  const pl = $('#player');
  let ty = null;
  pl.addEventListener('touchstart', (e) => { ty = e.target.closest('input') ? null : e.touches[0].clientY; }, { passive: true });
  pl.addEventListener('touchend', (e) => { if (ty != null && e.changedTouches[0].clientY - ty > 90) closePlayer(); ty = null; });

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    seeking = true;
    const t = state.tracks.get(state.currentId);
    const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : t?.duration || 0;
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    $('#tCur').textContent = fmt((seek.value / 1000) * d);
  });
  seek.addEventListener('change', () => {
    const d = audio.duration;
    if (isFinite(d) && d > 0) audio.currentTime = (seek.value / 1000) * d;
    seeking = false;
    updatePosition();
  });

  // eventos do <audio>
  const onPlayState = () => {
    if (isSilent()) return;
    renderControls();
    render();
    if (ms) { try { ms.playbackState = audio.paused ? 'paused' : 'playing'; } catch { /* ignore */ } }
    updatePosition();
    saveState();
  };
  // Os dois players recebem os mesmos eventos; só o player atual é considerado.
  const onAudio = (type, fn) => players.forEach((el) => el.addEventListener(type, (e) => {
    if (type === 'playing') unlockedEls.add(el);
    if (el === audio) fn(e);
  }));
  onAudio('playing', onPlayState);
  onAudio('pause', () => { clearHandoff(); onPlayState(); });
  onAudio('ended', () => {
    if (isSilent()) return;
    if (timer.endOfTrack) { timerFire(); return; }
    next(true);
  });
  onAudio('loadedmetadata', () => {
    if (isSilent()) return;
    if (pendingSeek && pendingSeek < audio.duration - 1) audio.currentTime = pendingSeek;
    pendingSeek = 0;
    const t = state.tracks.get(state.currentId);
    if (t && isFinite(audio.duration) && Math.abs((t.duration || 0) - audio.duration) > 1) {
      t.duration = audio.duration;
      db.put('tracks', t).catch(() => {});
    }
    updateProgress();
    updatePosition();
  });
  let lastSave = 0;
  onAudio('timeupdate', () => {
    if (isSilent()) return;
    updateProgress();
    tickTimer();
    checkHandoff();
    const now = Date.now();
    if (now - lastSave > 5000) { lastSave = now; saveState(); }
  });
  onAudio('seeked', () => { clearHandoff(); updatePosition(); });
  onAudio('error', () => {
    if (isSilent() || !audio.getAttribute('src')) return;
    toast('Este formato de áudio não toca neste aparelho');
  });

  setInterval(tickTimer, 500);
  document.addEventListener('visibilitychange', () => { tickTimer(); if (document.hidden) saveState(); });
  window.addEventListener('pagehide', saveState);

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; renderBanner(); });
  window.addEventListener('appinstalled', () => { installEvent = null; renderBanner(); });
}

// ---------------------------------------------------------------- início
async function init() {
  bindEvents();
  setupMediaSession();
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = '<div class="empty"><h2>Não consegui abrir o armazenamento</h2><p>Se estiver em uma aba anônima, abra o app normalmente.</p></div>';
    return;
  }
  const s = loadSaved();
  state.repeat = ['off', 'all', 'one'].includes(s.repeat) ? s.repeat : 'off';
  state.shuffle = !!s.shuffle;
  state.fade = s.fade !== false;
  state.q.source = s.source && sourceIds(s.source) ? s.source : 'library';
  if (s.currentId && state.tracks.has(s.currentId)) {
    state.currentId = s.currentId;
    syncQueue();
    startTrack(s.currentId, false, s.time || 0);
  } else {
    syncQueue();
  }
  renderBanner();
  render();
  renderNow();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Quando uma versão nova do app é instalada, recarrega (só se nada estiver tocando).
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && audio.paused && !importing) location.reload();
    });
    navigator.serviceWorker.register('sw.js')
      .then((reg) => reg.update().catch(() => {}))
      .catch((err) => console.warn('service worker', err));
  }
}

init();

// Acesso para testes no console do navegador.
window.JustListening = { state, importFiles, setTimer, VERSION };

// Just Listening — player de músicas locais (PWA)
import * as db from './db.js';
import { readTags } from './id3.js';
import * as dbx from './dropbox.js';

const VERSION = '1.5.0';

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
  search: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  heart: stroke('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  heartFill: fill('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  lyrics: stroke('<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M20 17.5V11"/>'),
  image: stroke('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  gear: stroke('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  cloud: stroke('<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5M12 11v5"/>'),
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
  view: { name: 'playlists' }, // library | playlists | playlist (id, reorder)
  sort: 'recent', // recent | az | za
  query: '',
  q: { source: 'library', ids: [], order: [], pos: -1 },
  currentId: null,
  repeat: 'off', // off | all | one
  shuffle: false,
  fade: true,
  timerWait: true, // ao fim do timer, espera a música terminar
};
const timer = { end: 0, fadeMs: 0, endOfTrack: false, wait: false };

// Modo Dormir: playlist, tempo e opções escolhidas pelo usuário.
const SLEEP_KEY = 'just-listening-sleep';
const sleepPrefs = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(SLEEP_KEY)) || {}; } catch { /* ignore */ }
  return { source: p.source || 'library', minutes: p.minutes || 60, shuffle: !!p.shuffle, wait: p.wait !== false };
})();
const saveSleepPrefs = () => { try { localStorage.setItem(SLEEP_KEY, JSON.stringify(sleepPrefs)); } catch { /* ignore */ } };
let fadeFactor = 1;

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      repeat: state.repeat, shuffle: state.shuffle, fade: state.fade, sort: state.sort, timerWait: state.timerWait,
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
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
function libraryIds() {
  const arr = [...state.tracks.values()];
  if (state.sort === 'az') arr.sort((a, b) => collator.compare(a.title, b.title));
  else if (state.sort === 'za') arr.sort((a, b) => collator.compare(b.title, a.title));
  else arr.sort((a, b) => b.addedAt - a.addedAt);
  return arr.map((t) => t.id);
}
const playlistById = (id) => state.playlists.find((p) => p.id === id);
const favoriteIds = () => libraryIds().filter((id) => state.tracks.get(id).fav);
function sourceIds(src) {
  if (src === 'library') return libraryIds();
  if (src === 'favorites') return favoriteIds();
  const p = playlistById(src);
  return p ? p.trackIds.filter((id) => state.tracks.has(id)) : null;
}
const sourceName = (src) => (src === 'library' ? 'Todas as músicas' : src === 'favorites' ? 'Favoritas' : playlistById(src)?.name || 'Playlist');
const viewSource = () => (state.view.name === 'playlist' ? state.view.id : state.view.name === 'favorites' ? 'favorites' : 'library');
// Playlists de pastas do Dropbox ficam em ordem alfabética (igual em todos os aparelhos).
const sortPlaylists = () => state.playlists.sort((a, b) => {
  const da = a.id.startsWith('dbx:'), db_ = b.id.startsWith('dbx:');
  if (da && db_) return collator.compare(a.name, b.name);
  return (a.createdAt || 0) - (b.createdAt || 0);
});

// Marca mudanças para a sincronização com o Dropbox.
let syncTimer = 0;
function scheduleSync() {
  if (!dbx.isConnected()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(true), 2500);
}
async function touchPlaylist(p) {
  p.updatedAt = Date.now();
  await db.put('playlists', p);
  scheduleSync();
}
async function touchTrack(t) {
  t.metaAt = Date.now();
  await db.put('tracks', t);
  scheduleSync();
}

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
// Capas de playlist (guardadas na própria playlist).
const plCoverUrls = new Map();
function playlistCoverUrl(p) {
  if (!p?.cover) return null;
  let u = plCoverUrls.get(p.id);
  if (!u) { u = URL.createObjectURL(new Blob([p.cover.data], { type: p.cover.type })); plCoverUrls.set(p.id, u); }
  return u;
}
function dropPlaylistCover(id) {
  const u = plCoverUrls.get(id);
  if (u) URL.revokeObjectURL(u);
  plCoverUrls.delete(id);
  coverDataUrls.delete(`pl:${id}`);
}
function playlistCoverHTML(p, cls = 'sm') {
  const u = playlistCoverUrl(p);
  if (u) return `<div class="cover ${cls}"><img src="${u}" alt="" decoding="async"></div>`;
  const ids = sourceIds(p.id) || [];
  const withCover = state.tracks.get(ids.find((id) => state.tracks.get(id).cover));
  return coverHTML(withCover, cls, p.id, I.list);
}
// Arte do que está tocando: capa da música ou, se não tiver, a capa da playlist.
function nowArtHTML(t, cls) {
  if (t?.cover) return coverHTML(t, cls);
  const p = playlistById(state.q.source);
  const u = playlistCoverUrl(p);
  return u ? `<div class="cover ${cls}"><img src="${u}" alt="" decoding="async"></div>` : coverHTML(t, cls);
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
// wait = true: quando o tempo acabar, deixa a música atual terminar antes de parar.
function setTimer(minutes, { wait = state.timerWait, quiet = false } = {}) {
  const ms = minutes * 60000;
  timer.end = Date.now() + ms;
  timer.fadeMs = Math.min(60000, ms / 3);
  timer.endOfTrack = false;
  timer.wait = !!wait;
  fadeFactor = 1; applyVolume();
  audio.loop = shouldLoop();
  renderTimer();
  if (!quiet) toast(`A música para em ${fmtMinutes(minutes)}${wait ? ', no fim da faixa' : ''}`);
}

// Modo Dormir: toca a playlist escolhida, repetindo, e liga o timer.
function startSleep() {
  let src = sleepPrefs.source;
  if (!sourceIds(src)?.length) src = 'library';
  if (!sourceIds(src)?.length) { toast('Importe músicas primeiro'); return; }
  state.repeat = 'all';
  userPlay(src, null, !!sleepPrefs.shuffle);
  setTimer(sleepPrefs.minutes, { wait: sleepPrefs.wait, quiet: true });
  renderControls();
  saveState();
  toast(`Boa noite! ${sourceName(src)} até ${fmtMinutes(sleepPrefs.minutes)}${sleepPrefs.wait ? ' (termina a música)' : ''}`);
}
function sleepSummary() {
  const src = sourceIds(sleepPrefs.source)?.length ? sleepPrefs.source : 'library';
  return `${sourceName(src)} · ${fmtMinutes(sleepPrefs.minutes)}${sleepPrefs.shuffle ? ' · aleatório' : ''}${sleepPrefs.wait ? ' · termina a música' : ''}`;
}
function setTimerEndOfTrack() {
  timer.end = 0;
  timer.endOfTrack = true;
  clearHandoff();
  fadeFactor = 1; applyVolume();
  audio.loop = shouldLoop();
  renderTimer();
  toast('A música para quando esta faixa terminar');
}
function cancelTimer() {
  timer.end = 0;
  timer.endOfTrack = false;
  timer.wait = false;
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
  if (left <= 0) {
    if (timer.wait && !audio.paused && state.currentId) {
      // o tempo acabou: agora para quando a música atual terminar
      timer.end = 0;
      timer.endOfTrack = true;
      clearHandoff();
      audio.loop = shouldLoop();
      renderTimer();
      return;
    }
    timerFire();
    return;
  }
  if (state.fade && volumeWorks && !timer.wait && left < timer.fadeMs) { fadeFactor = left / timer.fadeMs; applyVolume(); }
  renderTimerLabel(left);
}
function timerFire() {
  audio.pause();
  timer.end = 0;
  timer.endOfTrack = false;
  timer.wait = false;
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
  // capa da música; se não tiver, capa da playlist
  const pl = playlistById(state.q.source);
  const art = t.cover ? t : pl?.cover ? { id: `pl:${pl.id}`, cover: pl.cover } : null;
  const cached = art && coverDataUrls.get(art.id);
  set(cached ? [{ src: cached, sizes: '512x512', type: art.cover.type }] : fallbackArt);
  if (art && !cached) {
    const d = await coverDataUrl(art);
    if (d && state.currentId === t.id) set([{ src: d, sizes: '512x512', type: art.cover.type }]);
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
const VIDEO_EXT = /\.(mp4|m4v|mov)$/i;
// Vídeo: tipo video/* ou extensão de vídeo (um .mp4 marcado como audio/* já é só áudio).
const isVideoFile = (f) => (f.type && f.type.startsWith('video/')) || (VIDEO_EXT.test(f.name) && !(f.type || '').startsWith('audio/'));
const isAudioFile = (f) => (f.type && f.type.startsWith('audio/')) || AUDIO_EXT.test(f.name);
const isImportable = (f) => isVideoFile(f) || isAudioFile(f);

// Extrai o áudio de um vídeo (o código só é carregado quando precisa).
async function audioFromVideo(f, onProgress) {
  const va = await import('./video-audio.js');
  const { file } = await va.extractAudio(f, onProgress);
  let cover = null;
  try {
    const frame = await va.videoFrame(f);
    if (frame) cover = await shrinkImage(frame);
  } catch { /* sem capa */ }
  return { file, cover };
}
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
// Guarda um arquivo de áudio no aparelho e devolve a música criada.
async function addTrackFromFile(f, addedAt, extra = {}) {
  const type = (f.type && f.type.startsWith('audio/') ? f.type : '') || MIME[extOf(f.name)] || 'audio/mpeg';
  const tags = await readTags(f).catch(() => ({}));
  const data = await f.arrayBuffer();
  const cover = tags.picture ? await shrinkImage(tags.picture) : null;
  const duration = await probeDuration(f);
  const id = uid();
  const t = {
    id,
    title: (tags.title || stripExt(f.name) || 'Sem nome').trim(),
    artist: (tags.artist || '').trim(),
    lyrics: tags.lyrics || '',
    duration,
    cover,
    fileName: f.name,
    size: f.size,
    type,
    addedAt,
    ...extra,
  };
  await db.put('audio', { type, data }, id);
  await db.put('tracks', t);
  state.tracks.set(id, t);
  return t;
}

async function importFiles(files, pid) {
  files = files.filter(isImportable).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  if (!files.length) { toast('Nenhum arquivo de áudio ou vídeo encontrado'); return; }
  importing = true;
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  const existing = new Map();
  for (const t of state.tracks.values()) {
    existing.set(`${t.fileName}|${t.size}`, t.id);
    if (t.sourceKey) existing.set(t.sourceKey, t.id); // vídeo já importado antes
  }
  const base = Date.now();
  const ids = [];
  let added = 0, skipped = 0, failed = 0, lastError = '';

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const of = files.length > 1 ? ` (${i + 1} de ${files.length})` : '';
    toast(`Importando${of}…`, true);
    const key = `${f.name}|${f.size}`;
    if (existing.has(key)) { skipped++; ids.push(existing.get(key)); continue; }
    try {
      let src = f, extra = {};
      if (isVideoFile(f)) {
        const { file, cover } = await audioFromVideo(f, (p) => toast(`Extraindo o áudio do vídeo${of}… ${Math.round(p * 100)}%`, true));
        src = file;
        extra = { sourceKey: key, ...(cover ? { cover } : {}) };
      }
      const t = await addTrackFromFile(src, base + (files.length - i), extra);
      existing.set(key, t.id);
      ids.push(t.id);
      added++;
    } catch (err) {
      console.error('importar', f.name, err);
      failed++;
      if (err?.code) lastError = err.message;
      if (err && err.name === 'QuotaExceededError') { toast('Acabou o espaço disponível para o app'); break; }
    }
  }
  importing = false;

  const p = pid && playlistById(pid);
  if (p && usesFolder(p)) {
    await addToPlaylist(p.id, ids); // envia direto para a pasta da playlist
  } else if (p) {
    const add = ids.filter((id) => !p.trackIds.includes(id));
    p.trackIds.push(...add);
    await touchPlaylist(p);
  }
  if (state.q.source === 'library' || (p && state.q.source === p.id)) syncQueue();
  render();

  const parts = [];
  if (added) parts.push(plural(added, 'música importada', 'músicas importadas'));
  if (skipped) parts.push(plural(skipped, 'já existia', 'já existiam'));
  if (failed) parts.push(plural(failed, 'falhou', 'falharam'));
  if (lastError && !added) toast(lastError);
  else toast((parts.join(' · ') || 'Nada importado') + (p ? ` → ${p.name}` : '') + (lastError ? ` (${lastError})` : ''));
  if (added && dbx.isConnected() && syncPrefs.upload) setTimeout(() => syncNow(true), 2800);
}

// ---------------------------------------------------------------- Dropbox
// Com o Dropbox conectado, ele é a fonte oficial:
//  • cada subpasta da pasta do app é uma playlist (criar, renomear, excluir e adicionar
//    músicas numa playlist mexe na pasta);
//  • cada música é reconhecida pela "impressão digital" do arquivo (content_hash do Dropbox):
//    a mesma música em duas pastas aparece uma vez só no app;
//  • ordem das músicas, capas, favoritas e letras ficam em .just-listening/biblioteca.json.
// Excluir uma música no app não apaga no Dropbox.
const SYNC_KEY = 'just-listening-sync';
const syncPrefs = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } })();
if (syncPrefs.upload === undefined) syncPrefs.upload = true;
if (!Array.isArray(syncPrefs.ignored)) syncPrefs.ignored = [];
if (!Array.isArray(syncPrefs.ignoredHashes)) syncPrefs.ignoredHashes = [];
if (!syncPrefs.deletedPlaylists || typeof syncPrefs.deletedPlaylists !== 'object') syncPrefs.deletedPlaylists = {};
const saveSyncPrefs = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncPrefs)); } catch { /* ignore */ } };
let syncing = false;
let syncAgain = false;
let dbxBusy = false; // uma ação de playlist está mexendo no Dropbox

// Raiz dentro da pasta do app. Vazia no uso normal; uma subpasta isolada só em testes.
const DBX_ROOT = (() => { try { return localStorage.getItem('just-listening-dbx-root') || ''; } catch { return ''; } })();
const LIBRARY_PATH = `${DBX_ROOT}/.just-listening/biblioteca.json`;
const HIDDEN_LOWER = `${DBX_ROOT}/.just-listening`.toLowerCase();
const ROOT_LOWER = DBX_ROOT.toLowerCase();
const dbxMode = () => dbx.isConnected();
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '') || 'Sem nome';
const parentOf = (pathLower) => pathLower.slice(0, pathLower.lastIndexOf('/'));
const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
const folderPid = (pathLower) => `dbx:${pathLower}`;
const isDbxPlaylist = (p) => !!p?.id?.startsWith('dbx:');
const folderTitle = (pathDisplay) => pathDisplay.slice(DBX_ROOT.length).split('/').filter(Boolean).join(' / ');
const trackFiles = (t) => Object.entries(t?.dbx?.files || {}).map(([id, path]) => ({ id, path, lower: path.toLowerCase() }));
const fileNameFor = (t) => safeName(t.fileName || `${t.title}.${extOf(t.fileName || '') || 'mp3'}`);
function trackByHash() {
  const m = new Map();
  for (const t of state.tracks.values()) if (t.dbx?.hash) m.set(t.dbx.hash, t);
  return m;
}
async function ensureHash(t) {
  if (t.dbx?.hash) return t.dbx.hash;
  const rec = await db.get('audio', t.id);
  if (!rec) return null;
  t.dbx = { ...(t.dbx || {}), hash: await dbx.contentHash(rec.data), files: t.dbx?.files || {} };
  await db.put('tracks', t);
  return t.dbx.hash;
}

// Coloca músicas numa pasta: envia (se ainda não estão no Dropbox), move (se estão soltas
// na pasta principal) ou copia (se já estão em outra playlist).
async function putTracksInFolder(tracks, folder) {
  for (const t of tracks) {
    await ensureHash(t);
    const files = trackFiles(t);
    if (files.some((f) => parentOf(f.lower) === folder.path_lower)) continue;
    let meta;
    if (!files.length) {
      const rec = await db.get('audio', t.id);
      if (!rec) continue;
      meta = await dbx.upload(`${folder.path_display}/${fileNameFor(t)}`, rec.data);
    } else {
      const loose = files.find((f) => parentOf(f.lower) === ROOT_LOWER);
      if (loose) {
        meta = await dbx.move(loose.id, `${folder.path_display}/${baseName(loose.path)}`);
        delete t.dbx.files[loose.id];
      } else {
        meta = await dbx.copy(files[0].id, `${folder.path_display}/${baseName(files[0].path)}`);
      }
    }
    t.dbx.files[meta.id] = meta.path_display;
    t.dbx.seen = true;
    t.remote = { id: meta.id, path: meta.path_display };
    await db.put('tracks', t);
  }
}
// Tira uma música de uma pasta: apaga a cópia se ela existe em outro lugar; se era a
// única, devolve para a pasta principal (a música continua no app e no Dropbox).
async function takeTrackOutOfFolder(t, folderLower) {
  const files = trackFiles(t);
  const inside = files.filter((f) => parentOf(f.lower) === folderLower);
  const outside = files.filter((f) => parentOf(f.lower) !== folderLower);
  for (let i = 0; i < inside.length; i++) {
    const f = inside[i];
    if (outside.length || i > 0) {
      await dbx.remove(f.id);
      delete t.dbx.files[f.id];
    } else {
      const meta = await dbx.move(f.id, `${DBX_ROOT}/${baseName(f.path)}`);
      t.dbx.files[f.id] = meta.path_display;
    }
  }
  const first = trackFiles(t)[0];
  if (first) t.remote = { id: first.id, path: first.path };
  await db.put('tracks', t);
}
// Executa uma ação no Dropbox (precisa de internet), sem atropelar a sincronização.
async function dbxOp(label, fn) {
  if (!navigator.onLine) { toast('Sem internet: as playlists ficam no Dropbox. Conecte-se para editar.'); return false; }
  for (let i = 0; syncing && i < 120; i++) await new Promise((r) => setTimeout(r, 250));
  dbxBusy = true;
  toast(`Dropbox: ${label}…`, true);
  try {
    await fn();
    return true;
  } catch (err) {
    console.error('dropbox', label, err);
    toast('Não consegui salvar no Dropbox. Tente de novo.');
    return false;
  } finally {
    dbxBusy = false;
  }
}
async function mergeTrackInto(dup, keep) {
  for (const p of state.playlists) {
    if (!p.trackIds.includes(dup.id)) continue;
    p.trackIds = [...new Set(p.trackIds.map((id) => (id === dup.id ? keep.id : id)))];
    await db.put('playlists', p);
  }
  if (dup.fav && !keep.fav) keep.fav = true;
  if (dup.lyrics && !keep.lyrics) keep.lyrics = dup.lyrics;
  if (dup.cover && !keep.cover) keep.cover = dup.cover;
  await db.put('tracks', keep);
  await db.del('audio', dup.id);
  await db.del('tracks', dup.id);
  state.tracks.delete(dup.id);
  dropCover(dup.id);
  const u = urlCache.get(dup.id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(dup.id); }
}

// ---- Biblioteca compartilhada (ordem, capas, favoritas, letras)
const abToB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64ToAb = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

function replacePlaylistRefs(oldId, newId) {
  if (state.q.source === oldId) state.q.source = newId;
  if (sleepPrefs.source === oldId) { sleepPrefs.source = newId; saveSleepPrefs(); }
  if (state.view.id === oldId) state.view = { ...state.view, id: newId };
}
async function removeLocalPlaylist(p) {
  state.playlists = state.playlists.filter((x) => x !== p);
  await db.del('playlists', p.id);
  dropPlaylistCover(p.id);
}

// Playlists antigas (criadas no app antes das pastas) viram pastas no Dropbox.
// Playlists com o mesmo nome se juntam numa só.
async function migrateLegacyPlaylists(folders) {
  const legacy = state.playlists.filter((p) => !isDbxPlaylist(p));
  for (const p of legacy) {
    const name = safeName(p.dropboxFolder || p.name);
    const lower = `${DBX_ROOT}/${name}`.toLowerCase();
    let folder = folders.find((f) => f.path_lower === lower);
    if (!folder) {
      const meta = await dbx.createFolder(`${DBX_ROOT}/${name}`);
      folder = { '.tag': 'folder', path_lower: lower, path_display: meta?.path_display || `${DBX_ROOT}/${name}` };
      folders.push(folder);
    }
    const tracks = p.trackIds.map((id) => state.tracks.get(id)).filter(Boolean);
    await putTracksInFolder(tracks, folder);
    const pid = folderPid(folder.path_lower);
    let target = playlistById(pid);
    if (!target) {
      target = { id: pid, name: folderTitle(folder.path_display), folderPath: folder.path_display, trackIds: [], createdAt: p.createdAt || Date.now() };
      state.playlists.push(target);
    }
    target.trackIds = [...new Set([...target.trackIds, ...tracks.map((t) => t.id)])];
    if (!target.cover && p.cover) target.cover = p.cover;
    target.updatedAt = Date.now();
    await db.put('playlists', target);
    await removeLocalPlaylist(p);
    replacePlaylistRefs(p.id, pid);
  }
  return legacy.length > 0;
}

// Pastas do Dropbox -> playlists do app, e a biblioteca compartilhada (ordem, capas,
// favoritas, letras). Em cada item vale a mudança mais recente.
async function syncFolders(folders, byHash, byId) {
  const remote = (await dbx.readJson(LIBRARY_PATH)) || {};
  const R = { v: 2, meta: remote.meta || {}, folders: remote.folders || {} };
  let push = remote.v !== 2;
  let changed = false;
  // favoritas/letras da versão anterior (guardadas pelo id do arquivo)
  for (const [rid, m] of Object.entries(remote.tracks || {})) {
    const f = byId.get(rid);
    if (f && (R.meta[f.content_hash]?.at || 0) < (m.at || 0)) R.meta[f.content_hash] = m;
  }

  for (const [h, t] of byHash) {
    const r = R.meta[h];
    const mine = t.metaAt || 0;
    if (r && (r.at || 0) > mine) {
      t.fav = !!r.fav;
      t.lyrics = r.lyrics || '';
      if (r.title) t.title = r.title;
      t.artist = r.artist || '';
      t.metaAt = r.at;
      await db.put('tracks', t);
      changed = true;
    } else if (mine && (!r || mine > (r.at || 0))) {
      R.meta[h] = { fav: !!t.fav, lyrics: t.lyrics || '', title: t.title, artist: t.artist || '', at: mine };
      push = true;
    }
  }

  const alive = new Set();
  for (const f of folders) {
    const pid = folderPid(f.path_lower);
    alive.add(pid);
    const members = [...byHash.values()].filter((t) => trackFiles(t).some((x) => parentOf(x.lower) === f.path_lower));
    let p = playlistById(pid);
    if (!p) { p = { id: pid, trackIds: [], createdAt: Date.now() }; state.playlists.push(p); changed = true; }
    const title = folderTitle(f.path_display);
    if (p.name !== title) { p.name = title; changed = true; }
    p.folderPath = f.path_display;
    const info = R.folders[f.path_lower] || {};
    const localAt = p.updatedAt || 0;
    const remoteAt = info.at || 0;
    let order;
    if (remoteAt > localAt) {
      order = info.order || [];
      dropPlaylistCover(pid);
      p.cover = info.cover ? { type: info.cover.type, data: b64ToAb(info.cover.b64) } : null;
      p.updatedAt = remoteAt;
      changed = true;
    } else {
      order = p.trackIds.map((id) => state.tracks.get(id)?.dbx?.hash).filter(Boolean);
    }
    const byMemberHash = new Map(members.map((t) => [t.dbx.hash, t]));
    const ordered = order.filter((h) => byMemberHash.has(h)).map((h) => byMemberHash.get(h).id);
    const rest = members.filter((t) => !ordered.includes(t.id)).sort((a, b) => collator.compare(a.title, b.title)).map((t) => t.id);
    const ids = [...new Set([...ordered, ...rest])];
    if (ids.join() !== p.trackIds.join()) { p.trackIds = ids; changed = true; }
    await db.put('playlists', p);
    if (localAt > remoteAt) {
      R.folders[f.path_lower] = {
        order: ids.map((id) => state.tracks.get(id).dbx.hash),
        cover: p.cover ? { type: p.cover.type, b64: abToB64(p.cover.data) } : null,
        at: localAt,
      };
      push = true;
    }
  }
  // pastas que não existem mais
  for (const p of [...state.playlists]) {
    if (isDbxPlaylist(p) && !alive.has(p.id)) {
      await removeLocalPlaylist(p);
      if (state.q.source === p.id) state.q.source = 'library';
      changed = true;
    }
  }
  for (const k of Object.keys(R.folders)) if (!folders.some((f) => f.path_lower === k)) { delete R.folders[k]; push = true; }
  if (push) await dbx.writeJson(LIBRARY_PATH, { ...R, updatedAt: Date.now() });
  if (changed) sortPlaylists();
  return changed;
}

async function syncNow(quiet = false) {
  if (!dbx.isConnected()) return;
  if (syncing || importing || dbxBusy) { syncAgain = true; return; }
  if (!navigator.onLine) { if (!quiet) toast('Sem internet para sincronizar'); return; }
  syncing = true;
  renderSyncButton();
  let down = 0, up = 0, failed = 0, merged = 0, full = false, shown = false;
  const progress = (msg) => { shown = true; toast(msg, true); };
  try {
    if (!quiet) progress('Dropbox: verificando…');
    if (DBX_ROOT) await dbx.createFolder(DBX_ROOT);
    const entries = (await dbx.listEntries(DBX_ROOT)).filter((e) => e.path_lower !== ROOT_LOWER && !e.path_lower.startsWith(HIDDEN_LOWER));
    const folders = entries.filter((e) => e['.tag'] === 'folder');
    const files = entries.filter((e) => e['.tag'] === 'file' && (AUDIO_EXT.test(e.name) || VIDEO_EXT.test(e.name)));
    const byId = new Map(files.map((f) => [f.id, f]));
    const groups = new Map(); // impressão digital -> arquivos (a mesma música em várias pastas)
    for (const f of files) {
      if (!groups.has(f.content_hash)) groups.set(f.content_hash, []);
      groups.get(f.content_hash).push(f);
    }

    // 1) impressão digital de cada música deste aparelho
    const ignored = new Set(syncPrefs.ignoredHashes);
    for (const id of syncPrefs.ignored) { const f = byId.get(id); if (f) ignored.add(f.content_hash); }
    syncPrefs.ignored = [];
    syncPrefs.ignoredHashes = [...ignored];
    for (const t of state.tracks.values()) {
      if (t.dbx?.hash) continue;
      const known = t.remote?.id && byId.get(t.remote.id);
      if (known) {
        t.dbx = { hash: known.content_hash, files: {}, seen: true };
        await db.put('tracks', t);
      } else {
        progress('Dropbox: preparando músicas…');
        await ensureHash(t);
        if (t.remote?.id) { t.dbx.seen = true; await db.put('tracks', t); } // já foi sincronizada antes
      }
    }

    // 2) músicas repetidas neste aparelho (mesma impressão digital): fica uma só
    const byHash = new Map();
    for (const t of [...state.tracks.values()].sort((a, b) => a.addedAt - b.addedAt)) {
      const h = t.dbx?.hash;
      if (!h) continue;
      const first = byHash.get(h);
      if (!first) { byHash.set(h, t); continue; }
      if (t.id === state.currentId) { await mergeTrackInto(first, t); byHash.set(h, t); } else await mergeTrackInto(t, first);
      merged++;
    }

    // 3) liga cada música aos arquivos dela no Dropbox (caminhos atualizados)
    for (const [h, t] of byHash) {
      const g = groups.get(h) || [];
      const map = Object.fromEntries(g.map((f) => [f.id, f.path_display]));
      if (JSON.stringify(map) !== JSON.stringify(t.dbx.files || {}) || (g.length && !t.dbx.seen)) {
        t.dbx.files = map;
        if (g.length) { t.dbx.seen = true; t.remote = { id: g[0].id, path: g[0].path_display }; }
        await db.put('tracks', t);
      }
    }

    // 4) baixa as músicas novas do Dropbox
    const toDownload = [...groups.entries()]
      .filter(([h]) => !byHash.has(h) && !ignored.has(h))
      .map(([, g]) => g.sort((a, b) => a.path_lower.split('/').length - b.path_lower.split('/').length)[0])
      .sort((a, b) => a.path_display.localeCompare(b.path_display, 'pt-BR', { numeric: true }));
    const base = Date.now();
    for (let i = 0; i < toDownload.length; i++) {
      const f = toDownload[i];
      progress(`Dropbox: baixando ${i + 1} de ${toDownload.length}…`);
      try {
        const data = await dbx.download(f.id);
        let file = new File([data], f.name, { type: MIME[extOf(f.name)] || 'audio/mpeg' });
        const g = groups.get(f.content_hash);
        const extra = { remote: { id: f.id, path: f.path_display }, dbx: { hash: f.content_hash, files: Object.fromEntries(g.map((x) => [x.id, x.path_display])), seen: true } };
        if (VIDEO_EXT.test(f.name)) { // vídeo no Dropbox: guarda só o áudio
          const v = await audioFromVideo(new File([data], f.name, { type: 'video/mp4' }));
          file = v.file;
          if (v.cover) extra.cover = v.cover;
        }
        const t = await addTrackFromFile(file, base + (toDownload.length - i), extra);
        byHash.set(f.content_hash, t);
        down++;
      } catch (err) {
        console.error('dropbox download', f.path_display, err);
        failed++;
        if (err && err.name === 'QuotaExceededError') { full = true; break; }
      }
    }

    // 5) envia para a pasta principal as músicas novas deste aparelho
    if (syncPrefs.upload) {
      const pending = [...byHash.values()].filter((t) => !t.dbx.seen && !groups.has(t.dbx.hash)).sort((a, b) => a.addedAt - b.addedAt);
      for (let i = 0; i < pending.length; i++) {
        const t = pending[i];
        if (t.size > 140 * 1048576) continue; // limite do envio simples
        progress(`Dropbox: enviando ${i + 1} de ${pending.length}…`);
        try {
          const rec = await db.get('audio', t.id);
          if (!rec) continue;
          const meta = await dbx.upload(`${DBX_ROOT}/${fileNameFor(t)}`, rec.data);
          t.dbx.files = { [meta.id]: meta.path_display };
          t.dbx.seen = true;
          t.remote = { id: meta.id, path: meta.path_display };
          await db.put('tracks', t);
          up++;
        } catch (err) {
          console.error('dropbox upload', t.fileName, err);
          failed++;
          if (err && /insufficient_space/.test(err.body || '')) { toast('Seu Dropbox está cheio'); shown = false; break; }
        }
      }
    }

    // 6) playlists antigas viram pastas; 7) pastas viram playlists
    let libChanged = false;
    try {
      if (state.playlists.some((p) => !isDbxPlaylist(p))) {
        progress('Dropbox: organizando as playlists em pastas…');
        libChanged = await migrateLegacyPlaylists(folders);
      }
      libChanged = (await syncFolders(folders, byHash, byId)) || libChanged;
    } catch (err) { console.error('dropbox playlists', err); failed++; }

    syncPrefs.last = Date.now();
    saveSyncPrefs();
    if (down || merged || libChanged) { syncQueue(); render(); renderNow(); }
    const parts = [];
    if (down) parts.push(`${down} ${down === 1 ? 'música baixada' : 'músicas baixadas'}`);
    if (up) parts.push(`${up} ${up === 1 ? 'enviada' : 'enviadas'}`);
    if (merged) parts.push(`${merged} ${merged === 1 ? 'repetida unificada' : 'repetidas unificadas'}`);
    if (libChanged) parts.push('playlists atualizadas');
    if (failed) parts.push(`${failed} com erro`);
    if (full) parts.push('sem espaço no aparelho');
    if (parts.length) toast(`Dropbox: ${parts.join(' · ')}`);
    else if (!quiet) toast('Dropbox: tudo sincronizado');
    else if (shown) hideToast();
  } catch (err) {
    console.error('dropbox sync', err);
    if (!dbx.isConnected()) toast('O acesso ao Dropbox expirou. Conecte de novo no botão ⓘ.');
    else if (!quiet) toast('Não consegui sincronizar com o Dropbox');
    else if (shown) hideToast();
  } finally {
    syncing = false;
    renderSyncButton();
    if (syncAgain) { syncAgain = false; setTimeout(() => syncNow(true), 800); }
  }
}

function renderSyncButton() {
  const b = $('#btnSync');
  if (!b) return;
  b.hidden = !dbx.isConnected();
  b.classList.toggle('busy', syncing);
  b.setAttribute('aria-label', syncing ? 'Sincronizando com o Dropbox' : 'Sincronizar com o Dropbox');
}

// No app instalado (tela de início), o Dropbox mostra um código para colar:
// voltar sozinho para o app instalado não é confiável no iPhone.
async function connectDropbox(ready) {
  const useRedirect = !isStandalone();
  try { await ready; } catch { toast('Este navegador não permite conectar ao Dropbox'); return; }
  let url;
  try { url = dbx.authorizeUrl(useRedirect); } catch { await dbx.prepareAuth(); url = dbx.authorizeUrl(useRedirect); }
  if (useRedirect) { location.href = url; return; }
  window.open(url, '_blank');
  askDropboxCode();
}
async function askDropboxCode() {
  const code = await promptSheet({
    title: 'Cole o código do Dropbox',
    text: 'No Dropbox, toque em “Permitir”. Ele vai mostrar um código: copie, volte aqui e cole abaixo.',
    placeholder: 'Código de acesso',
    ok: 'Conectar',
    maxlength: 200,
  });
  if (!code) return;
  try {
    toast('Conectando ao Dropbox…', true);
    await dbx.finishAuth(code);
    toast('Dropbox conectado!');
    renderSyncButton();
    syncNow(false);
  } catch (err) {
    console.error(err);
    toast('Código inválido ou expirado. Tente conectar de novo.');
  }
}
async function handleDropboxReturn() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return false;
  history.replaceState(null, '', location.pathname);
  if (p.has('error')) { toast('Conexão com o Dropbox cancelada'); return false; }
  try {
    toast('Conectando ao Dropbox…', true);
    await dbx.finishAuth(p.get('code'), p.get('state'));
    toast('Dropbox conectado!');
    return true;
  } catch (err) {
    console.error(err);
    toast('Não consegui conectar ao Dropbox');
    return false;
  }
}
function dropboxBlockHTML() {
  if (!dbx.isConnected()) {
    return `<div class="info-block"><h4>Sincronizar com o Dropbox</h4>
      <p>Coloque músicas na pasta do app no Dropbox (pelo computador, por exemplo) e elas aparecem sozinhas no celular e no tablet. Subpastas viram playlists.</p>
      <div class="sheet-buttons start"><button class="pill" id="dbxConnect">Conectar Dropbox</button>${dbx.hasPendingAuth() && isStandalone() ? '<button class="pill ghost" id="dbxCode">Já tenho o código</button>' : ''}</div></div>`;
  }
  const a = dbx.account();
  const last = syncPrefs.last ? new Date(syncPrefs.last).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';
  return `<div class="info-block"><h4>Dropbox conectado</h4>
    ${a ? `<p>${esc(a.name)}${a.email ? ` · ${esc(a.email)}` : ''}</p>` : ''}
    <p class="note">Pasta: Dropbox › Aplicativos › Just Listening Thiago${DBX_ROOT ? ` › ${esc(DBX_ROOT.slice(1))} (teste)` : ''}<br>Cada subpasta é uma playlist: criar, renomear ou excluir uma playlist aqui faz o mesmo com a pasta.<br>Última sincronização: ${last}</p>
    <label class="switch-row"><span>Enviar as músicas deste aparelho para o Dropbox</span><input type="checkbox" class="switch" id="dbxUpload" ${syncPrefs.upload ? 'checked' : ''}></label>
    <div class="sheet-buttons start"><button class="pill" id="dbxSync">Sincronizar agora</button><button class="pill ghost" id="dbxOff">Desconectar</button></div></div>`;
}
function bindDropboxBlock(s, ready) {
  s.querySelector('#dbxConnect')?.addEventListener('click', () => { closeSheet(); connectDropbox(ready); });
  s.querySelector('#dbxCode')?.addEventListener('click', () => { closeSheet(); askDropboxCode(); });
  s.querySelector('#dbxSync')?.addEventListener('click', () => { closeSheet(); syncNow(false); });
  s.querySelector('#dbxUpload')?.addEventListener('change', (e) => { syncPrefs.upload = e.target.checked; saveSyncPrefs(); });
  s.querySelector('#dbxOff')?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: 'Desconectar o Dropbox?', text: 'As músicas continuam neste aparelho e no Dropbox. Só a sincronização para.', ok: 'Desconectar' }))) return;
    await dbx.disconnect();
    renderSyncButton();
    toast('Dropbox desconectado');
  });
}

// ---------------------------------------------------------------- edição
async function deleteTrack(id) {
  const remoteId = state.tracks.get(id)?.remote?.id;
  const hash = state.tracks.get(id)?.dbx?.hash;
  if (hash && !syncPrefs.ignoredHashes.includes(hash)) { syncPrefs.ignoredHashes.push(hash); saveSyncPrefs(); }
  else if (remoteId && !syncPrefs.ignored.includes(remoteId)) { syncPrefs.ignored.push(remoteId); saveSyncPrefs(); }
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
    if (p.trackIds.includes(id)) {
      p.trackIds = p.trackIds.filter((x) => x !== id);
      // excluir só neste aparelho não tira a música da playlist nos outros
      if (remoteId) p.missing = [...new Set([...(p.missing || []), remoteId])];
      await db.put('playlists', p);
    }
  }
  syncQueue();
  renderNow();
  render();
  saveState();
  toast('Música excluída');
}
// No modo Dropbox, playlist = pasta: estas ações também mexem nos arquivos de lá.
const usesFolder = (p) => isDbxPlaylist(p) && dbxMode() && p.folderPath;
const folderOf = (p) => ({ path_lower: p.id.slice(4), path_display: p.folderPath });

async function addToPlaylist(pid, ids) {
  const p = playlistById(pid);
  if (!p) return;
  const add = ids.filter((id) => !p.trackIds.includes(id));
  if (add.length && usesFolder(p)) {
    const ok = await dbxOp(add.length === 1 ? 'adicionando à pasta' : `adicionando ${add.length} músicas à pasta`,
      () => putTracksInFolder(add.map((id) => state.tracks.get(id)).filter(Boolean), folderOf(p)));
    if (!ok) return;
  }
  p.trackIds.push(...add);
  if (add.length) await touchPlaylist(p);
  if (state.q.source === pid) syncQueue();
  render();
  if (!add.length) toast('Já estava na playlist');
  else toast(add.length === 1 ? `Adicionada em “${p.name}”` : `${add.length} músicas adicionadas em “${p.name}”`);
}
async function removeFromPlaylist(pid, id) {
  const p = playlistById(pid);
  if (!p) return;
  if (usesFolder(p)) {
    const t = state.tracks.get(id);
    const ok = await dbxOp('tirando da pasta', () => takeTrackOutOfFolder(t, folderOf(p).path_lower));
    if (!ok) return;
  }
  p.trackIds = p.trackIds.filter((x) => x !== id);
  await touchPlaylist(p);
  if (state.q.source === pid) syncQueue();
  render();
  toast('Removida da playlist');
}
async function renamePlaylist(p, newName) {
  if (!usesFolder(p)) {
    p.name = newName;
    await touchPlaylist(p);
    return true;
  }
  const name = safeName(newName);
  const oldLower = p.id.slice(4);
  let meta;
  const ok = await dbxOp('renomeando a pasta', async () => { meta = await dbx.move(p.folderPath, `${DBX_ROOT}/${name}`); });
  if (!ok) return false;
  const newLower = meta.path_lower;
  // atualiza os caminhos dos arquivos das músicas
  for (const t of state.tracks.values()) {
    let touched = false;
    for (const [fid, path] of Object.entries(t.dbx?.files || {})) {
      if (path.toLowerCase().startsWith(`${oldLower}/`)) { t.dbx.files[fid] = meta.path_display + path.slice(oldLower.length); touched = true; }
    }
    if (touched) await db.put('tracks', t);
  }
  const oldId = p.id;
  await db.del('playlists', oldId);
  dropPlaylistCover(oldId);
  p.id = folderPid(newLower);
  p.name = folderTitle(meta.path_display);
  p.folderPath = meta.path_display;
  await touchPlaylist(p);
  replacePlaylistRefs(oldId, p.id);
  sortPlaylists();
  return true;
}
async function movePlaylistTrack(pid, i, dir) {
  const p = playlistById(pid);
  const j = i + dir;
  if (!p || j < 0 || j >= p.trackIds.length) return;
  [p.trackIds[i], p.trackIds[j]] = [p.trackIds[j], p.trackIds[i]];
  await touchPlaylist(p);
  if (state.q.source === pid) syncQueue();
  render();
}
async function newPlaylist(ids = []) {
  const name = await promptSheet({ title: 'Nova playlist', placeholder: 'Ex.: Para dormir', ok: 'Criar' });
  if (!name) return;
  let p;
  if (dbxMode()) {
    // cria a pasta no Dropbox
    const folderName = safeName(name);
    let meta;
    const ok = await dbxOp('criando a pasta', async () => { meta = await dbx.createFolder(`${DBX_ROOT}/${folderName}`); });
    if (!ok) return;
    const display = meta?.path_display || `${DBX_ROOT}/${folderName}`;
    const pid = folderPid(display.toLowerCase());
    p = playlistById(pid);
    if (!p) {
      p = { id: pid, name: folderTitle(display), folderPath: display, trackIds: [], createdAt: Date.now() };
      state.playlists.push(p);
      sortPlaylists();
    }
    await touchPlaylist(p);
    if (ids.length) await addToPlaylist(p.id, ids);
  } else {
    p = { id: uid(), name, trackIds: [...ids], createdAt: Date.now() };
    state.playlists.push(p);
    await touchPlaylist(p);
  }
  if (ids.length) { toast(`Playlist “${p.name}” criada`); render(); }
  else setView({ name: 'playlist', id: p.id });
}
async function deletePlaylist(pid) {
  const pl = playlistById(pid);
  if (pl && usesFolder(pl)) {
    // músicas que só estavam nesta pasta voltam para a pasta principal; cópias vão para a lixeira
    const folder = folderOf(pl);
    const ok = await dbxOp('excluindo a pasta', async () => {
      for (const t of state.tracks.values()) {
        if (trackFiles(t).some((f) => parentOf(f.lower) === folder.path_lower)) await takeTrackOutOfFolder(t, folder.path_lower);
      }
      const left = (await dbx.listEntries(folder.path_display)).filter((e) => e.path_lower !== folder.path_lower);
      if (!left.length) await dbx.remove(folder.path_display);
    });
    if (!ok) return;
  }
  state.playlists = state.playlists.filter((p) => p.id !== pid);
  await db.del('playlists', pid);
  dropPlaylistCover(pid);
  if (!isDbxPlaylist(pl)) syncPrefs.deletedPlaylists[pid] = Date.now();
  saveSyncPrefs();
  scheduleSync();
  if (sleepPrefs.source === pid) { sleepPrefs.source = 'library'; saveSleepPrefs(); }
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
function promptSheet({ title, text = '', value = '', placeholder = '', ok = 'Salvar', type = 'text', maxlength = 80 }) {
  return new Promise((resolve) => {
    openSheet(
      `<h3>${esc(title)}</h3>${text ? `<p style="margin:-6px 0 12px">${esc(text)}</p>` : ''}
      <form class="prompt">
        <input name="v" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" ${type === 'number' ? 'inputmode="numeric" min="1" max="1440"' : `maxlength="${maxlength}"`}>
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
    { label: t.fav ? 'Remover das favoritas' : 'Favoritar', icon: t.fav ? I.heartFill : I.heart, run: () => toggleFav(id) },
    { label: 'Letra', icon: I.lyrics, run: () => lyricsSheet(id) },
    { label: 'Adicionar à playlist', icon: I.plus, run: () => addToPlaylistSheet([id]) },
    { label: 'Editar nome e capa', icon: I.edit, run: () => editTrackSheet(id) },
  ];
  if (playlistById(src)) items.push({ label: 'Remover desta playlist', icon: I.minus, run: () => removeFromPlaylist(src, id) });
  items.push({
    label: 'Excluir do app', icon: I.trash, danger: true,
    run: async () => {
      const text = `“${t.title}” será apagada deste aparelho e de todas as playlists.${t.remote?.id ? ' A cópia no Dropbox continua lá.' : ''}`;
      if (await confirmSheet({ title: 'Excluir música?', text, ok: 'Excluir', danger: true })) deleteTrack(id);
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
        if (n && n !== p.name && await renamePlaylist(p, n)) {
          if (state.view.name === 'playlist') state.view = { name: 'playlist', id: p.id };
          render(); renderNow(); updateMediaSession();
          toast('Playlist renomeada');
        }
      },
    },
    { label: p.cover ? 'Trocar capa' : 'Escolher capa', icon: I.image, run: () => setPlaylistCover(pid) },
    ...(p.cover ? [{ label: 'Remover capa', icon: I.minus, run: () => removePlaylistCover(pid) }] : []),
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
// ---- favoritas, letras e capa da playlist
async function toggleFav(id) {
  const t = state.tracks.get(id);
  if (!t) return;
  t.fav = !t.fav;
  await touchTrack(t);
  render();
  if (id === state.currentId) renderFavButton();
  if (state.q.source === 'favorites') syncQueue();
  toast(t.fav ? 'Adicionada às favoritas ♥' : 'Removida das favoritas');
}
async function lyricsSheet(id) {
  const t = state.tracks.get(id);
  if (!t) return;
  // músicas importadas antes desta versão: tenta ler a letra do próprio arquivo
  if (!t.lyrics && /\.mp3$/i.test(t.fileName || '')) {
    try {
      const rec = await db.get('audio', id);
      const tags = rec ? await readTags(new Blob([rec.data])) : {};
      if (tags.lyrics) { t.lyrics = tags.lyrics; await db.put('tracks', t); }
    } catch { /* ignore */ }
  }
  const viewHTML = () => (t.lyrics
    ? `<div class="lyrics">${esc(t.lyrics)}</div>`
    : '<p class="note lyrics-empty">Esta música ainda não tem letra. Toque em “Adicionar” e cole a letra (por exemplo, a do Suno).</p>');
  openSheet(
    `<div class="sheet-head"><h3>Letra</h3><button class="link-btn" id="lyEdit">${t.lyrics ? 'Editar' : 'Adicionar'}</button></div>
     <div class="s lyrics-title">${esc(t.title)}${t.artist ? ` · ${esc(t.artist)}` : ''}</div>
     <div class="lyrics-body" id="lyBody">${viewHTML()}</div>`,
    (s) => {
      s.querySelector('#lyEdit').addEventListener('click', (e) => {
        e.currentTarget.hidden = true;
        s.querySelector('#lyBody').innerHTML = `<textarea id="lyText" class="lyrics-input" placeholder="Cole a letra aqui…">${esc(t.lyrics || '')}</textarea>
          <div class="sheet-buttons"><button class="pill ghost" id="lyCancel">Cancelar</button><button class="pill" id="lySave">Salvar</button></div>`;
        const ta = s.querySelector('#lyText');
        setTimeout(() => { try { ta.focus(); } catch { /* ignore */ } }, 60);
        s.querySelector('#lyCancel').addEventListener('click', () => { closeSheet(); });
        s.querySelector('#lySave').addEventListener('click', async () => {
          t.lyrics = ta.value.replace(/\r\n?/g, '\n').trim();
          await touchTrack(t);
          closeSheet();
          toast(t.lyrics ? 'Letra salva' : 'Letra removida');
        });
      });
    },
    'col lyrics-sheet',
  );
}
function setPlaylistCover(pid) {
  pickCover(async (file) => {
    const p = playlistById(pid);
    const c = await shrinkImage(file, 400);
    if (!p || !c) { toast('Não consegui ler essa imagem'); return; }
    dropPlaylistCover(pid);
    p.cover = c;
    await touchPlaylist(p);
    render();
    if (state.q.source === pid) { renderNow(); updateMediaSession(); }
    toast('Capa da playlist atualizada');
  });
}
async function removePlaylistCover(pid) {
  const p = playlistById(pid);
  if (!p) return;
  dropPlaylistCover(pid);
  p.cover = null;
  await touchPlaylist(p);
  render();
  if (state.q.source === pid) { renderNow(); updateMediaSession(); }
}

// ---- Modo Dormir: ajustes
function sleepSettingsSheet() {
  const sources = [['library', 'Todas as músicas'], ['favorites', 'Favoritas'], ...state.playlists.map((p) => [p.id, p.name])];
  const opts = [30, 45, 60, 90, 120];
  let minutes = sleepPrefs.minutes;
  openSheet(
    `<h3>Modo Dormir</h3>
     <label class="field"><span>O que tocar</span>
       <select id="slSource" class="select">${sources.map(([v, n]) => `<option value="${esc(v)}" ${v === sleepPrefs.source ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
     </label>
     <div class="field"><span>Parar depois de</span>
       <div class="grid five" id="slMin">${opts.map((m) => `<button class="opt ${m === minutes ? 'sel' : ''}" data-min="${m}">${fmtMinutes(m)}</button>`).join('')}</div>
     </div>
     <label class="switch-row"><span>Esperar a música terminar antes de parar</span><input type="checkbox" class="switch" id="slWait" ${sleepPrefs.wait ? 'checked' : ''}></label>
     <label class="switch-row"><span>Ordem aleatória</span><input type="checkbox" class="switch" id="slShuffle" ${sleepPrefs.shuffle ? 'checked' : ''}></label>
     <p class="note">A playlist toca repetindo até o timer acabar.</p>
     <div class="sheet-buttons"><button class="pill ghost" id="slSave">Salvar</button><button class="pill" id="slGo">${I.moon} Dormir agora</button></div>`,
    (s) => {
      s.querySelector('#slMin').addEventListener('click', (e) => {
        const b = e.target.closest('[data-min]');
        if (!b) return;
        minutes = +b.dataset.min;
        s.querySelectorAll('#slMin .opt').forEach((x) => x.classList.toggle('sel', x === b));
      });
      const save = () => {
        sleepPrefs.source = s.querySelector('#slSource').value;
        sleepPrefs.minutes = minutes;
        sleepPrefs.wait = s.querySelector('#slWait').checked;
        sleepPrefs.shuffle = s.querySelector('#slShuffle').checked;
        saveSleepPrefs();
      };
      s.querySelector('#slSave').addEventListener('click', () => { save(); closeSheet(); render(); toast('Modo Dormir salvo'); });
      s.querySelector('#slGo').addEventListener('click', () => { save(); closeSheet(); render(); startSleep(); });
    },
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
        await touchTrack(t);
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
     <label class="switch-row"><span>Esperar a música terminar antes de parar</span><input type="checkbox" class="switch" id="waitChk" ${state.timerWait ? 'checked' : ''}></label>
     <label class="switch-row"><span>Diminuir o volume aos poucos no final</span><input type="checkbox" class="switch" id="fadeChk" ${state.fade ? 'checked' : ''}></label>
     ${volumeWorks ? '<p class="note">Com “esperar a música terminar”, o volume não diminui: a música acaba naturalmente.</p>' : '<p class="note">No iPhone, o iOS não deixa apps da web mudarem o volume. Ligue “esperar a música terminar” para não cortar a música no meio.</p>'}`,
    (s) => {
      renderTimer();
      s.querySelector('#waitChk').addEventListener('change', (e) => { state.timerWait = e.target.checked; saveState(); });
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
  const ready = dbx.isConnected() ? null : dbx.prepareAuth();
  if (ready) ready.catch(() => {});
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
     ${dropboxBlockHTML()}
     ${installEvent ? '<div class="info-block"><h4>Instalar o app</h4><p>Coloque o Just Listening na tela inicial deste aparelho.</p><div class="sheet-buttons" style="justify-content:flex-start;margin-top:10px"><button class="pill" id="doInstall">Instalar</button></div></div>' : ''}
     <div class="info-block"><h4>Instalar no iPhone</h4><ol><li>Abra este site no Safari.</li><li>Toque em Compartilhar (quadrado com seta).</li><li>Escolha “Adicionar à Tela de Início”.</li><li>Abra pelo ícone e importe as músicas lá.</li></ol></div>
     <div class="info-block"><h4>Instalar no Android</h4><ol><li>Abra este site no Chrome.</li><li>Toque no menu ⋮.</li><li>Escolha “Instalar app” ou “Adicionar à tela inicial”.</li></ol></div>
     ${storage}
     <div class="info-block"><p>${plural(tracks, 'música guardada', 'músicas guardadas')} · ${plural(state.playlists.length, 'playlist', 'playlists')}. ${dbx.isConnected() ? 'As músicas ficam guardadas neste aparelho e são sincronizadas só com a sua pasta do Dropbox.' : 'Suas músicas ficam só neste aparelho: nada é enviado para a internet.'}</p><p class="note">Versão ${VERSION}</p></div>`,
    (s) => {
      bindDropboxBlock(s, ready);
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
  const tab = state.view.name === 'library' ? 'library' : 'playlists';
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  if (state.view.name === 'library') renderLibrary();
  else if (state.view.name === 'playlists') renderPlaylists();
  else if (state.view.name === 'favorites') renderFavorites();
  else renderPlaylist(state.view.id);
}
function renderFavorites() {
  const view = $('#view');
  const ids = favoriteIds();
  const dur = ids.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
  view.innerHTML = `<div class="pl-head">
      <button class="icon-btn" data-act="back" aria-label="Voltar">${I.back}</button>
      <div class="cover lg fav-cover pl-head-cover">${I.heartFill}</div>
      <div class="pl-head-text"><h2>Favoritas</h2><div class="s">${plural(ids.length, 'música', 'músicas')}${dur ? ' · ' + fmtLong(dur) : ''}</div></div>
    </div>
    <div class="list-head"><div class="count"></div><div class="head-actions"><button class="pill ghost" data-act="shuffleAll" ${ids.length ? '' : 'disabled'}>${I.shuffle} Aleatório</button><button class="pill" data-act="playAll" ${ids.length ? '' : 'disabled'}>${I.play} Tocar</button></div></div>
    ${ids.length ? `<ul class="list">${ids.map((id) => trackRow(state.tracks.get(id), 'favorites')).join('')}</ul>`
    : `<div class="empty small"><p>Toque no ${I.heart.replace('<svg', '<svg class="inline-icon"')} no player, ou em ⋯ → Favoritar, e a música aparece aqui.</p></div>`}`;
}
const playingNow = () => state.currentId && !audio.paused && !isSilent();
function eqHTML() { return `<span class="eq ${playingNow() ? '' : 'paused'}"><i></i><i></i><i></i></span>`; }
function trackRow(t, src) {
  const playing = t.id === state.currentId;
  const sub = [t.artist, t.duration ? fmt(t.duration) : ''].filter(Boolean).join(' · ');
  const fav = t.fav ? `<span class="fav-mark" aria-label="Favorita">${I.heartFill}</span>` : '';
  return `<li class="row ${playing ? 'playing' : ''}" data-id="${t.id}">
    <button class="row-main" data-act="play">${coverHTML(t, 'sm')}<div class="row-text"><div class="t">${esc(t.title)}</div><div class="s">${fav}${esc(sub)}</div></div>${playing ? eqHTML() : ''}</button>
    <button class="icon-btn" data-act="more" aria-label="Opções de ${esc(t.title)}">${I.more}</button>
  </li>`;
}
const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function filteredLibraryIds() {
  const q = normalize(state.query).trim();
  const ids = libraryIds();
  if (!q) return ids;
  return ids.filter((id) => {
    const t = state.tracks.get(id);
    return normalize(`${t.title} ${t.artist || ''} ${t.fileName || ''}`).includes(q);
  });
}
// Atualiza só a lista (e não a busca), para não fechar o teclado enquanto digita.
function renderLibraryList() {
  const list = $('#libList');
  if (!list) return;
  const all = libraryIds();
  const ids = filteredLibraryIds();
  const total = all.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
  $('#libCount').textContent = state.query.trim()
    ? `${ids.length} de ${plural(all.length, 'música', 'músicas')}`
    : `${plural(all.length, 'música', 'músicas')}${total ? ' · ' + fmtLong(total) : ''}`;
  list.innerHTML = ids.length
    ? ids.map((id) => trackRow(state.tracks.get(id), 'library')).join('')
    : '<li class="empty small"><p>Nenhuma música encontrada.</p></li>';
}
function renderLibrary() {
  const ids = libraryIds();
  const view = $('#view');
  if (ids.length && $('#libSearch')) { renderLibraryList(); return; }
  if (!ids.length) {
    view.innerHTML = `<div class="empty">
      <div class="empty-art">${I.note}</div>
      <h2>Suas músicas, do seu jeito</h2>
      <p>Importe os arquivos que você baixou (MP3, M4A, WAV…) ou um vídeo (MP4, MOV): o app guarda só o áudio. Tudo fica neste aparelho e toca sem internet.</p>
      <button class="pill big" data-act="import">${I.upload} Importar músicas</button>
      <p class="hint">${isIOS ? 'No iPhone, os arquivos aparecem no app Arquivos (normalmente em “Downloads”). Dá para selecionar vários de uma vez.' : 'Você pode selecionar vários arquivos de uma vez.'}</p>
    </div>`;
    return;
  }
  view.innerHTML = `<div class="lib-tools">
      <label class="search">${I.search}<input id="libSearch" type="search" placeholder="Buscar música" value="${esc(state.query)}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>
      <select id="libSort" aria-label="Ordenar músicas">
        <option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Recentes</option>
        <option value="az" ${state.sort === 'az' ? 'selected' : ''}>A–Z</option>
        <option value="za" ${state.sort === 'za' ? 'selected' : ''}>Z–A</option>
      </select>
    </div>
    <div class="list-head">
      <div class="count" id="libCount"></div>
      <div class="head-actions"><button class="pill ghost" data-act="shuffleAll">${I.shuffle} Aleatório</button><button class="pill" data-act="playAll">${I.play} Tocar</button></div>
    </div>
    <ul class="list" id="libList"></ul>`;
  renderLibraryList();
}
function renderPlaylists() {
  const view = $('#view');
  const rows = state.playlists.map((p) => {
    const ids = sourceIds(p.id);
    const dur = ids.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
    const playing = state.q.source === p.id && state.currentId;
    return `<li class="row ${playing ? 'playing' : ''}" data-pid="${esc(p.id)}">
      <button class="row-main" data-act="openPlaylist">${playlistCoverHTML(p, 'sm')}<div class="row-text"><div class="t">${esc(p.name)}</div><div class="s">${plural(ids.length, 'música', 'músicas')}${dur ? ' · ' + fmtLong(dur) : ''}</div></div>${playing ? eqHTML() : ''}</button>
      <button class="icon-btn" data-act="playlistMore" aria-label="Opções da playlist">${I.more}</button>
    </li>`;
  }).join('');
  const all = libraryIds();
  const allDur = all.reduce((s, id) => s + (state.tracks.get(id).duration || 0), 0);
  const allRow = all.length ? `<li class="row" data-pid="__all">
      <button class="row-main" data-act="openLibrary"><div class="cover sm all-cover">${I.note}</div><div class="row-text"><div class="t">Todas as músicas</div><div class="s">${plural(all.length, 'música', 'músicas')}${allDur ? ' · ' + fmtLong(allDur) : ''}</div></div>${state.q.source === 'library' && state.currentId ? eqHTML() : ''}</button>
      <span class="icon-btn" aria-hidden="true">${I.goto}</span>
    </li>` : '';
  const favs = favoriteIds();
  const favRow = all.length ? `<li class="row" data-pid="__fav">
      <button class="row-main" data-act="openFavorites"><div class="cover sm fav-cover">${I.heartFill}</div><div class="row-text"><div class="t">Favoritas</div><div class="s">${plural(favs.length, 'música', 'músicas')}</div></div>${state.q.source === 'favorites' && state.currentId ? eqHTML() : ''}</button>
      <span class="icon-btn" aria-hidden="true">${I.goto}</span>
    </li>` : '';
  const sleepCard = all.length ? `<div class="sleep-card">
      <button class="sleep-main" data-act="sleep"><span class="sleep-moon">${I.moon}</span><div class="row-text"><div class="t">Dormir</div><div class="s">${esc(sleepSummary())}</div></div></button>
      <button class="icon-btn" data-act="sleepSettings" aria-label="Ajustar o Modo Dormir">${I.gear}</button>
    </div>` : '';
  view.innerHTML = `${sleepCard}<div class="list-head">
      <div class="count">${plural(state.playlists.length, 'playlist', 'playlists')}</div>
      <button class="pill" data-act="newPlaylist">${I.plus} Nova playlist</button>
    </div>
    <ul class="list">${allRow}${favRow}${rows}</ul>
    ${rows ? '' : '<div class="empty small"><p>Crie playlists para organizar suas músicas. Por exemplo, uma só para dormir, com repetição ligada. Se usar o Dropbox, cada subpasta vira uma playlist.</p></div>'}`;
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
      <button class="pl-head-cover" data-act="plCover" aria-label="Capa da playlist">${playlistCoverHTML(p, 'lg')}</button>
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
  $('#miniCover').innerHTML = nowArtHTML(t, 'sm');
  $('#miniTitle').textContent = t.title;
  $('#miniSub').innerHTML = `<span class="moon-badge" id="miniBadge" hidden>${I.moon}</span>${esc(t.artist || sourceName(state.q.source))}`;
  $('#plCover').innerHTML = nowArtHTML(t, 'xl');
  renderFavButton();
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
function renderFavButton() {
  const t = state.tracks.get(state.currentId);
  const b = $('#btnFav');
  if (!b || !t) return;
  b.innerHTML = t.fav ? I.heartFill : I.heart;
  b.classList.toggle('on', !!t.fav);
  b.setAttribute('aria-label', t.fav ? 'Remover das favoritas' : 'Favoritar');
  b.setAttribute('aria-pressed', !!t.fav);
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
function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').classList.remove('show');
}
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
  $('#btnSync').innerHTML = I.cloud;
  $('#btnSync').addEventListener('click', () => syncNow(false));
  $('#btnImport').innerHTML = `${I.upload}<span>Importar</span>`;
  $('#plClose').innerHTML = I.down;
  $('#plMore').innerHTML = I.more;
  $('#miniNext').innerHTML = I.next;
  $('#btnPrev').innerHTML = I.prev;
  $('#btnNext').innerHTML = I.next;
  $('#btnShuffle').innerHTML = I.shuffle;
  $('#timerIcon').innerHTML = I.moon;
  $('#lyricsIcon').innerHTML = I.lyrics;

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setView({ name: b.dataset.tab })));
  $('#btnImport').addEventListener('click', () => pickFiles(state.view.name === 'playlist' ? state.view.id : null));
  $('#btnInfo').addEventListener('click', infoSheet);
  $('#fileInput').addEventListener('change', (e) => {
    const files = [...e.target.files];
    if (files.length) importFiles(files, importTarget);
  });

  $('#view').addEventListener('input', (e) => {
    if (e.target.id !== 'libSearch') return;
    state.query = e.target.value;
    renderLibraryList();
  });
  $('#view').addEventListener('change', (e) => {
    if (e.target.id !== 'libSort') return;
    state.sort = e.target.value;
    if (state.q.source === 'library') syncQueue();
    renderLibraryList();
    saveState();
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
      case 'openLibrary': setView({ name: 'library' }); break;
      case 'openFavorites': setView({ name: 'favorites' }); break;
      case 'sleep': startSleep(); break;
      case 'sleepSettings': sleepSettingsSheet(); break;
      case 'plCover': setPlaylistCover(state.view.id); break;
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
  $('#btnFav').addEventListener('click', () => { if (state.currentId) toggleFav(state.currentId); });
  $('#btnLyrics').addEventListener('click', () => { if (state.currentId) lyricsSheet(state.currentId); });
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
  document.addEventListener('visibilitychange', () => {
    tickTimer();
    if (document.hidden) { saveState(); return; }
    // ao voltar para o app, busca músicas novas no Dropbox (no máximo a cada 5 min)
    if (dbx.isConnected() && Date.now() - (syncPrefs.last || 0) > 5 * 60000) syncNow(true);
  });
  window.addEventListener('online', () => { if (dbx.isConnected()) syncNow(true); });
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
  state.sort = ['recent', 'az', 'za'].includes(s.sort) ? s.sort : 'recent';
  state.timerWait = s.timerWait !== false;
  // Abre nas playlists; sem nenhuma música ainda, abre na tela de importar.
  state.view = { name: state.tracks.size ? 'playlists' : 'library' };
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
  const justConnected = await handleDropboxReturn();
  renderSyncButton();
  if (dbx.isConnected()) setTimeout(() => syncNow(!justConnected), justConnected ? 300 : 1500);

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
window.JustListening = { state, importFiles, setTimer, audioFromVideo, syncNow, addToPlaylist, removeFromPlaylist, movePlaylistTrack, renamePlaylist, deletePlaylist, VERSION };

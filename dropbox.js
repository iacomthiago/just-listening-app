// Integração com o Dropbox: login OAuth 2 com PKCE (sem servidor) e chamadas da API.
// O app só tem acesso à própria pasta: Dropbox › Aplicativos › Just Listening Thiago.

export const APP_KEY = '6n6i790kbgpxwgi';
export const REDIRECT_URI = new URL('./', location.href).href;
const AUTH_KEY = 'just-listening-dropbox';
const PENDING_KEY = 'just-listening-dropbox-pending';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
const save = (k, v) => {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

let auth = load(AUTH_KEY); // { refresh, access, expires, account }
export const isConnected = () => !!auth?.refresh;
export const account = () => auth?.account || null;
export const hasPendingAuth = () => !!load(PENDING_KEY);

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomString(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a).slice(0, n);
}

// Prepara o PKCE com antecedência, para abrir o Dropbox direto no toque do botão.
let prepared = null;
export async function prepareAuth() {
  const verifier = randomString(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  prepared = { verifier, challenge, state: randomString(16) };
  return prepared;
}

// useRedirect = true: o Dropbox volta para o app sozinho.
// useRedirect = false: o Dropbox mostra um código para copiar e colar no app
// (mais confiável no app instalado na Tela de Início do iPhone).
export function authorizeUrl(useRedirect) {
  const p = prepared;
  if (!p) throw new Error('prepareAuth() não foi chamado');
  save(PENDING_KEY, { verifier: p.verifier, state: p.state, redirect: useRedirect ? REDIRECT_URI : null });
  const q = new URLSearchParams({
    client_id: APP_KEY,
    response_type: 'code',
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  if (useRedirect) { q.set('redirect_uri', REDIRECT_URI); q.set('state', p.state); }
  prepared = null;
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}

async function tokenRequest(params) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error_description || data.error || `token ${res.status}`);
    e.code = data.error;
    throw e;
  }
  return data;
}

export async function finishAuth(code, stateParam) {
  const pending = load(PENDING_KEY);
  if (!pending) throw new Error('Nenhuma conexão em andamento');
  if (pending.redirect && stateParam !== pending.state) throw new Error('state inválido');
  const params = { code: String(code).trim(), grant_type: 'authorization_code', code_verifier: pending.verifier, client_id: APP_KEY };
  if (pending.redirect) params.redirect_uri = pending.redirect;
  const data = await tokenRequest(params);
  auth = { refresh: data.refresh_token, access: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000, account: null };
  save(AUTH_KEY, auth);
  save(PENDING_KEY, null);
  try {
    const a = await (await rpc('users/get_current_account', null)).json();
    auth.account = { name: a.name?.display_name || '', email: a.email || '' };
    save(AUTH_KEY, auth);
  } catch { /* opcional */ }
}

async function accessToken() {
  if (!auth?.refresh) throw new Error('Dropbox não conectado');
  if (auth.access && Date.now() < auth.expires) return auth.access;
  let data;
  try {
    data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh, client_id: APP_KEY });
  } catch (e) {
    if (e.code === 'invalid_grant') disconnectLocal(); // acesso revogado no Dropbox
    throw e;
  }
  auth.access = data.access_token;
  auth.expires = Date.now() + (data.expires_in - 60) * 1000;
  save(AUTH_KEY, auth);
  return auth.access;
}

// O cabeçalho Dropbox-API-Arg só aceita ASCII: acentos viram \uXXXX.
const headerJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

async function call(url, { arg, json, body } = {}, retry = true) {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  let payload;
  if (arg !== undefined) headers['Dropbox-API-Arg'] = headerJson(arg);
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(json); }
  else if (body !== undefined) { headers['Content-Type'] = 'application/octet-stream'; payload = body; }
  const res = await fetch(url, { method: 'POST', headers, body: payload });
  if (res.status === 401 && retry) { auth.access = null; return call(url, { arg, json, body }, false); }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = new Error(`Dropbox ${res.status}: ${text.slice(0, 300)}`);
    e.status = res.status;
    e.body = text;
    throw e;
  }
  return res;
}
const rpc = (endpoint, json) => call(`https://api.dropboxapi.com/2/${endpoint}`, { json });

// Todos os arquivos da pasta do app (incluindo subpastas).
export async function listFiles() {
  let res = await (await rpc('files/list_folder', { path: '', recursive: true, include_deleted: false, limit: 2000 })).json();
  const out = [...res.entries];
  while (res.has_more) {
    res = await (await rpc('files/list_folder/continue', { cursor: res.cursor })).json();
    out.push(...res.entries);
  }
  return out.filter((e) => e['.tag'] === 'file');
}

export async function download(id) {
  const res = await call('https://content.dropboxapi.com/2/files/download', { arg: { path: id } });
  return res.arrayBuffer();
}

export async function upload(path, data) {
  const res = await call('https://content.dropboxapi.com/2/files/upload', { arg: { path, mode: 'add', autorename: true, mute: true }, body: data });
  return res.json();
}

function disconnectLocal() {
  auth = null;
  save(AUTH_KEY, null);
}
export async function disconnect() {
  try { await rpc('auth/token/revoke', null); } catch { /* ignore */ }
  disconnectLocal();
}

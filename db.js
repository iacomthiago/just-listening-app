// Banco local (IndexedDB). Os áudios são guardados como ArrayBuffer,
// que funciona de forma confiável no Safari do iPhone.
//   tracks    -> dados da música (nome, artista, duração, capa)
//   audio     -> o arquivo de áudio em si (chave = id da música)
//   playlists -> { id, name, trackIds[], createdAt }

const DB_NAME = 'just-listening';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const request = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const done = (t) => new Promise((resolve, reject) => {
  t.oncomplete = () => resolve();
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error || new DOMException('Transação abortada', 'AbortError'));
});

export async function getAll(store) {
  const db = await open();
  return request(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await open();
  return request(db.transaction(store).objectStore(store).get(key));
}

export async function put(store, value, key) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  if (key === undefined) s.put(value); else s.put(value, key);
  return done(t);
}

export async function del(store, key) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(key);
  return done(t);
}

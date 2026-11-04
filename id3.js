// Leitor mínimo de tags ID3v2 (MP3): título, artista e capa.
// Suporta ID3v2.2, v2.3 e v2.4.

const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function decode(bytes, enc) {
  try {
    if (enc === 0) return new TextDecoder('iso-8859-1').decode(bytes);
    if (enc === 1) {
      const be = bytes[0] === 0xfe && bytes[1] === 0xff;
      return new TextDecoder(be ? 'utf-16be' : 'utf-16le').decode(bytes);
    }
    if (enc === 2) return new TextDecoder('utf-16be').decode(bytes);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function text(data) {
  const s = decode(data.subarray(1), data[0]);
  // v2.4 permite vários valores separados por \0: fica com o primeiro.
  return s.replace(/^﻿/, '').split('\u0000').find((x) => x.trim()) || '';
}

function picture(data, v22) {
  const enc = data[0];
  let p = 1;
  let mime;
  if (v22) {
    const fmt = String.fromCharCode(data[1], data[2], data[3]).toUpperCase();
    mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
    p = 4;
  } else {
    const end = data.indexOf(0, p);
    if (end < 0) return null;
    mime = new TextDecoder('iso-8859-1').decode(data.subarray(p, end)).toLowerCase() || 'image/jpeg';
    p = end + 1;
  }
  p += 1; // tipo da imagem
  // descrição terminada em \0 (ou \0\0 em UTF-16)
  if (enc === 1 || enc === 2) {
    while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < data.length && data[p] !== 0) p++;
    p += 1;
  }
  if (p >= data.length) return null;
  if (mime === 'image/jpg' || !mime.startsWith('image/')) mime = 'image/jpeg';
  return new Blob([data.slice(p)], { type: mime });
}

export async function readTags(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const ver = head[3];
  const flags = head[5];
  const size = syncsafe(head, 6);
  if (ver < 2 || ver > 4 || size <= 0) return {};
  const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());

  let pos = 0;
  if (flags & 0x40 && ver >= 3) pos = ver === 4 ? syncsafe(buf, 0) : be32(buf, 0) + 4;

  const idLen = ver === 2 ? 3 : 4;
  const hdrLen = ver === 2 ? 6 : 10;
  const out = {};

  while (pos + hdrLen <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    let fsize;
    if (ver === 2) fsize = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
    else if (ver === 4) fsize = syncsafe(buf, pos + 4);
    else fsize = be32(buf, pos + 4);
    const start = pos + hdrLen;
    const end = start + fsize;
    if (fsize <= 0 || end > buf.length) break;
    const data = buf.subarray(start, end);

    if (id === 'TIT2' || id === 'TT2') out.title = text(data);
    else if (id === 'TPE1' || id === 'TP1') out.artist = text(data);
    else if ((id === 'APIC' || id === 'PIC') && !out.picture) out.picture = picture(data, ver === 2);

    pos = end;
  }
  return out;
}

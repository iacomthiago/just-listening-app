// Extrai o áudio de um vídeo MP4/MOV sem recodificar.
// Lê o índice do vídeo (caixa "moov"), copia só os trechos de áudio e monta um .m4a novo.
// O vídeo é lido por partes (File.slice): mesmo vídeos grandes não enchem a memória.
// Funciona com MP4 comum (câmera, WhatsApp, YouTube Studio) e MP4 fragmentado (gravações de tela).

const enc = new TextEncoder();
const ascii = (s) => enc.encode(s);
const type4 = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const be64 = (b, o) => be32(b, o) * 2 ** 32 + be32(b, o + 4);
const s32 = (b, o) => be32(b, o) | 0;

export class VideoAudioError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code) => {
  const msg = {
    webm: 'Vídeos WebM ainda não são suportados (use MP4 ou MOV)',
    notmp4: 'Formato de vídeo não reconhecido (use MP4 ou MOV)',
    noaudio: 'Este vídeo não tem som',
    broken: 'Não consegui ler este vídeo',
  }[code];
  return new VideoAudioError(code, msg);
};

async function read(file, start, end) {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

// Caixas de nível superior do arquivo (lendo só os cabeçalhos).
async function topBoxes(file) {
  const out = [];
  let pos = 0;
  while (pos + 8 <= file.size) {
    const h = await read(file, pos, Math.min(file.size, pos + 16));
    let size = be32(h, 0);
    const type = type4(h, 4);
    let hdr = 8;
    if (size === 1) { size = be64(h, 8); hdr = 16; } else if (size === 0) size = file.size - pos;
    if (size < hdr || !/^[\x20-\x7e]{4}$/.test(type)) break;
    out.push({ type, start: pos, size, hdr });
    pos += size;
  }
  return out;
}

function children(buf, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = be32(buf, p);
    const type = type4(buf, p + 4);
    let hdr = 8;
    if (size === 1) { size = be64(buf, p + 8); hdr = 16; } else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) break;
    out.push({ type, start: p, size, hdr });
    p += size;
  }
  return out;
}
const kids = (buf, box) => children(buf, box.start + box.hdr, box.start + box.size);
const child = (buf, box, type) => box && kids(buf, box).find((c) => c.type === type);
const raw = (buf, box) => buf.subarray(box.start, box.start + box.size);
const body = (box) => box.start + box.hdr; // início do conteúdo

// ---- escrita de caixas
function box(type, ...parts) {
  parts = parts.filter(Boolean);
  const len = 8 + parts.reduce((s, p) => s + p.length, 0);
  const b = new Uint8Array(len);
  new DataView(b.buffer).setUint32(0, len);
  b.set(ascii(type), 4);
  let o = 8;
  for (const p of parts) { b.set(p, o); o += p.length; }
  return b;
}
function u32s(...vals) {
  const b = new Uint8Array(vals.length * 4);
  const dv = new DataView(b.buffer);
  vals.forEach((v, i) => dv.setUint32(i * 4, v >>> 0));
  return b;
}
const fullbox = (type, ...parts) => box(type, u32s(0), ...parts);
function runLength(values) { // [[count, value], ...]
  const out = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && last[1] === v) last[0]++; else out.push([1, v]);
  }
  return out;
}
function sttsFrom(durations) {
  const rl = runLength(durations);
  return fullbox('stts', u32s(rl.length, ...rl.flat()));
}
function stszFrom(sizes) {
  const same = sizes.length && sizes.every((s) => s === sizes[0]);
  return same ? fullbox('stsz', u32s(sizes[0], sizes.length)) : fullbox('stsz', u32s(0, sizes.length, ...sizes));
}
function stscFrom(counts) {
  const entries = [];
  counts.forEach((n, i) => {
    const last = entries[entries.length - 1];
    if (!last || last[1] !== n) entries.push([i + 1, n, 1]);
  });
  return fullbox('stsc', u32s(entries.length, ...entries.flat()));
}
const stcoFrom = (offsets) => fullbox('stco', u32s(offsets.length, ...offsets));

// Copia uma caixa trocando o campo "duração" (mvhd, mdhd, tkhd).
function withDuration(buf, b, duration) {
  const out = raw(buf, b).slice();
  const v = out[b.hdr];
  const dv = new DataView(out.buffer);
  const at = b.type === 'tkhd' ? (v === 1 ? 28 : 20) : (v === 1 ? 24 : 16);
  const o = b.hdr + at;
  if (v === 1) { dv.setUint32(o, Math.floor(duration / 2 ** 32)); dv.setUint32(o + 4, duration >>> 0); } else dv.setUint32(o, Math.min(duration, 0xffffffff));
  return out;
}
const timescaleOf = (buf, b) => be32(buf, body(b) + (buf[body(b)] === 1 ? 20 : 12));

// ---- leitura das amostras de áudio
// MP4 comum: tabelas stsz/stsc/stco dizem onde está cada pedaço de áudio.
function samplesFromTables(moov, stbl) {
  const stsz = child(moov, stbl, 'stsz');
  const stsc = child(moov, stbl, 'stsc');
  const stco = child(moov, stbl, 'stco') || child(moov, stbl, 'co64');
  if (!stsz || !stsc || !stco) return null;
  const zp = body(stsz);
  const fixed = be32(moov, zp + 4);
  const count = be32(moov, zp + 8);
  if (!count) return null;
  const sizeOf = (i) => fixed || be32(moov, zp + 12 + i * 4);
  const cp = body(stco);
  const nChunks = be32(moov, cp + 4);
  const is64 = stco.type === 'co64';
  const sp = body(stsc);
  const ent = Array.from({ length: be32(moov, sp + 4) }, (_, i) => ({ first: be32(moov, sp + 8 + i * 12), per: be32(moov, sp + 12 + i * 12) }));
  const chunks = [];
  let s = 0, e = 0;
  for (let c = 0; c < nChunks && s < count; c++) {
    while (e + 1 < ent.length && c + 1 >= ent[e + 1].first) e++;
    const per = ent[e]?.per || 0;
    let len = 0, n = 0;
    for (; n < per && s < count; n++, s++) len += sizeOf(s);
    chunks.push({ off: is64 ? be64(moov, cp + 8 + c * 8) : be32(moov, cp + 8 + c * 4), len, count: n });
  }
  return { chunks, fragmented: false };
}

// MP4 fragmentado: as amostras estão espalhadas em caixas moof/trun.
async function samplesFromFragments(file, tops, moov, mvex, trackId) {
  let defDur = 0, defSize = 0;
  for (const t of mvex ? kids(moov, mvex) : []) {
    if (t.type === 'trex' && be32(moov, body(t) + 4) === trackId) {
      defDur = be32(moov, body(t) + 12);
      defSize = be32(moov, body(t) + 16);
    }
  }
  const chunks = [], sizes = [], durations = [];
  for (const top of tops) {
    if (top.type !== 'moof') continue;
    const moof = await read(file, top.start, top.start + top.size);
    const root = { type: 'moof', start: 0, size: moof.length, hdr: top.hdr };
    for (const traf of kids(moof, root).filter((b) => b.type === 'traf')) {
      const tfhd = child(moof, traf, 'tfhd');
      if (!tfhd) continue;
      let p = body(tfhd);
      const flags = be32(moof, p) & 0xffffff;
      if (be32(moof, p + 4) !== trackId) continue;
      p += 8;
      let base = top.start;
      if (flags & 0x1) { base = be64(moof, p); p += 8; }
      if (flags & 0x2) p += 4;
      let tDur = defDur, tSize = defSize;
      if (flags & 0x8) { tDur = be32(moof, p); p += 4; }
      if (flags & 0x10) { tSize = be32(moof, p); p += 4; }
      for (const trun of kids(moof, traf).filter((b) => b.type === 'trun')) {
        let q = body(trun);
        const tf = be32(moof, q) & 0xffffff;
        const n = be32(moof, q + 4);
        q += 8;
        let dataOff = 0;
        if (tf & 0x1) { dataOff = s32(moof, q); q += 4; }
        if (tf & 0x4) q += 4;
        let len = 0;
        for (let i = 0; i < n; i++) {
          let d = tDur, sz = tSize;
          if (tf & 0x100) { d = be32(moof, q); q += 4; }
          if (tf & 0x200) { sz = be32(moof, q); q += 4; }
          if (tf & 0x400) q += 4;
          if (tf & 0x800) q += 4;
          durations.push(d);
          sizes.push(sz);
          len += sz;
        }
        if (n) chunks.push({ off: base + dataOff, len, count: n });
      }
    }
  }
  if (!sizes.length) return null;
  return { chunks, sizes, durations, fragmented: true };
}

/**
 * Extrai o áudio de um vídeo. Devolve um File .m4a (audio/mp4).
 * onProgress(0..1) é opcional.
 */
export async function extractAudio(file, onProgress) {
  const head = await read(file, 0, Math.min(file.size, 12));
  if (head.length >= 4 && be32(head, 0) === 0x1a45dfa3) throw fail('webm');
  const tops = await topBoxes(file);
  const moovTop = tops.find((b) => b.type === 'moov');
  if (!moovTop || !tops.some((b) => b.type === 'ftyp' || b.type === 'mdat' || b.type === 'moof')) throw fail('notmp4');
  const moov = await read(file, moovTop.start, moovTop.start + moovTop.size);
  const root = { type: 'moov', start: 0, size: moov.length, hdr: moovTop.hdr };

  // faixa de áudio (handler "soun")
  let trak = null, mdia = null, hdlr = null;
  for (const t of kids(moov, root).filter((b) => b.type === 'trak')) {
    const m = child(moov, t, 'mdia');
    const h = child(moov, m, 'hdlr');
    if (h && type4(moov, body(h) + 8) === 'soun') { trak = t; mdia = m; hdlr = h; break; }
  }
  if (!trak) throw fail('noaudio');
  const mvhd = child(moov, root, 'mvhd');
  const tkhd = child(moov, trak, 'tkhd');
  const edts = child(moov, trak, 'edts');
  const mdhd = child(moov, mdia, 'mdhd');
  const minf = child(moov, mdia, 'minf');
  const smhd = child(moov, minf, 'smhd');
  const dinf = child(moov, minf, 'dinf');
  const stbl = child(moov, minf, 'stbl');
  const stsd = child(moov, stbl, 'stsd');
  if (!mvhd || !tkhd || !mdhd || !stbl || !stsd) throw fail('broken');
  const codec = type4(moov, body(stsd) + 12);
  const trackId = be32(moov, body(tkhd) + (moov[body(tkhd)] === 1 ? 20 : 12));

  let info = samplesFromTables(moov, stbl);
  if (!info) info = await samplesFromFragments(file, tops, moov, child(moov, root, 'mvex'), trackId);
  if (!info || !info.chunks.length) throw fail('noaudio');

  // lê os pedaços de áudio (juntando os que estão colados no arquivo)
  const parts = [];
  const total = info.chunks.reduce((s, c) => s + c.len, 0);
  let done = 0;
  for (let i = 0; i < info.chunks.length;) {
    const start = info.chunks[i].off;
    let end = start + info.chunks[i].len;
    let j = i + 1;
    while (j < info.chunks.length && info.chunks[j].off === end && end - start < 8 * 1048576) { end += info.chunks[j].len; j++; }
    if (end > file.size) throw fail('broken');
    parts.push(await read(file, start, end));
    done += end - start;
    onProgress?.(done / total);
    i = j;
  }

  // monta o .m4a: ftyp + moov (só a faixa de áudio) + mdat
  const ftyp = box('ftyp', ascii('M4A '), u32s(0), ascii('M4A '), ascii('mp42'), ascii('isom'));
  const smhdBox = smhd ? raw(moov, smhd) : fullbox('smhd', u32s(0));
  const dinfBox = dinf ? raw(moov, dinf) : box('dinf', fullbox('dref', u32s(1), box('url ', u32s(1))));

  let mvhdBox = raw(moov, mvhd), tkhdBox = raw(moov, tkhd), mdhdBox = raw(moov, mdhd);
  let sttsBox, stszBox, stscBox, cttsBox = null;
  if (info.fragmented) {
    const dur = info.durations.reduce((s, d) => s + d, 0);
    const scale = timescaleOf(moov, mdhd) || 1;
    const movieDur = Math.round((dur / scale) * (timescaleOf(moov, mvhd) || 1000));
    mdhdBox = withDuration(moov, mdhd, dur);
    mvhdBox = withDuration(moov, mvhd, movieDur);
    tkhdBox = withDuration(moov, tkhd, movieDur);
    sttsBox = sttsFrom(info.durations);
    stszBox = stszFrom(info.sizes);
    stscBox = stscFrom(info.chunks.map((c) => c.count));
  } else {
    sttsBox = raw(moov, child(moov, stbl, 'stts'));
    stszBox = raw(moov, child(moov, stbl, 'stsz'));
    stscBox = raw(moov, child(moov, stbl, 'stsc'));
    const ctts = child(moov, stbl, 'ctts');
    if (ctts) cttsBox = raw(moov, ctts);
  }
  const build = (offsets) => box('moov', mvhdBox,
    box('trak', tkhdBox, edts && !info.fragmented ? raw(moov, edts) : null,
      box('mdia', mdhdBox, raw(moov, hdlr),
        box('minf', smhdBox, dinfBox,
          box('stbl', raw(moov, stsd), sttsBox, cttsBox, stscBox, stszBox, stcoFrom(offsets))))));

  const counts = info.chunks.length;
  const probe = build(new Array(counts).fill(0));
  let offset = ftyp.length + probe.length + 8;
  const offsets = info.chunks.map((c) => { const o = offset; offset += c.len; return o; });
  const moovOut = build(offsets);
  const mdatHead = new Uint8Array(8);
  new DataView(mdatHead.buffer).setUint32(0, 8 + total);
  mdatHead.set(ascii('mdat'), 4);

  const name = file.name.replace(/\.[a-z0-9]+$/i, '') + '.m4a';
  return { file: new File([ftyp, moovOut, mdatHead, ...parts], name, { type: 'audio/mp4' }), codec };
}

// Um quadro do vídeo (quadrado, até 512 px) para servir de capa. null se não der.
export function videoFrame(file, at = 1) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let finished = false;
    const finish = (blob) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      try { v.load(); } catch { /* ignore */ }
      resolve(blob);
    };
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => { v.currentTime = Math.min(at, (v.duration || 2) / 2); };
    v.onseeked = () => {
      try {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) { finish(null); return; }
        const side = Math.min(w, h), size = Math.min(512, side);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(v, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
        c.toBlob((b) => finish(b), 'image/jpeg', 0.85);
      } catch { finish(null); }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 6000);
    v.src = url;
  });
}

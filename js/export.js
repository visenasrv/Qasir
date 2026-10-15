/* ============================================================================
   QASIR — export.js · Simpan gambar/PDF langsung ke perangkat, cache gambar,
   salin gambar ke clipboard, kamera laptop/webcam.
   ========================================================================== */
'use strict';

const LIBS = {
  h2i: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
};
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** ID berkas Google Drive dari URL thumbnail / file. */
function fileIdOf(u) {
  u = String(u || '');
  const m = u.match(/[?&]id=([\w-]{10,})/) || u.match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : '';
}
function blobToDataUrl(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }

/* ------------------------------------------------------------------------
   ImgCache — logo & foto produk sebagai data URL, disimpan di IndexedDB.
   Dipakai agar ekspor gambar/PDF menyertakan foto & logo dengan sempurna
   (gambar Google Drive tidak bisa dibaca langsung oleh canvas karena CORS).
   ------------------------------------------------------------------------ */
const ImgCache = {
  mem: {},
  async get(urls) {
    const out = {}, need = [];
    for (const u of urls) {
      if (!u || out[u]) continue;
      if (/^data:/.test(u)) { out[u] = u; continue; }
      const id = fileIdOf(u);
      if (id) {
        if (this.mem[id]) { out[u] = this.mem[id]; continue; }
        const rec = await DB.get('kv', 'img:' + id).catch(() => null);
        if (rec && rec.d) { this.mem[id] = rec.d; out[u] = rec.d; continue; }
        need.push({ u, id });
      } else {
        try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) out[u] = await blobToDataUrl(await r.blob()); } catch (e) { /* lewati */ }
      }
    }
    if (need.length && navigator.onLine) {
      const ids = Array.from(new Set(need.map((x) => x.id)));
      for (let i = 0; i < ids.length; i += 10) {
        const r = await api('getImages', { ids: ids.slice(i, i + 10) });
        if (!r.ok) break;
        const imgs = r.data.images || {};
        for (const id of Object.keys(imgs)) { this.mem[id] = imgs[id]; DB.put('kv', { d: imgs[id], at: Date.now() }, 'img:' + id).catch(() => {}); }
      }
      need.forEach((x) => { if (this.mem[x.id]) out[x.u] = this.mem[x.id]; });
    }
    return out;
  },
  async one(u) { return (await this.get([u]))[u] || ''; },
  /** Muat di latar (mis. saat halaman menu/poster dibuka) agar ekspor & salin terasa instan. */
  prefetch(urls) { const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300)); idle(() => { this.get(urls.filter(Boolean)).catch(() => {}); }); }
};

/* ------------------------------------------------------------------------
   Exporter — render elemen persis seperti tampilan aplikasi ke PNG / PDF
   lalu langsung tersimpan ke folder Unduhan perangkat.
   ------------------------------------------------------------------------ */
const Exporter = {
  _font: null,
  saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    toast((IS_IOS ? 'File siap: ' : 'Tersimpan ke folder Unduhan: ') + name, 'ok', 3500);
  },
  /** Render salinan elemen pada lebar tetap → canvas. o: {width, pixelRatio, bg, cls, pad} */
  async canvas(src, o) {
    o = Object.assign({ width: 720, pixelRatio: 2, bg: '#ffffff', cls: '', pad: 0 }, o || {});
    await loadScript(LIBS.h2i);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + o.width + 'px;pointer-events:none;';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:' + o.width + 'px;background:' + o.bg + ';padding:' + o.pad + 'px;box-sizing:border-box;';
    const node = src.cloneNode(true);
    node.classList.add('is-export'); if (o.cls) node.classList.add(o.cls);
    node.style.maxWidth = 'none'; node.style.margin = '0'; node.style.boxShadow = 'none';
    wrap.appendChild(node); host.appendChild(wrap); document.body.appendChild(host);
    try {
      const imgs = Array.from(wrap.querySelectorAll('img'));
      const map = await ImgCache.get(imgs.map((i) => i.getAttribute('src')));
      imgs.forEach((i) => {
        const d = map[i.getAttribute('src')];
        i.removeAttribute('loading'); i.removeAttribute('crossorigin'); i.removeAttribute('onerror');
        if (d) i.src = d; else if (!/^data:/.test(i.src)) i.remove();     // tanpa data → biarkan placeholder warna
      });
      await Promise.all(Array.from(wrap.querySelectorAll('img')).map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const H = window.htmlToImage;
      const opts = { pixelRatio: o.pixelRatio, backgroundColor: o.bg, cacheBust: false, width: o.width, height: wrap.offsetHeight };
      if (this._font === null) { try { this._font = await H.getFontEmbedCSS(wrap); } catch (e) { this._font = ''; } }
      if (this._font) opts.fontEmbedCSS = this._font; else opts.skipFonts = true;
      let c;
      try {
        if (IS_IOS) await H.toCanvas(wrap, opts).catch(() => {});      // Safari: render pertama sering tanpa gambar
        c = await H.toCanvas(wrap, opts);
      } catch (e) {
        delete opts.fontEmbedCSS; opts.skipFonts = true;
        c = await H.toCanvas(wrap, opts);
      }
      // titik potong halaman (untuk PDF multi-halaman) dalam piksel CSS
      const top0 = wrap.getBoundingClientRect().top;
      // judul kategori (keepSel) tidak boleh tertinggal sendirian di bawah halaman
      const keep = o.keepSel ? Array.from(wrap.querySelectorAll(o.keepSel)).map((x) => { const r = x.getBoundingClientRect(); return [r.top - top0, r.bottom - top0 + 40]; }) : [];
      c._breaks = o.breakSel ? Array.from(wrap.querySelectorAll(o.breakSel)).map((x) => Math.round(x.getBoundingClientRect().top - top0))
        .filter((b) => !keep.some((k) => b > k[0] + 1 && b <= k[1])) : [];
      c._ratio = o.pixelRatio;
      return c;
    } finally { host.remove(); }
  },
  async png(src, name, o) {
    const c = await this.canvas(src, o);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    this.saveBlob(blob, name);
    return blob;
  },
  /** o.page: 'a4' (multi-halaman, potong di antara item) atau lebar mm (struk 58/80). */
  async pdf(src, name, o) {
    o = o || {};
    const [c] = await Promise.all([this.canvas(src, o), loadScript(LIBS.jspdf)]);
    const { jsPDF } = window.jspdf;
    let doc;
    if (o.page === 'a4') {
      const M = 8, PW = 210, PH = 297, IW = PW - M * 2, IH = PH - M * 2;
      const mmPerPx = IW / c.width, pagePx = Math.floor(IH / mmPerPx);
      const breaks = (c._breaks || []).map((b) => b * c._ratio).filter((b) => b > 0).sort((a, b) => a - b);
      doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p', compress: true });
      let y = 0, first = true;
      while (y < c.height - 2) {
        let end = Math.min(c.height, y + pagePx);
        if (end < c.height) { const cand = breaks.filter((b) => b > y + pagePx * 0.4 && b <= end); if (cand.length) end = cand[cand.length - 1]; }
        const sl = document.createElement('canvas'); sl.width = c.width; sl.height = end - y;
        const cx = sl.getContext('2d'); cx.fillStyle = o.bg || '#ffffff'; cx.fillRect(0, 0, sl.width, sl.height); cx.drawImage(c, 0, y, c.width, end - y, 0, 0, c.width, end - y);
        if (!first) doc.addPage();
        doc.addImage(sl.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, IW, (end - y) * mmPerPx, undefined, 'FAST');
        first = false; y = end;
      }
    } else {
      const W = Number(o.page) || 58, H = Math.max(40, c.height * (W / c.width));
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: H >= W ? 'p' : 'l', compress: true });
      doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, W, H, undefined, 'FAST');
    }
    this.saveBlob(doc.output('blob'), name);
  }
};
/** Jalankan ekspor dengan indikator tombol + pesan error yang ramah. */
async function runExport(btn, fn) {
  busy(btn, true);
  try { await fn(); }
  catch (e) { console.error(e); toast(navigator.onLine ? 'Gagal menyimpan: ' + (e.message || e) : 'Pertama kali menyimpan gambar/PDF butuh internet (memuat modul). Coba lagi saat online.', 'bad', 5000); }
  busy(btn, false);
}

/* ------------------------------------------------------------------------
   Salin gambar ke clipboard (untuk ditempel langsung ke Gemini/ChatGPT)
   ------------------------------------------------------------------------ */
async function imageToPngBlob(url) {
  const d = await ImgCache.one(url);
  if (!d) throw new Error('Gambar belum bisa dimuat. Periksa koneksi internet.');
  const img = await loadImage(d);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return await new Promise((r) => c.toBlob(r, 'image/png'));
}
async function copyImage(url) {
  if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) throw new Error('Browser ini belum mendukung salin gambar. Gunakan Chrome terbaru, atau tombol Unduh.');
  const p = imageToPngBlob(url);
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': p })]); }      // Safari & Chrome baru
  catch (e) { const b = await p; await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); }
}

/* ------------------------------------------------------------------------
   Kamera — di laptop/PC membuka webcam (bukan file manager).
   Di HP tetap memakai kamera bawaan HP (lebih tajam & ada fokus otomatis).
   ------------------------------------------------------------------------ */
const Camera = {
  isTouch() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || IS_IOS || (window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches); },
  usable() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false; },
  /** Buka webcam → Promise<File|null>. */
  open(title) {
    return new Promise((resolve) => {
      let stream = null, devices = [], devIdx = 0, shot = null, settled = false;
      const finish = (v) => { if (settled) return; settled = true; stop(); s.close(); resolve(v); };
      const stop = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
      const s = sheet({
        title: title || 'Ambil Foto', maxWidth: 720,
        body: '<div class="cam-view" id="camBox"><video playsinline muted autoplay></video><img id="camShot" alt="" hidden><div class="cam-flash"></div></div>' +
          '<div class="help" id="camHelp" style="justify-content:center">' + icon('info', 'xs') + 'Arahkan bukti bayar ke kamera, pastikan tulisan terbaca jelas.</div>',
        foot: '<div class="row" id="camLive"><button class="btn outline" id="camFile" type="button">' + icon('image', 'sm') + '<span class="hide-sm">Pilih File</span></button>' +
          '<button class="btn primary grow lg" id="camSnap" type="button" disabled>' + icon('camera', 'sm') + 'Ambil Foto</button>' +
          '<button class="btn outline" id="camSwitch" type="button" hidden aria-label="Ganti kamera">' + icon('refresh', 'sm') + '</button></div>' +
          '<div class="row" id="camReview" hidden><button class="btn outline grow" id="camRetake" type="button">' + icon('refresh', 'sm') + 'Ulangi</button><button class="btn primary grow lg" id="camUse" type="button">' + icon('check', 'sm') + 'Pakai Foto</button></div>',
        onClose() { stop(); if (!settled) { settled = true; resolve(null); } }
      });
      const video = $('video', s.el), shotImg = $('#camShot', s.el);
      const start = async () => {
        stop();
        $('#camSnap', s.el).disabled = true;
        try {
          const dev = devices[devIdx];
          stream = await navigator.mediaDevices.getUserMedia({ video: dev ? { deviceId: { exact: dev.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          video.srcObject = stream; await video.play().catch(() => {});
          $('#camSnap', s.el).disabled = false;
          if (!devices.length) { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); const cur = stream.getVideoTracks()[0].getSettings().deviceId; devIdx = Math.max(0, devices.findIndex((d) => d.deviceId === cur)); }
          $('#camSwitch', s.el).hidden = devices.length < 2;
        } catch (err) {
          const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
          $('#camBox', s.el).outerHTML = '<div class="banner warn">' + icon('alert', 'sm') + '<div>' + (denied ? '<b>Izin kamera ditolak.</b> Klik ikon 🔒/kamera di address bar → izinkan Kamera, lalu coba lagi.' : '<b>Kamera tidak ditemukan.</b> Pastikan webcam terpasang & tidak dipakai aplikasi lain (Zoom/Meet).') + ' Atau pilih foto dari file.</div></div>';
          $('#camHelp', s.el).hidden = true; $('#camSnap', s.el).hidden = true;
        }
      };
      $('#camSnap', s.el).onclick = () => {
        const w = video.videoWidth, h = video.videoHeight; if (!w) return;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(video, 0, 0, w, h);
        const fl = $('.cam-flash', s.el); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
        c.toBlob((b) => { shot = b; shotImg.src = URL.createObjectURL(b); shotImg.hidden = false; video.hidden = true; $('#camLive', s.el).hidden = true; $('#camReview', s.el).hidden = false; }, 'image/jpeg', 0.92);
      };
      $('#camRetake', s.el).onclick = () => { shot = null; shotImg.hidden = true; video.hidden = false; $('#camLive', s.el).hidden = false; $('#camReview', s.el).hidden = true; };
      $('#camUse', s.el).onclick = () => { if (shot) finish(new File([shot], 'foto-' + Date.now() + '.jpg', { type: 'image/jpeg' })); };
      $('#camSwitch', s.el).onclick = () => { devIdx = (devIdx + 1) % devices.length; start(); };
      $('#camFile', s.el).onclick = async () => { const f = await pickFile(); if (f) finish(f); };
      start();
    });
  }
};

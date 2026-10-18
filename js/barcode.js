/* QASIR — barcode.js · Generator CODE128 (SVG, offline) + pemindai kamera */
'use strict';
const Code128 = {
  P: ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'],
  /** Kode → daftar nilai simbol. Encoder optimal B/C: deretan angka dipadatkan dengan set C
   *  sehingga barcode lebih pendek → garis lebih lebar → jauh lebih mudah discan setelah dicetak. */
  values(text) {
    text = String(text || '');
    const isD = (i) => i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57;
    const runAt = (i) => { let n = 0; while (isD(i + n)) n++; return n; };
    const codes = [];
    let i = 0, set = '';
    const first = runAt(0);
    if (first >= 4 || (first === text.length && first >= 2 && first % 2 === 0)) { set = 'C'; codes.push(105); }
    else { set = 'B'; codes.push(104); }
    while (i < text.length) {
      if (set === 'C') {
        if (runAt(i) >= 2) { codes.push(Number(text.substr(i, 2))); i += 2; continue; }
        codes.push(100); set = 'B'; continue;                       // pindah ke set B
      }
      const n = runAt(i);
      const atEnd = i + n === text.length;
      if (n >= (atEnd ? 4 : 6)) {
        if (n % 2) { codes.push(text.charCodeAt(i) - 32); i++; }     // satu digit ganjil di set B dulu
        codes.push(99); set = 'C'; continue;                         // pindah ke set C
      }
      const c = text.charCodeAt(i); codes.push(c >= 32 && c <= 127 ? c - 32 : 31); i++;
    }
    let sum = codes[0];
    for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
    codes.push(sum % 103); codes.push(106);
    return codes;
  },
  /** Jumlah modul (garis tersempit) termasuk start, cek & stop — tanpa quiet zone. */
  modules(text) { return (this.values(text).length - 1) * 11 + 13; },
  svg(text, o) {
    o = Object.assign({ height: 60, quiet: 10, showText: false }, o || {});
    if (o.moduleMm) return this.svgPrint(text, o);
    const widths = this.values(text).map((v) => this.P[v]).join('');
    let x = o.quiet, rects = '';
    for (let i = 0; i < widths.length; i++) {
      const w = Number(widths[i]);
      if (i % 2 === 0) rects += '<rect x="' + x + '" y="0" width="' + w + '" height="' + o.height + '"/>';
      x += w;
    }
    const total = x + o.quiet;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + (o.height + (o.showText ? 14 : 0)) + '" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">' + rects + '</g>' +
      (o.showText ? '<text x="' + total / 2 + '" y="' + (o.height + 12) + '" font-family="monospace" font-size="11" text-anchor="middle">' + esc(text) + '</text>' : '') + '</svg>';
  }
};

/** SVG untuk dicetak: ukuran fisik pasti (mm), lebar garis = kelipatan titik printer, quiet zone ≥10 modul. */
Code128.svgPrint = function (text, o) {
  const widths = this.values(text).map((v) => this.P[v]).join('');
  const q = Math.max(10, o.quiet || 10), X = o.moduleMm, H = o.heightMm || 12;
  let x = q, rects = '';
  for (let i = 0; i < widths.length; i++) { const w = Number(widths[i]); if (i % 2 === 0) rects += '<rect x="' + x + '" y="0" width="' + w + '" height="1"/>'; x += w; }
  const total = x + q;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' 1" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:' + (total * X).toFixed(3) + 'mm;height:' + H + 'mm;display:block;flex:none"><rect width="' + total + '" height="1" fill="#fff"/><g fill="#000">' + rects + '</g></svg>';
};
/** Pilih lebar modul terbesar yang muat, kelipatan titik printer (300 dpi untuk kertas A4, 203 dpi untuk thermal). */
Code128.pickModule = function (texts, availMm, thermal) {
  const maxMod = Math.max.apply(null, texts.map((t) => this.modules(t) + 20));
  const dots = thermal ? [4, 3, 2] : [6, 5, 4, 3];
  const dpi = thermal ? 203 : 300;
  for (const d of dots) { const X = d * 25.4 / dpi; if (maxMod * X <= availMm) return X; }
  return Math.max(0.19, availMm / maxMod);
};

const Scanner = {
  stream: null, timer: null, h5: null, ac: null,
  /** Siapkan audio saat kasir menekan tombol Scan (browser hanya mengizinkan suara setelah sentuhan). */
  unlockAudio() {
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
      const b = this.ac.createBuffer(1, 1, 22050), src = this.ac.createBufferSource(); src.buffer = b; src.connect(this.ac.destination); src.start(0);
    } catch (e) {}
  },
  /** Bunyi kasir: SATU kali "beep" pendek bernada tinggi seperti scanner di minimarket.
   *  Gagal: satu dengung rendah yang lebih panjang (jelas berbeda dari sukses). */
  tone(ok) {
    try {
      this.unlockAudio(); const ac = this.ac; if (!ac) return;
      const t = ac.currentTime + 0.005, dur = ok ? 0.13 : 0.34;
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = ok ? 2730 : 290;
      f.type = 'lowpass'; f.frequency.value = ok ? 5200 : 1400; f.Q.value = 0.7;   // halus, tidak cempreng
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ok ? 0.22 : 0.2, t + 0.004);              // serangan cepat → "tik" yang tegas
      g.gain.setValueAtTime(ok ? 0.22 : 0.2, t + dur - 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(ok ? 60 : 250); } catch (e) {}
  },
  beep() { this.tone(true); },
  /** Animasi + suara + teks hasil scan. */
  feedback(root, ok, text, sub, count) {
    this.tone(ok);
    const box = root.querySelector('.scanner-view');
    if (box) { box.classList.remove('hit', 'miss'); void box.offsetWidth; box.classList.add(ok ? 'hit' : 'miss'); const ico = box.querySelector('.hit-ico'); if (ico) ico.innerHTML = icon(ok ? 'check' : 'x'); clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove('hit', 'miss'), 900); }
    const res = root.querySelector('.scan-result');
    if (res) {
      res.className = 'scan-result ' + (ok ? 'ok' : 'bad'); void res.offsetWidth;
      res.innerHTML = '<span class="ico-box ' + (ok ? 'ok' : 'bad') + '" style="width:36px;height:36px;border-radius:50%">' + icon(ok ? 'check' : 'alert', 'sm') + '</span><div style="min-width:0"><div class="t ellipsis">' + esc(text) + '</div>' + (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div>' + (count ? '<span class="cnt">' + count + '× scan</span>' : '');
    }
  },
  /** Buka pemindai.
   *  onCode(text) boleh mengembalikan:
   *   - undefined / true          → sukses, lalu tutup
   *   - false                     → sukses, tetap terbuka (scan beruntun)
   *   - {label, sub, close}       → sukses dengan teks keterangan
   *   - {error:'pesan'}           → gagal (bunyi & animasi merah), tetap terbuka
   *  opts.qty = true → tampil isian "Jumlah per scan" (onCode menerima jumlah sebagai argumen kedua);
   *  hasil {line} + opts.onLineQty(line, qty) → jumlah barang yang barusan discan bisa diubah langsung. */
  open(onCode, title, opts) {
    const self = this; opts = opts || {};
    this.unlockAudio();
    let lastCode = '', lastAt = 0, okCount = 0, closing = false, qty = 1;
    const qtyBar = opts.qty ? '<div class="scan-qty"><span class="lbl">Jumlah per scan</span><div class="stepper"><button type="button" data-q="-1" aria-label="Kurangi">' + icon('minus', 'sm') + '</button><input class="v" id="scanQty" type="number" inputmode="numeric" min="1" max="999" value="1" aria-label="Jumlah per scan"><button class="plus" type="button" data-q="1" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div>' +
      '<div class="chips">' + [2, 3, 5, 10].map((n) => '<button class="chip" type="button" data-qn="' + n + '">' + n + '×</button>').join('') + '</div></div>' : '';
    const sh = sheet({
      title: title || 'Scan Barcode',
      body: '<div class="scan-wrap"><div class="scanner-view' + (opts.qty ? ' compact' : '') + '" id="scanBox"><video playsinline muted></video><div class="frame"></div><div class="laser"></div><div class="hit-ico"></div></div>' + (opts.qty ? '<div class="qty-badge" hidden></div>' : '') + '</div>' + qtyBar +
        '<div class="scan-result"><span class="ico-box" style="width:36px;height:36px;border-radius:50%">' + icon('scan-barcode', 'sm') + '</span><div><div class="t">Siap memindai…</div><div class="s">Arahkan barcode ke dalam kotak. Akan berbunyi "bip" saat berhasil.</div></div></div>' +
        '<div class="row" style="margin-top:12px"><input class="input" id="manualCode" placeholder="Atau ketik kode barcode" inputmode="text" autocomplete="off"><button class="btn outline" id="manualGo" type="button">Cari</button></div>',
      onClose() { self.stop(); }
    });
    const qIn = $('#scanQty', sh.el), badge = $('.qty-badge', sh.el);
    const setQty = (n) => {
      qty = Math.max(1, Math.min(999, Math.floor(Number(n)) || 1));
      if (qIn && Number(qIn.value) !== qty) qIn.value = qty;
      if (badge) { badge.hidden = qty <= 1; badge.textContent = '×' + qty; }
      $$('[data-qn]', sh.el).forEach((b) => b.classList.toggle('on', Number(b.dataset.qn) === qty));
    };
    if (opts.qty) {
      sh.el.addEventListener('click', (e) => {
        const q = e.target.closest('[data-q]'), qn = e.target.closest('[data-qn]');
        if (q) setQty(qty + Number(q.dataset.q));
        if (qn) setQty(Number(qn.dataset.qn) === qty ? 1 : qn.dataset.qn);
      });
      qIn.addEventListener('input', () => { if (qIn.value !== '') setQty(qIn.value); });
      qIn.addEventListener('blur', () => setQty(qIn.value));
      qIn.addEventListener('focus', () => qIn.select());
    }
    // Ubah jumlah barang yang barusan discan langsung dari kotak hasil
    const lineEditor = (line) => {
      const res = $('.scan-result', sh.el); if (!res || !opts.onLineQty) return;
      const paint = (info) => {
        let ed = $('.scan-line', res);
        if (!info || !info.qty) { if (ed) ed.remove(); return; }
        if (!ed) { ed = document.createElement('div'); ed.className = 'scan-line'; res.appendChild(ed); }
        ed.innerHTML = '<span class="muted">Jumlah di keranjang</span><div class="stepper"><button type="button" data-lq="-1" aria-label="Kurangi">' + icon('minus', 'sm') + '</button><span class="v">' + info.qty + '</span><button class="plus" type="button" data-lq="1" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div>';
        if (info.sub) { const s = $('.s', res); if (s) s.textContent = info.sub; }
      };
      res.onclick = (e) => { const b = e.target.closest('[data-lq]'); if (!b) return; const cur = Number(($('.scan-line .v', res) || {}).textContent) || 0; paint(opts.onLineQty(line, cur + Number(b.dataset.lq))); };
      paint(opts.onLineQty(line, null));
    };
    const done = (code, manual) => {
      code = String(code || '').trim(); if (!code || closing) return;
      const now = Date.now();
      if (!manual && code === lastCode && now - lastAt < 1500) return;      // cegah dobel dari satu kali arahkan
      lastCode = code; lastAt = now;
      let res;
      try { res = onCode(code, qty); } catch (e) { res = { error: e.message }; }
      if (res && res.error) { self.feedback(sh.el, false, res.error, 'Kode: ' + code); return; }
      okCount++;
      self.feedback(sh.el, true, (res && res.label) || ('Kode terbaca: ' + code), res && res.sub, res === false || (res && !res.close) ? okCount : 0);
      if (res && res.line) lineEditor(res.line);
      if (opts.qty) setQty(1);                                               // kembali ke 1 untuk scan berikutnya
      const close = res === undefined || res === true || (res && res.close);
      if (close) { closing = true; setTimeout(() => sh.close(), 550); }
    };
    $('#manualGo', sh.el).onclick = () => { done($('#manualCode', sh.el).value, true); $('#manualCode', sh.el).value = ''; };
    $('#manualCode', sh.el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { done(e.target.value, true); e.target.value = ''; } });
    this.start($('#scanBox', sh.el), done).catch((err) => {
      $('#scanBox', sh.el).outerHTML = '<div class="banner warn">' + icon('alert', 'sm') + '<div>Kamera tidak bisa dibuka (' + esc(err.message || err) + '). Ketik kode barcode secara manual di bawah.</div></div>';
    });
    return sh;
  },
  async start(box, done) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('browser tidak mendukung kamera');
    // Resolusi tinggi + fokus otomatis terus-menerus → barcode kecil hasil cetak tetap terbaca
    const vc = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] };
    // Pakai pemindai bawaan browser hanya bila benar-benar mendukung format barcode toko (di sebagian
    // perangkat BarcodeDetector ada tetapi daftar formatnya kosong → tidak pernah terbaca).
    const formats = 'BarcodeDetector' in window ? await window.BarcodeDetector.getSupportedFormats().catch(() => []) : [];
    if (formats.indexOf('code_128') > -1 && formats.indexOf('ean_13') > -1) {
      const want = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'qr_code'].filter((f) => formats.indexOf(f) > -1);
      const det = new window.BarcodeDetector({ formats: want });
      const video = box.querySelector('video');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }));
      video.srcObject = this.stream; await video.play();
      this.torchSetup(box, this.stream.getVideoTracks()[0]);
      let busyDetect = false;
      this.timer = setInterval(async () => {
        if (busyDetect || video.readyState < 2) return;
        busyDetect = true;
        try { const r = await det.detect(video); if (r && r[0] && r[0].rawValue) done(r[0].rawValue); } catch (e) {}
        busyDetect = false;
      }, 140);
      return;
    }
    // Cadangan untuk browser tanpa BarcodeDetector (iPhone, Chrome Windows): pustaka html5-qrcode
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js');
    box.innerHTML = '<div id="h5scan" style="width:100%;height:100%"></div><div class="frame" style="display:none"></div><div class="hit-ico"></div>';
    const F = window.Html5QrcodeSupportedFormats || {};
    const fmts = ['CODE_128', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_39', 'QR_CODE'].map((k) => F[k]).filter((v) => v !== undefined);
    this.h5 = new window.Html5Qrcode('h5scan', { formatsToSupport: fmts.length ? fmts : undefined, experimentalFeatures: { useBarCodeDetectorIfSupported: formats.length > 0 }, verbose: false });
    await this.h5.start({ facingMode: 'environment' }, {
      fps: 15, disableFlip: true,
      qrbox: (w, h) => ({ width: Math.max(200, Math.floor(w * 0.88)), height: Math.max(90, Math.floor(h * 0.42)) }),
      videoConstraints: vc
    }, (txt) => done(txt), () => {});
    try { const h5 = this.h5; this.torchSetup(box, { getCapabilities: () => h5.getRunningTrackCapabilities(), applyConstraints: (c) => h5.applyVideoConstraints(c) }); } catch (e) {}
  },
  /** Tombol senter (jika kamera mendukung) — membantu scan di tempat redup. */
  torchSetup(box, track) {
    try {
      const cap = track && track.getCapabilities ? track.getCapabilities() : {};
      if (!cap.torch) return;
      let on = false;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'torch-btn'; b.setAttribute('aria-label', 'Senter'); b.innerHTML = icon('zap', 'sm');
      b.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); b.classList.toggle('on', on); } catch (e) {} };
      box.appendChild(b);
    } catch (e) {}
  },
  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.h5) { const h = this.h5; this.h5 = null; h.stop().catch(() => {}); }
  }
};

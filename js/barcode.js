/* QASIR — barcode.js · Generator CODE128 (SVG, offline) + pemindai kamera */
'use strict';
const Code128 = {
  P: ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'],
  /** Kode → daftar nilai simbol (pakai set C untuk angka genap ≥4 digit, selain itu set B). */
  values(text) {
    text = String(text || '');
    let codes;
    if (/^\d+$/.test(text) && text.length >= 4 && text.length % 2 === 0) {
      codes = [105]; for (let i = 0; i < text.length; i += 2) codes.push(Number(text.substr(i, 2)));
    } else {
      codes = [104];
      for (const ch of text) { const c = ch.charCodeAt(0); codes.push(c >= 32 && c <= 127 ? c - 32 : 31); }
    }
    let sum = codes[0];
    for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
    codes.push(sum % 103); codes.push(106);
    return codes;
  },
  svg(text, o) {
    o = Object.assign({ height: 60, quiet: 10, showText: false }, o || {});
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

const Scanner = {
  stream: null, timer: null, h5: null,
  beep() {
    try { navigator.vibrate && navigator.vibrate(60); const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 1500; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(() => { o.stop(); ac.close(); }, 90); } catch (e) {}
  },
  /** Buka pemindai. onCode(text) → return true untuk menutup. */
  open(onCode, title) {
    const self = this;
    const sh = sheet({
      title: title || 'Scan Barcode',
      body: '<div class="scanner-view" id="scanBox"><video playsinline muted></video><div class="frame"></div><div class="laser"></div></div>' +
        '<div class="help" style="justify-content:center;margin-top:10px">' + icon('info', 'xs') + 'Arahkan barcode ke dalam kotak. Pastikan cahaya cukup.</div>' +
        '<div class="row" style="margin-top:14px"><input class="input" id="manualCode" placeholder="Atau ketik kode barcode" inputmode="text" autocomplete="off"><button class="btn outline" id="manualGo" type="button">Cari</button></div>',
      onClose() { self.stop(); }
    });
    const done = (code) => { code = String(code || '').trim(); if (!code) return; self.beep(); if (onCode(code) !== false) sh.close(); };
    $('#manualGo', sh.el).onclick = () => done($('#manualCode', sh.el).value);
    $('#manualCode', sh.el).addEventListener('keydown', (e) => { if (e.key === 'Enter') done(e.target.value); });
    this.start($('#scanBox', sh.el), done).catch((err) => {
      $('#scanBox', sh.el).outerHTML = '<div class="banner warn">' + icon('alert', 'sm') + '<div>Kamera tidak bisa dibuka (' + esc(err.message || err) + '). Ketik kode barcode secara manual di bawah.</div></div>';
    });
    return sh;
  },
  async start(box, done) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('browser tidak mendukung kamera');
    if ('BarcodeDetector' in window) {
      const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
      const want = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'qr_code'].filter((f) => !formats.length || formats.indexOf(f) > -1);
      const det = new window.BarcodeDetector({ formats: want });
      const video = box.querySelector('video');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      video.srcObject = this.stream; await video.play();
      let last = '', busyDetect = false;
      this.timer = setInterval(async () => {
        if (busyDetect || video.readyState < 2) return;
        busyDetect = true;
        try { const r = await det.detect(video); if (r && r[0] && r[0].rawValue && r[0].rawValue !== last) { last = r[0].rawValue; done(last); } } catch (e) {}
        busyDetect = false;
      }, 220);
      return;
    }
    // Cadangan untuk browser tanpa BarcodeDetector (mis. iPhone): pustaka html5-qrcode
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js');
    box.innerHTML = '<div id="h5scan" style="width:100%;height:100%"></div>';
    this.h5 = new window.Html5Qrcode('h5scan');
    await this.h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 130 } }, (txt) => done(txt), () => {});
  },
  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.h5) { const h = this.h5; this.h5 = null; h.stop().catch(() => {}); }
  }
};

/* QASIR — printer.js · Struk: pratinjau HTML, teks WA, gambar PNG, cetak ESC/POS via Web Bluetooth */
'use strict';
const METODE_LABEL = { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', UTANG: 'Utang' };
const Receipt = {
  width() { return App.settings.ukuran_kertas === '80' ? 48 : 32; },
  lr(l, r, w) { l = String(l); r = String(r); w = w || this.width(); const space = w - l.length - r.length; return space >= 1 ? l + ' '.repeat(space) + r : l.slice(0, Math.max(0, w - r.length - 1)) + ' ' + r; },
  center(s, w) { s = String(s); w = w || this.width(); return s.length >= w ? s.slice(0, w) : ' '.repeat(Math.floor((w - s.length) / 2)) + s; },
  money(n) { return NF.format(Math.round(n)); },
  /** Baris struk: [{t, a:'l|c', b:bold, big}] */
  lines(tx) {
    const st = App.settings, w = this.width(), L = [];
    const hr = { t: '-'.repeat(w) };
    L.push({ t: (st.nama_toko || 'TOKO').toUpperCase(), a: 'c', b: 1, big: 1 });
    if (st.alamat) L.push({ t: st.alamat, a: 'c' });
    if (st.no_wa) L.push({ t: 'Telp/WA: ' + st.no_wa, a: 'c' });
    L.push(hr);
    L.push({ t: 'No: ' + tx.no_nota });
    L.push({ t: this.lr(fmtDT(tx.waktu), 'Kasir: ' + (tx.kasir_nama || '-'), w) });
    if (tx.pelanggan_nama) L.push({ t: 'Pelanggan: ' + tx.pelanggan_nama });
    L.push(hr);
    (tx.items || []).forEach((it) => {
      const sub = toNum(it.harga_satuan) * toNum(it.qty);
      L.push({ t: this.lr(it.qty + ' ' + it.nama_produk, this.money(sub), w) });
      if (toNum(it.qty) > 1) L.push({ t: '  @' + this.money(it.harga_satuan) });
      if (it.varian_ringkas) L.push({ t: '  ' + it.varian_ringkas });
      if (it.catatan_item) L.push({ t: '  *' + it.catatan_item });
      if (toNum(it.diskon_item)) L.push({ t: this.lr('  Diskon item', '-' + this.money(it.diskon_item), w) });
    });
    L.push(hr);
    L.push({ t: this.lr('Subtotal', this.money(tx.subtotal), w) });
    const notaDisc = toNum(tx.diskon) - (tx.items || []).reduce((s, i) => s + toNum(i.diskon_item), 0);
    if (notaDisc > 0) L.push({ t: this.lr('Diskon', '-' + this.money(notaDisc), w) });
    L.push({ t: this.lr('TOTAL', this.money(tx.total), w), b: 1 });
    if (tx.metode_bayar === 'TUNAI') { L.push({ t: this.lr('Tunai', this.money(tx.uang_diterima), w) }); L.push({ t: this.lr('Kembali', this.money(tx.kembalian), w) }); }
    else L.push({ t: this.lr('Bayar', METODE_LABEL[tx.metode_bayar] || tx.metode_bayar, w) });
    if (tx.metode_bayar === 'UTANG') L.push({ t: this.center('** BELUM LUNAS (UTANG) **', w), b: 1 });
    if (tx.status === 'DIBATALKAN') L.push({ t: this.center('** DIBATALKAN **', w), b: 1 });
    L.push(hr);
    L.push({ t: st.footer_struk || 'Terima kasih!', a: 'c' });
    return L;
  },
  text(tx) { return this.lines(tx).map((l) => (l.a === 'c' ? this.center(l.t) : l.t)).join('\n'); },
  html(tx) {
    const st = App.settings;
    const items = (tx.items || []).map((it) => '<div class="r"><span>' + esc(it.qty + ' ' + it.nama_produk) + '</span><span class="b">' + this.money(toNum(it.harga_satuan) * toNum(it.qty)) + '</span></div>' +
      (toNum(it.qty) > 1 ? '<div class="ind">@' + this.money(it.harga_satuan) + '</div>' : '') +
      (it.varian_ringkas ? '<div class="ind">' + esc(it.varian_ringkas) + '</div>' : '') +
      (it.catatan_item ? '<div class="ind" style="color:var(--p-dark);font-style:italic">*' + esc(it.catatan_item) + '</div>' : '')).join('');
    const notaDisc = toNum(tx.diskon) - (tx.items || []).reduce((s, i) => s + toNum(i.diskon_item), 0);
    return '<div class="receipt">' + (st.tampil_logo_struk !== 'FALSE' ? logoHtml() : '') +
      '<div class="c b" style="font-size:14px;letter-spacing:.06em">' + esc((st.nama_toko || '').toUpperCase()) + '</div>' +
      (st.alamat ? '<div class="c">' + esc(st.alamat) + '</div>' : '') + (st.no_wa ? '<div class="c" style="font-size:11px">Telp/WA: ' + esc(st.no_wa) + '</div>' : '') + '<hr>' +
      '<div>No: ' + esc(tx.no_nota) + '</div><div class="r"><span>' + fmtDT(tx.waktu) + '</span><span>Kasir: ' + esc(tx.kasir_nama || '-') + '</span></div>' +
      (tx.pelanggan_nama ? '<div>Pelanggan: ' + esc(tx.pelanggan_nama) + '</div>' : '') + '<hr>' + items + '<hr>' +
      '<div class="r"><span>Subtotal</span><span>' + this.money(tx.subtotal) + '</span></div>' +
      (notaDisc > 0 || (tx.items || []).some((i) => toNum(i.diskon_item)) ? '<div class="r" style="color:var(--ok)"><span>Diskon</span><span>-' + this.money(toNum(tx.diskon)) + '</span></div>' : '') +
      '<div class="r b" style="font-size:14px;margin-top:4px"><span>TOTAL</span><span style="color:var(--p)">' + rp(tx.total) + '</span></div>' +
      (tx.metode_bayar === 'TUNAI' ? '<div class="r"><span>Tunai</span><span>' + this.money(tx.uang_diterima) + '</span></div><div class="r" style="color:var(--ok)"><span>Kembali</span><span>' + this.money(tx.kembalian) + '</span></div>'
        : '<div class="r"><span>Bayar</span><span>' + esc(METODE_LABEL[tx.metode_bayar] || tx.metode_bayar) + '</span></div>') +
      (tx.metode_bayar === 'UTANG' ? '<div class="c b" style="color:var(--warn);margin-top:6px">** BELUM LUNAS (UTANG) **</div>' : '') +
      (tx.status === 'DIBATALKAN' ? '<div class="c b" style="color:var(--bad);margin-top:6px">** DIBATALKAN **</div>' : '') +
      '<hr><div class="c">' + esc(st.footer_struk || 'Terima kasih!') + '</div></div>';
  },
  /** Struk sebagai gambar PNG (lebar 384px ≈ kertas 58mm). */
  image(tx) {
    const L = this.lines(tx), w = this.width();
    const cw = w === 48 ? 576 : 384, pad = 16, lh = 22;
    const c = document.createElement('canvas');
    c.width = cw + pad * 2; c.height = L.length * lh + pad * 2 + 10;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111'; ctx.textBaseline = 'top';
    const charW = cw / w;
    L.forEach((l, i) => {
      ctx.font = (l.b ? 'bold ' : '') + (l.big ? '18px' : Math.floor(charW * 1.62) + 'px') + ' "JetBrains Mono", monospace';
      const txt = l.a === 'c' ? l.t : l.t;
      if (l.a === 'c') { ctx.textAlign = 'center'; ctx.fillText(txt, c.width / 2, pad + i * lh); }
      else { ctx.textAlign = 'left'; ctx.fillText(txt, pad, pad + i * lh); }
    });
    return c.toDataURL('image/png');
  },
  /** Struk persis seperti tampilan di aplikasi → PNG/PDF, langsung tersimpan ke perangkat. */
  _el(tx) { const d = document.createElement('div'); d.innerHTML = this.html(tx); return d.firstElementChild; },
  _opt() { const w80 = App.settings.ukuran_kertas === '80'; return { width: w80 ? 460 : 360, pixelRatio: 3, bg: '#ffffff' }; },
  async saveImage(tx) { await Exporter.png(this._el(tx), 'Struk-' + tx.no_nota + '.png', this._opt()); },
  async savePdf(tx) { await Exporter.pdf(this._el(tx), 'Struk-' + tx.no_nota + '.pdf', Object.assign(this._opt(), { page: App.settings.ukuran_kertas === '80' ? 80 : 58 })); },
  sendWA(tx, phone) {
    const text = '*' + (App.settings.nama_toko || 'Struk') + '*\n```\n' + this.text(tx) + '\n```';
    const n = waNumber(phone || '');
    window.open('https://wa.me/' + (n || '') + '?text=' + encodeURIComponent(text), '_blank');
  }
};

/* ---------------------------------------------- Printer thermal (ESC/POS) */
const Printer = {
  SERVICES: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb'],
  device: null, ch: null,
  supported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); },
  saved() { return Store.get('printer', null); },
  status() { return this.ch && this.device && this.device.gatt.connected ? 'connected' : this.saved() ? 'saved' : 'none'; },
  async findChar(server) {
    const services = await server.getPrimaryServices();
    for (const s of services) {
      let chars = []; try { chars = await s.getCharacteristics(); } catch (e) { continue; }
      for (const c of chars) if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
    throw new Error('Printer tidak menyediakan jalur cetak yang dikenali.');
  },
  async connect(pick) {
    if (!this.supported()) throw new Error('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android/laptop, atau simpan struk sebagai gambar.');
    let dev = null;
    if (!pick && navigator.bluetooth.getDevices) {
      const s = this.saved();
      if (s) { try { dev = (await navigator.bluetooth.getDevices()).find((d) => d.id === s.id) || null; } catch (e) {} }
    }
    if (!dev) dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: this.SERVICES });
    const server = await dev.gatt.connect();
    this.ch = await this.findChar(server);
    this.device = dev;
    dev.addEventListener('gattserverdisconnected', () => { this.ch = null; emit('printer'); });
    Store.set('printer', { id: dev.id, name: dev.name || 'Printer Bluetooth' });
    emit('printer');
    return dev.name;
  },
  forget() { try { this.device && this.device.gatt.disconnect(); } catch (e) {} this.device = null; this.ch = null; Store.del('printer'); emit('printer'); },
  encode(lines) {
    const out = [0x1b, 0x40];
    const txt = (s) => { for (const ch of String(s)) { const c = ch.charCodeAt(0); out.push(c < 128 ? c : 0x3f); } };
    lines.forEach((l) => {
      out.push(0x1b, 0x61, l.a === 'c' ? 1 : 0);
      out.push(0x1b, 0x45, l.b ? 1 : 0);
      out.push(0x1d, 0x21, l.big ? 0x11 : 0x00);
      txt(l.big ? l.t.slice(0, Math.floor(Receipt.width() / 2)) : l.t);
      out.push(0x0a);
    });
    out.push(0x1b, 0x64, 4, 0x1d, 0x56, 0x41, 0x10);
    return new Uint8Array(out);
  },
  async write(bytes) {
    const CH = 100;
    for (let i = 0; i < bytes.length; i += CH) {
      const part = bytes.slice(i, i + CH);
      if (this.ch.writeValueWithoutResponse && this.ch.properties.writeWithoutResponse) await this.ch.writeValueWithoutResponse(part);
      else await this.ch.writeValue(part);
      await sleep(18);
    }
  },
  async printTx(tx, opt) {
    opt = opt || {};
    try {
      if (!this.ch || !this.device || !this.device.gatt.connected) {
        if (opt.silent && !(navigator.bluetooth && navigator.bluetooth.getDevices && this.saved())) return false;
        await this.connect(false);
      }
      await this.write(this.encode(Receipt.lines(tx)));
      toast('Struk dicetak', 'ok');
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') { if (!opt.silent) toast('Pemilihan printer dibatalkan', 'warn'); return false; }
      if (!opt.silent) toast('Gagal mencetak: ' + (e.message || e) + '. Coba "Simpan Gambar" atau "Kirim WA".', 'bad', 5000);
      return false;
    }
  },
  async test() {
    const st = App.settings;
    await this.printTx({ no_nota: 'UJI-CETAK', waktu: new Date().toISOString(), kasir_nama: App.user.nama, items: [{ qty: 1, nama_produk: 'Uji cetak printer', harga_satuan: 1000, diskon_item: 0 }], subtotal: 1000, diskon: 0, total: 1000, metode_bayar: 'TUNAI', uang_diterima: 1000, kembalian: 0, status: 'SELESAI', _st: st });
  }
};

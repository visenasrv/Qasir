/* ============================================================================
   QASIR — p-online.js · Jual Online: pengaturan toko online + Pesanan Online
   Pesanan baru terdeteksi lewat heartbeat (versi pesanan) → bunyi + badge.
   ========================================================================== */
'use strict';

const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const ONLINE_DEFAULT = {
  aktif: false, pengumuman: '', banners: [], urutan: { cats: [], prods: {} }, best: [], labels: {}, hidden: [],
  layanan: { ambil: true, antar: false, meja: false }, ongkir: { mode: 'gratis', nilai: 0 }, min_order: 0,
  bayar: { ditempat: true, transfer: false }, qris_url: '', rekening: '', jam_buka: '', pesan_saat_tutup: false, jumlah_meja: 10
};
function onlineCfg() {
  let c = {}; try { c = JSON.parse(App.settings.online_config || '{}') || {}; } catch (e) { c = {}; }
  const d = JSON.parse(JSON.stringify(ONLINE_DEFAULT));
  Object.keys(c).forEach((k) => { d[k] = c[k]; });
  d.layanan = Object.assign({}, ONLINE_DEFAULT.layanan, c.layanan || {}); d.bayar = Object.assign({}, ONLINE_DEFAULT.bayar, c.bayar || {});
  d.ongkir = Object.assign({}, ONLINE_DEFAULT.ongkir, c.ongkir || {}); d.urutan = Object.assign({ cats: [], prods: {} }, c.urutan || {});
  return d;
}
const onlineOn = () => Tenant.has('online') && !!(App.boot && onlineCfg().aktif);
function shopUrl(meja) { const u = new URL(Tenant.withKode(new URL('toko.html', location.href.split('#')[0].split('?')[0]).href)); if (meja) u.searchParams.set('meja', meja); return u.href; }
function ago(v) { const m = Math.round((Date.now() - new Date(v).getTime()) / 60000); return m < 1 ? 'baru saja' : m < 60 ? m + ' mnt lalu' : m < 1440 ? Math.floor(m / 60) + ' jam lalu' : fmtDT(v); }

/* ---------------------------------------------------------- Mesin pesanan */
const Orders = {
  list: [], ver: '', baru: 0, known: null, _p: null,
  onBeat(d) {
    if (!onlineOn() || !d) return;
    if (d.ov && d.ov !== this.ver) this.load(); else if (typeof d.on === 'number') this.setBadge(d.on);
  },
  load(force) {
    if (!onlineOn() || !navigator.onLine || !Auth.tokenValid()) return Promise.resolve();
    if (this._p) return this._p;
    this._p = (async () => {
      const r = await api('getOrders', { ver: force ? '' : this.ver }, { tries: 1 });
      this._p = null;
      if (!r.ok || r.data.same) return;
      this.ver = r.data.ver; this.list = r.data.list || [];
      const fresh = this.list.filter((o) => o.status === 'BARU' && this.known && !this.known.has(o.pesanan_id));
      this.known = new Set(this.list.map((o) => o.pesanan_id));
      this.setBadge(r.data.baru);
      if (fresh.length) this.notify(fresh);
      emit('orders');
    })();
    return this._p;
  },
  setBadge(n) { this.baru = n || 0; $$('.js-order-count').forEach((el) => { el.textContent = this.baru; el.hidden = !this.baru; }); },
  notify(list) {
    this.chime();
    try { navigator.vibrate && navigator.vibrate([150, 80, 150]); } catch (e) {}
    const o = list[0];
    toast(list.length > 1 ? list.length + ' pesanan online baru masuk' : 'Pesanan baru ' + o.kode + ' · ' + o.nama + ' · ' + rp(o.total), 'ok', 6000);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Pesanan online baru', { body: o.kode + ' · ' + o.nama + ' · ' + rp(o.total), icon: 'icons/icon-192.png' }); } catch (e) {} }
  },
  /** Bunyi "ting-tung" (berbeda dari bunyi scan) agar kasir sadar ada pesanan. */
  chime() {
    try {
      Scanner.unlockAudio(); const ac = Scanner.ac; if (!ac) return;
      [[1046.5, 0], [784, 0.2]].forEach((n) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + n[1];
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.65);
      });
    } catch (e) {}
  }
};
window.Orders = Orders;

/* --------------------------------------------------------- Halaman Pesanan */
const ORDER_STATUS = { BARU: ['Baru', 'warn'], DITERIMA: ['Diproses', 'info'], SELESAI: ['Selesai', 'ok'], DITOLAK: ['Ditolak', 'bad'], DIBATALKAN: ['Dibatalkan', 'bad'] };
const ORDER_TIPE = { AMBIL: ['Ambil di toko', 'bag'], ANTAR: ['Diantar', 'truck'], MEJA: ['Makan di tempat', 'utensils'] };
page('pesanan', {
  keepScroll: true, paket: 'online',
  st: { tab: 'BARU' },
  template() {
    return topbar({ title: 'Pesanan Online', sub: '<span class="js-po-sub"></span>', right: (App.isOwner ? '<a class="icon-btn ghost-border" href="#/online" aria-label="Pengaturan toko online">' + icon('settings', 'sm') + '</a>' : '') + syncPill() }) +
      '<div class="wrap" style="padding-top:14px;max-width:900px"><div class="seg light js-po-tabs"></div><div class="js-po-list" style="margin-top:14px"></div></div>';
  },
  init(el) {
    on('orders', () => { if (App.current === 'pesanan') this.render(el); });
    on('boot', () => { if (App.current === 'pesanan') this.render(el); });
    setInterval(() => { if (App.current === 'pesanan' && !document.hidden) Orders.load(); }, 12000);
  },
  show(el) {
    this.render(el); Orders.load(true);
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
  },
  groups() {
    const L = Orders.list;
    return { BARU: L.filter((o) => o.status === 'BARU'), DITERIMA: L.filter((o) => o.status === 'DITERIMA'), SELESAI: L.filter((o) => o.status === 'SELESAI'), LAIN: L.filter((o) => o.status === 'DITOLAK' || o.status === 'DIBATALKAN') };
  },
  render(el) {
    $('.js-po-sub', el).textContent = onlineOn() ? 'Toko online aktif · ' + (App.store ? 'toko buka' : 'toko tutup') : 'Toko online belum aktif';
    if (!onlineOn()) {
      $('.js-po-tabs', el).innerHTML = '';
      $('.js-po-list', el).innerHTML = emptyState('globe', 'Jual Online belum aktif', App.isOwner ? 'Aktifkan agar pelanggan bisa memesan lewat link atau scan QR.' : 'Minta pemilik toko mengaktifkan Jual Online.', App.isOwner ? '<a class="btn primary" href="#/online">' + icon('globe', 'sm') + 'Atur Jual Online</a>' : '');
      return;
    }
    const g = this.groups(), tabs = [['BARU', 'Baru'], ['DITERIMA', 'Diproses'], ['SELESAI', 'Selesai'], ['LAIN', 'Ditolak/Batal']];
    $('.js-po-tabs', el).innerHTML = tabs.map((t) => '<button class="' + (this.st.tab === t[0] ? 'on' : '') + '" data-act="tab" data-t="' + t[0] + '" type="button">' + t[1] + (g[t[0]].length ? ' <span class="badge-count" style="margin-left:4px' + (t[0] === 'BARU' ? '' : ';background:var(--muted)') + '">' + g[t[0]].length + '</span>' : '') + '</button>').join('');
    const list = g[this.st.tab];
    $('.js-po-list', el).innerHTML = (!App.store && this.st.tab === 'BARU' && list.length ? '<div class="banner warn" style="margin-bottom:12px">' + icon('lock', 'sm') + '<div>Toko belum dibuka — buka toko dulu agar pesanan bisa diterima.</div></div>' : '') +
      (list.length ? list.map((o) => this.card(o)).join('') : emptyState('inbox', this.st.tab === 'BARU' ? 'Belum ada pesanan baru' : 'Kosong', this.st.tab === 'BARU' ? 'Pesanan baru akan muncul di sini dengan bunyi notifikasi.' : 'Pesanan 3 hari terakhir.'));
  },
  card(o) {
    const s = ORDER_STATUS[o.status] || [o.status, 'neutral'], tp = ORDER_TIPE[o.tipe] || [o.tipe, 'bag'];
    const where = o.tipe === 'MEJA' ? 'Meja ' + esc(o.meja) : o.tipe === 'AMBIL' ? (o.jam_ambil ? 'Ambil jam ' + esc(o.jam_ambil) : 'Ambil secepatnya') : esc(o.alamat);
    return '<div class="card pad po-card' + (o.status === 'BARU' ? ' is-new' : '') + '" style="margin-bottom:12px">' +
      '<div class="row between" style="align-items:flex-start"><div><div class="mono" style="font-weight:800;font-size:16px">' + esc(o.kode) + '</div><div class="muted" style="font-size:12.5px">' + ago(o.waktu) + ' · ' + fmtTime(o.waktu) + '</div></div><span class="pill ' + s[1] + ' sm">' + s[0] + '</span></div>' +
      '<div class="po-tipe">' + icon(tp[1], 'sm') + '<div><b>' + tp[0] + '</b><div class="muted" style="font-size:13px">' + where + '</div></div></div>' +
      '<div class="row" style="gap:8px;margin-top:10px"><span class="thumb" style="width:34px;height:34px;font-size:12px">' + esc(initials(o.nama)) + '</span><div class="grow" style="min-width:0"><b>' + esc(o.nama) + '</b><div class="muted" style="font-size:12.5px">' + esc(o.no_hp) + '</div></div>' +
      '<a class="btn xs outline" style="color:var(--ok);border-color:#BBF7D0" target="_blank" href="https://wa.me/' + waNumber(o.no_hp) + '?text=' + encodeURIComponent(this.waText(o)) + '">' + icon('whatsapp', 'xs') + 'Chat</a></div>' +
      '<div class="po-items">' + (o.items || []).map((l) => '<div class="sum-row"><span><b>' + l.qty + '×</b> ' + esc(l.nama_produk) + (l.varian_ringkas ? ' <span class="muted">(' + esc(l.varian_ringkas) + ')</span>' : '') + (l.catatan_item ? '<div style="font-size:12px;color:var(--p-dark)">*' + esc(l.catatan_item) + '</div>' : '') + '</span><span class="v">' + rp(l.subtotal) + '</span></div>').join('') + '</div>' +
      (o.catatan ? '<div class="banner info" style="margin-top:8px">' + icon('info', 'sm') + '<div>' + esc(o.catatan) + '</div></div>' : '') +
      '<div class="divider"></div>' + (toNum(o.diskon) ? '<div class="sum-row disc"><span>Diskon ' + esc(o.diskon_ket || '') + '</span><span class="v">-' + rp(o.diskon) + '</span></div>' : '') +
      (toNum(o.ongkir) ? '<div class="sum-row"><span class="muted">Ongkir</span><span class="v">' + rp(o.ongkir) + '</span></div>' : '') +
      '<div class="sum-row"><b>Total</b><b class="v" style="font-size:17px">' + rp(o.total) + '</b></div>' +
      '<div class="row" style="gap:8px;margin-top:4px"><span class="pill ' + (o.metode === 'TRANSFER' ? 'info' : 'neutral') + ' sm">' + (o.metode === 'TRANSFER' ? 'Transfer/QRIS' : 'Bayar di tempat') + '</span>' +
      (o.bukti_file_id ? '<button class="link-btn" data-act="proof" data-id="' + esc(o.pesanan_id) + '" type="button" style="font-size:13px">' + icon('image', 'xs') + ' Lihat bukti bayar</button>' : '') +
      (o.metode_akhir ? '<span class="pill ok sm">Dibayar ' + esc(METODE_LABEL[o.metode_akhir] || o.metode_akhir) + '</span>' : '') + '</div>' +
      (o.alasan ? '<div class="err" style="margin-top:6px">Alasan: ' + esc(o.alasan) + '</div>' : '') +
      (o.diproses_oleh ? '<div class="muted" style="font-size:12px;margin-top:6px">Diproses oleh ' + esc(o.diproses_oleh) + (o.diproses_pada ? ' · ' + fmtTime(o.diproses_pada) : '') + '</div>' : '') +
      (o.status === 'BARU' ? '<div class="grid-2" style="margin-top:12px"><button class="btn outline" data-act="reject" data-id="' + esc(o.pesanan_id) + '" type="button" style="color:var(--bad)">' + icon('x', 'sm') + 'Tolak</button><button class="btn primary" data-act="accept" data-id="' + esc(o.pesanan_id) + '" type="button">' + icon('check', 'sm') + 'Terima</button></div>' : '') +
      (o.status === 'DITERIMA' ? '<div class="row" style="gap:8px;margin-top:12px"><button class="btn outline sm" data-act="ocancel" data-id="' + esc(o.pesanan_id) + '" type="button" style="color:var(--bad)">' + icon('x', 'sm') + 'Batal</button><button class="btn outline sm" data-act="oprint" data-id="' + esc(o.pesanan_id) + '" type="button">' + icon('printer', 'sm') + 'Cetak</button><button class="btn primary grow" data-act="done" data-id="' + esc(o.pesanan_id) + '" type="button">' + icon('check', 'sm') + 'Selesai & Dibayar</button></div>' : '') +
      (o.status === 'SELESAI' ? '<div class="row" style="margin-top:10px"><button class="btn outline sm" data-act="oprint" data-id="' + esc(o.pesanan_id) + '" type="button">' + icon('printer', 'sm') + 'Cetak struk</button></div>' : '') +
      '</div>';
  },
  waText(o) {
    const s = { BARU: 'kami terima dan sedang kami cek', DITERIMA: 'sedang kami siapkan', SELESAI: 'sudah selesai. Terima kasih!', DITOLAK: 'tidak dapat kami proses' + (o.alasan ? ' (' + o.alasan + ')' : ''), DIBATALKAN: 'dibatalkan' + (o.alasan ? ' (' + o.alasan + ')' : '') }[o.status] || '';
    return 'Halo ' + o.nama + ', pesanan ' + o.kode + ' (' + rp(o.total) + ') di ' + (App.settings.nama_toko || 'toko kami') + ' ' + s + '.';
  },
  find(id) { return Orders.list.find((x) => x.pesanan_id === id); },
  txOf(o) {
    const items = (o.items || []).slice(); if (toNum(o.ongkir)) items.push({ qty: 1, nama_produk: 'Ongkos kirim', harga_satuan: o.ongkir, subtotal: o.ongkir, diskon_item: 0 });
    return { no_nota: o.no_nota || o.kode, waktu: o.diproses_pada || o.waktu, kasir_nama: o.diproses_oleh || App.user.nama, pelanggan_nama: o.nama + ' · ' + (ORDER_TIPE[o.tipe] || [''])[0] + (o.tipe === 'MEJA' ? ' ' + o.meja : ''), items,
      subtotal: toNum(o.subtotal) + toNum(o.ongkir), diskon: o.diskon, total: o.total, metode_bayar: o.metode_akhir || (o.metode === 'TRANSFER' ? 'TRANSFER' : 'TUNAI'), uang_diterima: o.total, kembalian: 0, status: 'SELESAI' };
  },
  async act(el, a, action, data, msg) {
    if (!navigator.onLine) { toast('Butuh koneksi internet.', 'warn'); return null; }
    busy(a, true); const r = await api(action, data); busy(a, false);
    if (!r.ok) { toast(r.error, 'bad', 5000); Orders.load(true); return null; }
    const i = Orders.list.findIndex((x) => x.pesanan_id === data.pesanan_id); if (i > -1 && r.data.order) Orders.list[i] = r.data.order;
    Orders.load(true); this.render(el); if (msg) toast(msg, 'ok');
    Sync.bootSoon();
    return r;
  },
  actions: {
    tab(a, e, el) { this.st.tab = a.dataset.t; this.render(el); },
    async accept(a, e, el) {
      if (!App.store) { toast('Buka toko dulu sebelum menerima pesanan.', 'warn'); return; }
      const r = await this.act(el, a, 'acceptOrder', { pesanan_id: a.dataset.id }, 'Pesanan diterima — stok sudah dikurangi');
      if (r && r.data.flag) toast(r.data.flag, 'warn', 5000);
    },
    async reject(a, e, el) {
      const why = await promptDlg({ title: 'Tolak pesanan?', msg: 'Alasan akan terlihat oleh pelanggan.', chips: ['Stok habis', 'Toko sudah tutup', 'Di luar jangkauan antar', 'Pesanan tidak jelas'], okText: 'Tolak Pesanan', danger: true });
      if (why) this.act(el, a, 'rejectOrder', { pesanan_id: a.dataset.id, alasan: why }, 'Pesanan ditolak');
    },
    async ocancel(a, e, el) {
      const why = await promptDlg({ title: 'Batalkan pesanan?', msg: 'Transaksinya ikut dibatalkan & stok dikembalikan.', chips: ['Pelanggan tidak datang', 'Pelanggan membatalkan', 'Stok habis'], okText: 'Batalkan', danger: true });
      if (why) this.act(el, a, 'cancelOrder', { pesanan_id: a.dataset.id, alasan: why }, 'Pesanan dibatalkan, stok dikembalikan');
    },
    done(a, e, el) {
      const o = this.find(a.dataset.id); if (!o) return;
      let m = o.metode === 'TRANSFER' ? 'TRANSFER' : 'TUNAI';
      const s = sheet({ title: 'Pembayaran ' + o.kode, body: '<div class="hero" style="padding:16px"><div class="k">TOTAL</div><div class="v">' + rp(o.total) + '</div></div><div class="stack" style="margin-top:12px">' +
        [['TUNAI', 'Tunai', 'banknote'], ['QRIS', 'QRIS', 'qr-code'], ['TRANSFER', 'Transfer', 'landmark']].map((x) => '<button class="opt" data-m="' + x[0] + '" type="button"><span class="radio-dot"></span>' + icon(x[2], 'sm') + '<span class="grow t">' + x[1] + '</span></button>').join('') + '</div>',
      foot: '<button class="btn primary block lg" id="poDone" type="button">' + icon('check', 'sm') + 'Tandai Selesai</button>' });
      const paint = () => $$('[data-m]', s.el).forEach((b) => b.classList.toggle('is-on', b.dataset.m === m));
      s.el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (b) { m = b.dataset.m; paint(); } });
      $('#poDone', s.el).onclick = async (ev) => { const r = await this.act(el, ev.currentTarget, 'completeOrder', { pesanan_id: o.pesanan_id, metode: m }, 'Pesanan selesai'); if (r) s.close(); };
      paint();
    },
    oprint(a) { const o = this.find(a.dataset.id); if (o) Printer.printTx(this.txOf(o)); },
    async proof(a) {
      const o = this.find(a.dataset.id); if (!o) return;
      const s = sheet({ title: 'Bukti bayar ' + o.kode, body: skeletonList(1, 300) });
      const r = await api('getProof', { file_id: o.bukti_file_id });
      if (s.el.isConnected) $('.sh-body', s.el).innerHTML = r.ok ? '<img src="' + r.data.dataUrl + '" alt="Bukti bayar" style="width:100%;border-radius:12px">' : retryBox(r.error, 'noop');
    }
  }
});

/* --------------------------------------------------- Pengaturan Jual Online */
async function cropAspect(file, aspect, maxW, maxBytes) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
    if (sw / sh > aspect) { const w = sh * aspect; sx = (sw - w) / 2; sw = w; } else { const h = sw / aspect; sy = (sh - h) / 2; sh = h; }
    let scale = Math.min(1, maxW / sw), q = 0.85, out = '';
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('canvas'); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (Math.ceil((out.length - out.indexOf(',') - 1) * 3 / 4) <= maxBytes) return out;
      if (q > 0.55) q -= 0.1; else scale *= 0.85;
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
/** QR code → canvas dengan label (nama toko / nomor meja) siap cetak. */
async function qrCanvas(text, o) {
  o = Object.assign({ size: 720, title: '', sub: '', foot: '' }, o || {});
  await loadScript(QR_LIB);
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), quiet = 4, cell = Math.floor(o.size / (n + quiet * 2)), qs = cell * (n + quiet * 2);
  const head = o.title ? 120 : 0, footH = (o.sub ? 70 : 0) + (o.foot ? 50 : 0) + (o.title || o.sub ? 30 : 0);
  const c = document.createElement('canvas'); c.width = qs; c.height = head + qs + footH;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const col = getComputedStyle(document.documentElement).getPropertyValue('--p').trim() || '#F26B1D';
  if (o.title) { x.fillStyle = col; x.font = '800 54px "Plus Jakarta Sans", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.title, qs / 2, head / 2 + 10, qs - 40); }
  x.fillStyle = '#111';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + quiet) * cell, head + (r + quiet) * cell, cell, cell);
  let y = head + qs;
  if (o.sub) { x.fillStyle = '#111'; x.font = '800 46px "Plus Jakarta Sans", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.sub, qs / 2, y + 30, qs - 40); y += 70; }
  if (o.foot) { x.fillStyle = '#6B7280'; x.font = '600 30px "Plus Jakarta Sans", Arial, sans-serif'; x.textAlign = 'center'; x.fillText(o.foot, qs / 2, y + 20, qs - 40); }
  return c;
}
/* ------------------------------------------------------- Drag & drop (sentuh + mouse + keyboard) */
function makeSortable(list, o) {
  if (!list || list._sortable) return; list._sortable = true;
  const items = () => Array.from(list.children).filter((x) => x.matches(o.item));
  const ids = () => items().map((x) => x.dataset.id);
  const flip = (mut) => {
    const els = items(), before = new Map(els.map((x) => [x, x.getBoundingClientRect().top]));
    mut();
    els.forEach((x) => { if (x.classList.contains('dnd-drag')) return; const d = before.get(x) - x.getBoundingClientRect().top; if (!d) return; x.style.transition = 'none'; x.style.transform = 'translateY(' + d + 'px)'; x.getBoundingClientRect(); x.style.transition = 'transform .16s ease'; x.style.transform = ''; });
  };
  list.addEventListener('keydown', (e) => {
    const h = e.target.closest(o.handle); if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const it = h.closest(o.item); if (!it || it.parentElement !== list) return;
    e.preventDefault(); e.stopPropagation();
    const all = items(), i = all.indexOf(it), j = i + (e.key === 'ArrowUp' ? -1 : 1); if (j < 0 || j >= all.length) return;
    flip(() => list.insertBefore(it, e.key === 'ArrowUp' ? all[j] : all[j].nextSibling)); h.focus();
    o.onEnd(ids());
  });
  list.addEventListener('pointerdown', (e) => {
    const h = e.target.closest(o.handle); if (!h || e.button > 0) return;
    const it = h.closest(o.item); if (!it || it.parentElement !== list) return;
    e.preventDefault(); e.stopPropagation();
    if (o.onStart) o.onStart(it);
    const r = it.getBoundingClientRect(), dy = Math.max(8, Math.min(r.height - 8, e.clientY - r.top));
    const ph = document.createElement('div'); ph.className = 'dnd-ph'; ph.style.height = r.height + 'px';
    list.insertBefore(ph, it);
    Object.assign(it.style, { position: 'fixed', left: r.left + 'px', top: (e.clientY - dy) + 'px', width: r.width + 'px', zIndex: 1200, pointerEvents: 'none', margin: 0 });
    it.classList.add('dnd-drag'); document.body.classList.add('dnd-on');
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (err) {}
    let y = e.clientY, raf = 0, alive = true;
    const place = () => {
      const sibs = items().filter((x) => x !== it); let target = null;
      for (const s of sibs) { const b = s.getBoundingClientRect(); if (y < b.top + b.height / 2) { target = s; break; } }
      let n = ph.nextElementSibling; while (n === it) n = n.nextElementSibling;
      if (n !== target) flip(() => list.insertBefore(ph, target || (sibs.length ? sibs[sibs.length - 1].nextSibling : null)));
    };
    const loop = () => {
      if (!alive) return;
      const edge = 80, H = innerHeight; let v = 0;
      if (y < edge) v = -Math.ceil((edge - y) / 5); else if (y > H - edge - 70) v = Math.ceil((y - (H - edge - 70)) / 5);
      if (v) { scrollBy(0, v); place(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const move = (ev) => { y = ev.clientY; it.style.top = (y - dy) + 'px'; place(); };
    const end = () => {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      list.insertBefore(it, ph); ph.remove();
      ['position', 'left', 'top', 'width', 'zIndex', 'pointerEvents', 'margin'].forEach((k) => { it.style[k] = ''; });
      it.classList.remove('dnd-drag'); document.body.classList.remove('dnd-on');
      it.classList.add('dnd-drop'); setTimeout(() => it.classList.remove('dnd-drop'), 400);
      o.onEnd(ids(), it);
    };
    addEventListener('pointermove', move, { passive: true }); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  });
}

/* ------------------------------------------------------- QR Meja: halaman A4 siap cetak */
const QR_LAYOUT = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 9: [3, 3] };
async function qrMejaPages(o) {
  // o: {from, count, per, dpi, title, foot}
  await loadScript(QR_LIB);
  try { await document.fonts.load('800 40px "Plus Jakarta Sans"'); } catch (e) {}
  const mm = (v) => Math.round(v * o.dpi / 25.4), [cols, rows] = QR_LAYOUT[o.per] || [2, 3];
  const W = mm(210), H = mm(297), M = mm(10), G = mm(6);
  const cw = Math.floor((W - M * 2 - G * (cols - 1)) / cols), ch = Math.floor((H - M * 2 - G * (rows - 1)) / rows);
  const col = getComputedStyle(document.documentElement).getPropertyValue('--p').trim() || '#F26B1D';
  const font = (w, px) => w + ' ' + px + 'px "Plus Jakarta Sans", Arial, sans-serif';
  const nums = []; for (let i = 0; i < o.count; i++) nums.push(o.from + i);
  const pages = [];
  for (let p = 0; p < nums.length; p += o.per) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    nums.slice(p, p + o.per).forEach((n, k) => {
      const cx = M + (k % cols) * (cw + G), cy = M + Math.floor(k / cols) * (ch + G);
      // garis potong
      x.save(); x.strokeStyle = '#C7C7C7'; x.lineWidth = Math.max(1, mm(0.3)); x.setLineDash([mm(2), mm(1.5)]);
      const rr = mm(4); x.beginPath(); x.moveTo(cx + rr, cy); x.arcTo(cx + cw, cy, cx + cw, cy + ch, rr); x.arcTo(cx + cw, cy + ch, cx, cy + ch, rr); x.arcTo(cx, cy + ch, cx, cy, rr); x.arcTo(cx, cy, cx + cw, cy, rr); x.closePath(); x.stroke(); x.restore();
      const unit = Math.min(cw, ch * 0.78);                       // skala teks mengikuti ukuran kartu
      const tH = o.title ? Math.round(unit * 0.13) : 0, mH = Math.round(unit * 0.17), fH = o.foot ? Math.round(unit * 0.09) : 0, pad = Math.round(unit * 0.06);
      const qrMax = Math.min(cw - pad * 2, ch - pad * 2 - tH - mH - fH);
      const q = window.qrcode(0, 'M'); q.addData(shopUrl(String(n))); q.make();
      const mc = q.getModuleCount(), quiet = 2, cell = Math.max(1, Math.floor(qrMax / (mc + quiet * 2))), qs = cell * (mc + quiet * 2);
      const block = tH + qs + mH + fH; let y = cy + Math.round((ch - block) / 2);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (o.title) { x.fillStyle = col; x.font = font(800, Math.round(tH * 0.62)); x.fillText(o.title, cx + cw / 2, y + tH / 2, cw - pad * 2); y += tH; }
      const qx = Math.round(cx + (cw - qs) / 2); x.fillStyle = '#111';
      for (let r = 0; r < mc; r++) for (let m = 0; m < mc; m++) if (q.isDark(r, m)) x.fillRect(qx + (m + quiet) * cell, y + (r + quiet) * cell, cell, cell);
      y += qs;
      x.fillStyle = '#111'; x.font = font(800, Math.round(mH * 0.72)); x.fillText('MEJA ' + n, cx + cw / 2, y + mH / 2, cw - pad * 2); y += mH;
      if (o.foot) { x.fillStyle = '#6B7280'; x.font = font(600, Math.round(fH * 0.62)); x.fillText(o.foot, cx + cw / 2, y + fH / 2, cw - pad * 2); }
    });
    pages.push(c);
  }
  return pages;
}
function openQrMeja(cfg, onCount) {
  const st = { from: 1, count: Math.max(1, Math.min(100, toNum(cfg.jumlah_meja) || 10)), per: Store.get('qrmeja:per', 6), foot: Store.get('qrmeja:foot', 'Scan untuk pesan dari meja'), title: App.settings.nama_toko || '' };
  const s = sheet({ title: 'Cetak QR Meja', maxWidth: 640,
    body: '<div class="grid-2"><label class="field"><span class="lbl">Mulai dari meja no.</span><input class="input" id="qmFrom" type="number" inputmode="numeric" min="1" max="999" value="' + st.from + '"></label>' +
      '<div class="field"><span class="lbl">Jumlah QR dicetak</span><div class="stepper qm-step"><button type="button" data-q="-1" aria-label="Kurangi">' + icon('minus', 'sm') + '</button><input class="input" id="qmCount" type="number" inputmode="numeric" min="1" max="100" value="' + st.count + '"><button type="button" data-q="1" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div></div></div>' +
      '<div class="chips wrap" style="margin-top:-2px">' + [5, 10, 15, 20, 30].map((n) => '<button class="chip" type="button" data-n="' + n + '">' + n + ' meja</button>').join('') + '</div>' +
      '<div class="field"><span class="lbl">Ukuran QR per kertas A4</span><div class="seg light js-per">' + [[1, '1 (stand)'], [2, '2 besar'], [4, '4'], [6, '6'], [9, '9 kecil']].map((x) => '<button type="button" data-per="' + x[0] + '" class="' + (st.per === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
      '<label class="field"><span class="lbl">Teks di bawah nomor meja</span><input class="input" id="qmFoot" maxlength="50" value="' + esc(st.foot) + '"></label>' +
      '<div class="qm-info js-qminfo"></div>' +
      '<div class="qm-prev js-qmprev"><div class="spinner" style="margin:40px auto"></div></div>' +
      (cfg.layanan && cfg.layanan.meja ? '' : '<div class="banner warn" style="margin-top:10px">' + icon('alert', 'sm') + '<div>"Makan di tempat (QR meja)" belum aktif di bagian <b>Cara pesan</b>. Aktifkan & simpan agar QR meja bisa dipakai pelanggan.</div></div>'),
    foot: '<div class="grid-3" style="gap:8px"><button class="btn outline" id="qmPng" type="button">' + icon('image', 'sm') + 'PNG</button><button class="btn outline" id="qmPdf" type="button">' + icon('download', 'sm') + 'PDF</button><button class="btn primary" id="qmPrint" type="button">' + icon('printer', 'sm') + 'Cetak</button></div>' });
  const E = (id) => $('#' + id, s.el);
  let tok = 0, timer = 0;
  const read = () => {
    st.from = Math.max(1, Math.min(999, Math.floor(toNum(E('qmFrom').value)) || 1));
    st.count = Math.max(1, Math.min(100, Math.floor(toNum(E('qmCount').value)) || 1));
    st.foot = E('qmFoot').value.trim();
  };
  const info = () => { const pg = Math.ceil(st.count / st.per); $('.js-qminfo', s.el).innerHTML = icon('table', 'xs') + '<b>Meja ' + st.from + (st.count > 1 ? '–' + (st.from + st.count - 1) : '') + '</b> · ' + st.count + ' QR · ' + pg + ' halaman A4'; };
  const preview = async () => {
    read(); info(); const my = ++tok;
    try {
      const pages = await qrMejaPages(Object.assign({}, st, { dpi: 72 }));
      if (my !== tok || !s.el.isConnected) return;
      $('.js-qmprev', s.el).innerHTML = pages.map((c, i) => '<figure><img src="' + c.toDataURL('image/png') + '" alt="Halaman ' + (i + 1) + '"><figcaption>Halaman ' + (i + 1) + ' dari ' + pages.length + '</figcaption></figure>').join('');
    } catch (e) { if (my === tok) $('.js-qmprev', s.el).innerHTML = '<div class="muted" style="padding:24px;text-align:center">Gagal membuat pratinjau QR (butuh internet sekali untuk memuat modul QR).</div>'; }
  };
  const later = () => { read(); info(); clearTimeout(timer); timer = setTimeout(preview, 280); };
  s.el.addEventListener('input', later);
  s.el.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'), n = e.target.closest('[data-n]'), per = e.target.closest('[data-per]');
    if (q) { E('qmCount').value = Math.max(1, Math.min(100, (toNum(E('qmCount').value) || 0) + Number(q.dataset.q))); later(); }
    if (n) { E('qmCount').value = n.dataset.n; later(); }
    if (per) { st.per = Number(per.dataset.per); $$('.js-per button', s.el).forEach((b) => b.classList.toggle('on', b === per)); Store.set('qrmeja:per', st.per); later(); }
  });
  const full = async (btn) => { read(); busy(btn, true); try { Store.set('qrmeja:foot', st.foot); if (onCount) onCount(st.from + st.count - 1); return await qrMejaPages(Object.assign({}, st, { dpi: 200 })); } catch (e) { toast('Gagal membuat QR meja: ' + e.message, 'bad'); return null; } finally { busy(btn, false); } };
  const fname = () => 'QR-Meja-' + st.from + (st.count > 1 ? '-' + (st.from + st.count - 1) : '');
  E('qmPdf').onclick = async (ev) => {
    const b = ev.currentTarget, pages = await full(b); if (!pages) return;
    busy(b, true);
    try { await loadScript(LIBS.jspdf); const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p', compress: true }); pages.forEach((c, i) => { if (i) doc.addPage(); doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST'); }); Exporter.saveBlob(doc.output('blob'), fname() + '.pdf'); }
    catch (e) { toast('Gagal membuat PDF: ' + e.message, 'bad'); }
    busy(b, false);
  };
  E('qmPng').onclick = async (ev) => {
    const pages = await full(ev.currentTarget); if (!pages) return;
    for (let i = 0; i < pages.length; i++) { const blob = await new Promise((r) => pages[i].toBlob(r, 'image/png')); Exporter.saveBlob(blob, fname() + (pages.length > 1 ? '-hal' + (i + 1) : '') + '.png'); if (i < pages.length - 1) await sleep(500); }
  };
  E('qmPrint').onclick = async (ev) => {
    const w = window.open('', '_blank'); if (w) w.document.write('<p style="font-family:sans-serif;padding:24px">Menyiapkan QR meja…</p>');
    const pages = await full(ev.currentTarget); if (!pages) { if (w) w.close(); return; }
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + fname() + '</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:210mm;height:297mm;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>' + pages.map((c) => '<img src="' + c.toDataURL('image/png') + '">').join('') + '<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},350)}<\/script></body></html>';
    if (w) { w.document.open(); w.document.write(html); w.document.close(); return; }
    // pop-up diblokir → cetak lewat bingkai tersembunyi
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html.replace(/<script>[\s\S]*<\/script>/, '')); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Izinkan pop-up untuk mencetak', 'warn'); } setTimeout(() => f.remove(), 60000); }, 600);
  };
  info(); preview();
  return s;
}
page('online', {
  role: 'OWNER', nav: false, foot: true, backTo: 'lainnya', paket: 'online',
  st: { open: 'status' },
  template() {
    return topbar({ back: true, title: 'Jual Online', sub: 'Toko online, QR meja & tampilan', right: '<button class="btn sm outline" data-act="preview" type="button">' + icon('eye', 'sm') + '<span class="hide-sm">Lihat Toko</span></button>' }) +
      '<div class="wrap js-body" style="padding-top:14px;max-width:860px"></div>' +
      '<div class="sticky-foot"><div class="in"><button class="btn primary block lg" data-act="save" type="button">' + icon('check', 'sm') + 'Simpan Pengaturan Toko Online</button></div></div>';
  },
  show(el) { this.c = onlineCfg(); this.qris = null; this.hapusQris = false; this.dirty = false; this.render(el); },
  sec(id, ic, title, sub, body) {
    const open = this.st.open === id;
    return '<div class="card on-sec' + (open ? ' open' : '') + '"><button class="on-h" data-act="sec" data-s="' + id + '" type="button"><span class="ico-box">' + icon(ic, 'sm') + '</span><span class="grow" style="text-align:left"><b>' + title + '</b><span class="muted">' + sub + '</span></span>' + icon(open ? 'chevron-up' : 'chevron-down', 'sm') + '</button>' + (open ? '<div class="on-b">' + body + '</div>' : '') + '</div>';
  },
  render(el) {
    const c = this.c, prods = App.boot.products || [], cats = App.boot.categories || [];
    const pName = (id) => ((prods.find((p) => p.produk_id === id) || {}).nama || '?');
    const link = shopUrl();
    const tog = (path, label, sub) => { const v = path.split('.').reduce((o, k) => o && o[k], c); return '<div class="row between on-row"><div><b style="font-size:14px">' + label + '</b>' + (sub ? '<div class="muted" style="font-size:12.5px">' + sub + '</div>' : '') + '</div><label class="toggle"><input type="checkbox" data-path="' + path + '"' + (v ? ' checked' : '') + '></label></div>'; };
    // urutan kategori & produk
    const catOrder = cats.slice().sort((a, b) => { const o = c.urutan.cats || [], ia = o.indexOf(a.kategori_id), ib = o.indexOf(b.kategori_id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || toNum(a.urutan) - toNum(b.urutan); });
    const prodsOf = (cid) => { const o = (c.urutan.prods || {})[cid] || []; return prods.filter((p) => p.kategori_id === cid).sort((a, b) => { const ia = o.indexOf(a.produk_id), ib = o.indexOf(b.produk_id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); }); };
    const promos = (App.boot.promos || []).filter((p) => p.status_aktif && (p.kanal || 'SEMUA') !== 'KASIR');
    $('.js-body', el).innerHTML =
      '<div class="card pad on-hero' + (c.aktif ? ' on' : '') + '"><div class="row"><span class="ico-box ' + (c.aktif ? 'ok' : '') + '" style="width:48px;height:48px">' + icon('globe') + '</span><div class="grow"><b style="font-size:16px">Jual Online ' + (c.aktif ? 'AKTIF' : 'nonaktif') + '</b><div class="muted" style="font-size:13px">' + (c.aktif ? 'Pelanggan bisa memesan lewat link & QR. Pesanan masuk ke menu Pesanan Online.' : 'Nyalakan saklar — toko online langsung terbuka untuk pelanggan.') + '</div></div><label class="toggle' + (this.saving ? ' is-busy' : '') + '"><input type="checkbox" data-path="aktif"' + (c.aktif ? ' checked' : '') + (this.saving ? ' disabled' : '') + '></label></div>' +
      '<div class="on-link"><span class="mono ellipsis grow">' + esc(link) + '</span><button class="btn xs outline" data-act="copylink" type="button">' + icon('copy', 'xs') + 'Salin</button></div>' +
      '<div class="grid-3" style="gap:8px;margin-top:10px"><button class="btn outline sm" data-act="qr" type="button">' + icon('qr-code', 'sm') + 'QR Toko</button><button class="btn outline sm" data-act="qrmeja" type="button">' + icon('utensils', 'sm') + 'QR Meja</button><a class="btn outline sm" style="color:var(--ok)" target="_blank" href="https://wa.me/?text=' + encodeURIComponent('Pesan ' + (App.settings.nama_toko || '') + ' online di sini 👉 ' + link) + '">' + icon('whatsapp', 'sm') + 'Bagikan</a></div>' +
      (c.aktif && !App.store ? '<div class="help">' + icon('info', 'xs') + 'Toko sedang tutup — pelanggan hanya bisa melihat menu ' + (c.pesan_saat_tutup ? '(pesanan tetap diterima, diproses saat buka)' : 'sampai toko dibuka') + '.</div>' : '') + '</div>' +

      this.sec('tampilan', 'image', 'Banner & pengumuman', (c.banners || []).length + ' banner' + (c.pengumuman ? ' · ada pengumuman' : ''),
        '<label class="field"><span class="lbl">Pengumuman (tampil di atas)</span><input class="input" data-path="pengumuman" maxlength="140" value="' + esc(c.pengumuman || '') + '" placeholder="contoh: Menu baru Es Teh Tarik sudah tersedia! 🧋"></label>' +
        '<div class="field"><span class="lbl">Banner (gambar 2:1, maks 8)' + ((c.banners || []).length > 1 ? ' · tahan ' + icon('grip', 'xs') + ' lalu geser untuk mengatur urutan' : '') + '</span></div><div class="stack js-dnd-bn" style="gap:10px">' + (c.banners || []).map((b, i) => '<div class="on-banner dnd-item" data-id="' + i + '">' + ((c.banners || []).length > 1 ? '<button class="dnd-h" type="button" aria-label="Geser banner (panah atas/bawah)">' + icon('grip', 'sm') + '</button>' : '') + '<div class="bimg2">' + (b.dataUrl || b.img_url ? '<img src="' + esc(b.dataUrl || b.img_url) + '" alt="">' : '') + '</div><div class="grow stack" style="gap:6px;min-width:0">' +
          '<input class="input" data-bn="' + i + '" data-k="judul" value="' + esc(b.judul || '') + '" placeholder="Judul banner (opsional)" maxlength="60" style="min-height:40px">' +
          '<input class="input" data-bn="' + i + '" data-k="sub" value="' + esc(b.sub || '') + '" placeholder="Keterangan (opsional)" maxlength="80" style="min-height:40px">' +
          '<select class="select" data-bn="' + i + '" data-k="produk_id" style="min-height:40px"><option value="">Tidak menautkan produk</option>' + prods.map((p) => '<option value="' + esc(p.produk_id) + '"' + (b.produk_id === p.produk_id ? ' selected' : '') + '>Buka: ' + esc(p.nama) + '</option>').join('') + '</select></div>' +
          '<div class="stack" style="gap:4px"><button class="icon-btn" data-act="bndel" data-i="' + i + '" type="button" style="color:var(--bad)" aria-label="Hapus">' + icon('trash', 'sm') + '</button></div></div>').join('') +
        '</div>' + ((c.banners || []).length < 8 ? '<button class="btn outline block" data-act="bnadd" type="button" style="margin-top:10px">' + icon('upload', 'sm') + 'Tambah Banner</button>' : '') +
        '<div class="help">' + icon('info', 'xs') + 'Gambar otomatis dipotong 2:1 & dikompres. Ide: foto promo, menu baru, suasana toko.</div>') +

      this.sec('urutan', 'rows', 'Urutan menu & produk tampil', 'Tahan & geser untuk mengatur urutan, sembunyikan produk',
        '<div class="help" style="margin:4px 0 10px">' + icon('grip', 'xs') + 'Tahan ikon titik-titik lalu geser ke atas/bawah. Ketuk nama kategori untuk mengatur produknya.</div>' +
        '<div class="dnd-list js-dnd-cats">' + catOrder.map((cat) => { const ps = prodsOf(cat.kategori_id), nh = ps.filter((p) => (c.hidden || []).indexOf(p.produk_id) > -1).length, op = this.st.cat === cat.kategori_id;
          return '<div class="on-cat dnd-item' + (op ? ' open' : '') + '" data-id="' + esc(cat.kategori_id) + '"><div class="on-cat-h"><button class="dnd-h" type="button" aria-label="Geser kategori ' + esc(cat.nama) + ' (panah atas/bawah)">' + icon('grip', 'sm') + '</button>' +
            '<button class="grow on-cat-t" data-act="catx" data-id="' + esc(cat.kategori_id) + '" type="button"><b>' + esc(cat.nama) + '</b><span class="muted">' + ps.length + ' produk' + (nh ? ' · ' + nh + ' disembunyikan' : '') + '</span>' + icon(op ? 'chevron-up' : 'chevron-down', 'sm') + '</button></div>' +
            (op ? '<div class="on-prods dnd-list js-dnd-prods" data-c="' + esc(cat.kategori_id) + '">' + (ps.length ? ps.map((p) => { const hid = (c.hidden || []).indexOf(p.produk_id) > -1; return '<div class="on-prod dnd-item" data-id="' + esc(p.produk_id) + '"><button class="dnd-h" type="button" aria-label="Geser ' + esc(p.nama) + ' (panah atas/bawah)">' + icon('grip', 'sm') + '</button><div class="thumb" style="width:36px;height:36px">' + productImg(p) + '</div><div class="grow t ellipsis" style="font-size:14px;' + (hid ? 'opacity:.45;text-decoration:line-through' : '') + '">' + esc(p.nama) + '</div>' +
              '<label class="toggle" title="Tampil di toko online"><input type="checkbox" data-hide="' + esc(p.produk_id) + '"' + (hid ? '' : ' checked') + '></label></div>'; }).join('') : '<div class="muted" style="padding:10px 0">Belum ada produk di kategori ini.</div>') + '</div>' : '') + '</div>'; }).join('') + '</div>' +
        '<div class="help">' + icon('info', 'xs') + 'Saklar = tampil/sembunyi di toko online saja (kasir tidak terpengaruh).</div>') +

      this.sec('best', 'flame', 'Best seller & label baru', (c.best || []).length + ' best seller · ' + Object.keys(c.labels || {}).filter((k) => c.labels[k] && c.labels[k].baru).length + ' label baru',
        '<div class="field"><span class="lbl">Rekomendasi Best Seller (tampil paling atas)</span></div><div class="chips wrap">' + (c.best || []).map((id, i) => '<span class="chip on">' + icon('flame', 'xs') + esc(pName(id)) + '<button type="button" data-act="bestdel" data-i="' + i + '" aria-label="Hapus" style="margin-left:4px;color:#fff">×</button></span>').join('') +
        '<button class="chip" data-act="bestadd" type="button">' + icon('plus', 'xs') + 'Pilih produk</button><button class="chip" data-act="bestauto" type="button">' + icon('trending-up', 'xs') + 'Isi dari 5 terlaris (30 hari)</button></div>' +
        '<div class="field"><span class="lbl">Label "Baru" / info varian baru</span></div><div class="stack" style="gap:8px">' + prods.map((p) => { const lb = (c.labels || {})[p.produk_id] || {}; return '<div class="row" style="gap:8px"><label class="check" style="flex:none;width:44%;min-width:0"><input type="checkbox" data-lbl="' + esc(p.produk_id) + '"' + (lb.baru ? ' checked' : '') + '><span class="ellipsis">' + esc(p.nama) + '</span></label><input class="input" data-lbltx="' + esc(p.produk_id) + '" value="' + esc(lb.teks || '') + '" placeholder="Baru / Varian baru: Ice" maxlength="40" style="min-height:40px"' + (lb.baru ? '' : ' disabled') + '></div>'; }).join('') + '</div>') +

      this.sec('promo', 'percent', 'Diskon & promo online', promos.length + ' promo tampil di toko online',
        (promos.length ? promos.map((p) => '<div class="list-item"><span class="ico-box ok">' + icon('tag', 'sm') + '</span><div class="grow"><div class="t">' + esc(p.nama) + '</div><div class="s">' + (p.tipe === 'PERSEN' ? toNum(p.nilai) + '%' : rp(p.nilai)) + ' · ' + (p.berlaku_untuk === 'SEMUA' ? 'semua menu' : p.berlaku_untuk === 'PRODUK' ? pName(p.target_id) : 'kategori') + (toNum(p.min_belanja) ? ' · min ' + rp(p.min_belanja) : '') + '</div></div><span class="pill ' + ((p.kanal || 'SEMUA') === 'ONLINE' ? 'brand' : 'neutral') + ' sm">' + ((p.kanal || 'SEMUA') === 'ONLINE' ? 'Online saja' : 'Kasir & online') + '</span></div>').join('') : '<div class="muted">Belum ada promo untuk toko online.</div>') +
        '<a class="btn outline block" href="#/promo" style="margin-top:10px">' + icon('tag', 'sm') + 'Kelola Promo & Diskon</a><div class="help">' + icon('info', 'xs') + 'Di form promo pilih "Berlaku di: Online saja" untuk diskon khusus pesanan online. Diskon otomatis terlihat (harga coret & label) di toko online.</div>') +

      this.sec('layanan', 'truck', 'Cara pesan & ongkir', ['ambil', 'antar', 'meja'].filter((k) => c.layanan[k]).map((k) => ({ ambil: 'Ambil', antar: 'Antar', meja: 'Meja' }[k])).join(' · ') || 'belum dipilih',
        tog('layanan.ambil', 'Ambil di toko', 'Pelanggan memilih jam ambil') + tog('layanan.antar', 'Diantar', 'Pelanggan mengisi alamat') + tog('layanan.meja', 'Makan di tempat (QR meja)', 'Nomor meja terisi otomatis dari QR') +
        (c.layanan.antar ? '<div class="field"><span class="lbl">Ongkos kirim</span><div class="seg light">' + [['gratis', 'Gratis'], ['tetap', 'Tarif tetap'], ['wa', 'Konfirmasi via WA']].map((x) => '<button type="button" data-act="ongkir" data-v="' + x[0] + '" class="' + (c.ongkir.mode === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
          (c.ongkir.mode === 'tetap' ? '<div style="margin-top:8px">' + moneyInput('data-money="ongkir.nilai" placeholder="contoh: 5.000"', c.ongkir.nilai) + '</div>' : '') + '</div>' : '') +
        '<div class="grid-2"><label class="field"><span class="lbl">Minimal pesanan</span>' + moneyInput('data-money="min_order" placeholder="0 = tanpa minimal"', c.min_order) + '</label><label class="field"><span class="lbl">Jumlah meja (QR)</span><input class="input" data-path="jumlah_meja" inputmode="numeric" value="' + esc(c.jumlah_meja || '') + '"></label></div>' +
        '<label class="field"><span class="lbl">Jam buka (info untuk pelanggan)</span><input class="input" data-path="jam_buka" maxlength="60" value="' + esc(c.jam_buka || '') + '" placeholder="contoh: Setiap hari 07.00–21.00"></label>' +
        tog('pesan_saat_tutup', 'Terima pesanan saat toko tutup', 'Pesanan masuk & diproses saat toko dibuka (pre-order)')) +

      this.sec('bayar', 'wallet', 'Pembayaran', [c.bayar.ditempat ? 'Bayar di tempat' : '', c.bayar.transfer ? 'Transfer/QRIS' : ''].filter(Boolean).join(' · ') || 'belum dipilih',
        tog('bayar.ditempat', 'Bayar di kasir / saat diterima', 'Tunai atau QRIS saat ambil / COD') + tog('bayar.transfer', 'Transfer / QRIS + unggah bukti', 'Pelanggan wajib mengunggah foto bukti bayar') +
        (c.bayar.transfer ? '<div class="field"><span class="lbl">Gambar QRIS</span><div class="row" style="gap:12px"><div class="thumb" style="width:96px;height:96px">' + ((this.qris || (!this.hapusQris && c.qris_url)) ? '<img src="' + esc(this.qris || c.qris_url) + '" alt="QRIS">' : icon('qr-code', 'lg')) + '</div><div class="stack" style="gap:6px"><button class="btn outline sm" data-act="qris" type="button">' + icon('upload', 'sm') + 'Unggah QRIS</button>' + ((this.qris || (!this.hapusQris && c.qris_url)) ? '<button class="btn outline sm" data-act="noqris" type="button" style="color:var(--bad)">' + icon('trash', 'sm') + 'Hapus</button>' : '') + '</div></div></div>' +
          '<label class="field"><span class="lbl">Info rekening (opsional)</span><textarea class="textarea" data-path="rekening" rows="3" maxlength="300" placeholder="BRI 1234-5678-90 a.n. Kedai Rasa Nusantara&#10;DANA 0812xxxx">' + esc(c.rekening || '') + '</textarea></label>' : '')) +
      '<div style="height:12px"></div>';
    this.bind(el); this.paintSave(el);
    makeSortable($('.js-dnd-cats', el), { item: '.dnd-item', handle: '.dnd-h',
      onStart: (it) => { if (this.st.cat) { this.st.cat = ''; $$('.on-prods', el).forEach((x) => x.remove()); $$('.on-cat.open', el).forEach((x) => x.classList.remove('open')); } },
      onEnd: (ids) => { this.c.urutan.cats = ids; this.touch(el); } });
    $$('.js-dnd-prods', el).forEach((l) => makeSortable(l, { item: '.dnd-item', handle: '.dnd-h', onEnd: (ids) => { this.c.urutan.prods[l.dataset.c] = ids; this.touch(el); } }));
    makeSortable($('.js-dnd-bn', el), { item: '.dnd-item', handle: '.dnd-h', onEnd: (ids) => { const old = this.c.banners.slice(); this.c.banners = ids.map((i) => old[Number(i)]); this.touch(el); this.render(el); } });
  },
  touch(el) { this.dirty = true; this.paintSave(el); },
  paintSave(el) {
    const b = $('[data-act="save"]', el); if (!b || b.classList.contains('is-loading')) return;
    b.innerHTML = this.dirty ? icon('check', 'sm') + 'Simpan Perubahan <span class="dirty-dot"></span>' : icon('check', 'sm') + 'Tersimpan';
    b.classList.toggle('outline', !this.dirty); b.classList.toggle('primary', this.dirty);
  },
  bind(el) {
    const body = $('.js-body', el), c = this.c;
    const setPath = (path, v) => { const ks = path.split('.'); let o = c; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = v; this.dirty = true; };
    body.oninput = (e) => {
      const t = e.target; setTimeout(() => this.paintSave(el));
      if (t.dataset.path && t.type !== 'checkbox') setPath(t.dataset.path, t.dataset.path === 'jumlah_meja' ? toNum(t.value) : t.value);
      if (t.dataset.money) setPath(t.dataset.money, parseMoney(t.value));
      if (t.dataset.bn !== undefined) { c.banners[t.dataset.bn][t.dataset.k] = t.value; this.dirty = true; }
      if (t.dataset.lbltx) { c.labels[t.dataset.lbltx] = Object.assign(c.labels[t.dataset.lbltx] || {}, { teks: t.value }); this.dirty = true; }
    };
    body.onchange = (e) => {
      const t = e.target;
      if (t.dataset.bn !== undefined) { c.banners[t.dataset.bn][t.dataset.k] = t.value; this.dirty = true; }
      if (t.type !== 'checkbox') return;
      if (t.dataset.path === 'aktif') { this.quickToggle(el, t.checked); return; }
      if (t.dataset.path) { setPath(t.dataset.path, t.checked); this.render(el); }
      if (t.dataset.hide) { const h = c.hidden = c.hidden || [], i = h.indexOf(t.dataset.hide); if (t.checked && i > -1) h.splice(i, 1); if (!t.checked && i < 0) h.push(t.dataset.hide); this.dirty = true; this.render(el); }
      if (t.dataset.lbl) { c.labels[t.dataset.lbl] = Object.assign(c.labels[t.dataset.lbl] || {}, { baru: t.checked }); if (t.checked && !c.labels[t.dataset.lbl].teks) c.labels[t.dataset.lbl].teks = 'Baru'; if (!t.checked) delete c.labels[t.dataset.lbl]; this.dirty = true; this.render(el); }
    };
  },
  /** Saklar Jual Online → langsung tersimpan ke server (toko online seketika buka/tutup). */
  async quickToggle(el, on) {
    const c = this.c, prev = c.aktif;
    c.aktif = on;
    if (on && !c.layanan.ambil && !c.layanan.antar && !c.layanan.meja) c.layanan.ambil = true;
    if (on && !c.bayar.ditempat && !c.bayar.transfer) c.bayar.ditempat = true;
    if (!navigator.onLine) { c.aktif = prev; this.render(el); toast('Butuh internet untuk membuka/menutup toko online.', 'warn'); return; }
    this.saving = true; this.render(el);
    const ok = await this.persist(el);
    this.saving = false;
    if (!ok) { this.c.aktif = prev; this.render(el); return; }
    toast(on ? 'Toko online DIBUKA — pelanggan sudah bisa memesan' : 'Toko online DITUTUP — pelanggan tidak bisa memesan', on ? 'ok' : 'warn', 3500);
  },
  /** Kirim seluruh pengaturan ke server. */
  async persist(el, btn) {
    const c = this.c;
    if (btn) busy(btn, true);
    const sent = JSON.stringify(c), payload = JSON.parse(sent), qris = this.qris; delete payload.qris_url; delete payload.qris_file_id;
    const r = await api('saveOnlineConfig', { config: payload, qrisDataUrl: qris || '', hapusQris: this.hapusQris });
    if (btn) busy(btn, false);
    this.saving = false;
    if (!r.ok) { toast(r.error, 'bad', 5000); if (btn) this.paintSave(el); return false; }
    App.boot.settings.online_config = JSON.stringify(r.data.config); Boot.persist(); emit('boot');
    if (JSON.stringify(this.c) === sent && this.qris === qris) { this.c = onlineCfg(); this.qris = null; this.hapusQris = false; this.dirty = false; }
    else {                                                     // ada perubahan saat menyimpan → pertahankan, ambil URL gambar dari server
      const srv = onlineCfg(), byId = {}; (srv.banners || []).forEach((b) => { byId[b.id] = b; });
      this.c.banners = (this.c.banners || []).map((b) => (b.dataUrl && byId[b.id] ? byId[b.id] : b));
      if (this.qris === qris) { this.c.qris_url = srv.qris_url; this.qris = null; this.hapusQris = false; }
      this.dirty = true;
    }
    this.render(el);
    Shell.renderNav(); Orders.load(true);
    return true;
  },
  actions: {
    sec(a, e, el) { this.st.open = this.st.open === a.dataset.s ? '' : a.dataset.s; this.render(el); },
    async preview(a, e, el) {
      if (!this.dirty) { window.open(shopUrl(), '_blank'); return; }
      const w = window.open('', '_blank');                    // buka dulu (hindari blokir pop-up), isi setelah tersimpan
      if (w) w.document.write('<p style="font-family:sans-serif;padding:24px">Menyimpan perubahan…</p>');
      const ok = await this.actions.save.call(this, $('[data-act="save"]', el), null, el);
      if (w) { if (ok) w.location.href = shopUrl(); else w.close(); }
    },
    copylink() { copyText(shopUrl()); },
    async qr(a) {
      busy(a, true);
      try { const cv = await qrCanvas(shopUrl(), { title: App.settings.nama_toko || 'Pesan Online', sub: 'Scan untuk pesan', foot: 'Pesan online · ambil / antar' }); const s = sheet({ title: 'QR Toko Online', body: '<img src="' + cv.toDataURL('image/png') + '" alt="QR" style="width:100%;max-width:360px;display:block;margin:0 auto;border-radius:12px;border:1px solid var(--line)">', foot: '<button class="btn primary block lg" id="qrDl" type="button">' + icon('download', 'sm') + 'Unduh QR (PNG)</button>' }); $('#qrDl', s.el).onclick = () => cv.toBlob((b) => Exporter.saveBlob(b, 'QR-Toko-Online.png'), 'image/png'); }
      catch (e) { toast('Gagal membuat QR (butuh internet sekali untuk memuat modul QR).', 'bad'); }
      busy(a, false);
    },
    qrmeja(a, e, el) { openQrMeja(this.c, (last) => { if (last > toNum(this.c.jumlah_meja)) { this.c.jumlah_meja = last; this.touch(el); } }); },
    async bnadd(a, e, el) {
      const f = await pickFile(false); if (!f) return;
      busy(a, true);
      try { const d = await cropAspect(f, 2, 1600, 250 * 1024); this.c.banners = this.c.banners || []; this.c.banners.push({ id: shortId('BN'), dataUrl: d, judul: '', sub: '', produk_id: '' }); this.dirty = true; this.render(el); }
      catch (err) { toast(err.message, 'bad'); }
      busy(a, false);
    },
    bndel(a, e, el) { this.c.banners.splice(Number(a.dataset.i), 1); this.dirty = true; this.render(el); },
    catx(a, e, el) { this.st.cat = this.st.cat === a.dataset.id ? '' : a.dataset.id; this.render(el); },
    bestdel(a, e, el) { this.c.best.splice(Number(a.dataset.i), 1); this.dirty = true; this.render(el); },
    bestadd(a, e, el) {
      const sel = new Set(this.c.best || []);
      const s = sheet({ title: 'Pilih Best Seller', body: (App.boot.products || []).map((p) => '<label class="list-item" style="cursor:pointer"><input type="checkbox" data-b="' + esc(p.produk_id) + '"' + (sel.has(p.produk_id) ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--p)"><div class="thumb" style="width:40px;height:40px">' + productImg(p) + '</div><div class="grow t">' + esc(p.nama) + '</div></label>').join(''), foot: '<button class="btn primary block lg" id="bOk" type="button">Simpan pilihan</button>' });
      s.el.addEventListener('change', (ev) => { const b = ev.target.dataset.b; if (b) { if (ev.target.checked) sel.add(b); else sel.delete(b); } });
      $('#bOk', s.el).onclick = () => { const keep = (this.c.best || []).filter((x) => sel.has(x)); sel.forEach((x) => { if (keep.indexOf(x) < 0) keep.push(x); }); this.c.best = keep.slice(0, 12); this.dirty = true; s.close(); this.render(el); };
    },
    async bestauto(a, e, el) {
      if (!navigator.onLine) { toast('Butuh internet', 'warn'); return; }
      busy(a, true);
      const r = await api('getReport', { from: daysAgo(29).toISOString(), to: endOfDay(new Date()).toISOString() });
      busy(a, false);
      if (!r.ok) { toast(r.error, 'bad'); return; }
      const top = (r.data.byProduct || []).filter((x) => x.produk_id && x.produk_id !== 'ONGKIR' && Local.product(x.produk_id)).sort((x, y) => y.qty - x.qty).slice(0, 5).map((x) => x.produk_id);
      if (!top.length) { toast('Belum ada data penjualan 30 hari terakhir.', 'warn'); return; }
      this.c.best = top; this.dirty = true; this.render(el); toast('Diisi dari ' + top.length + ' produk terlaris', 'ok');
    },
    ongkir(a, e, el) { this.c.ongkir.mode = a.dataset.v; this.dirty = true; this.render(el); },
    async qris(a, e, el) { const f = await pickFile(false); if (!f) return; try { this.qris = await compressImage(f, { maxDim: 1000, maxBytes: 250 * 1024 }); this.hapusQris = false; this.dirty = true; this.render(el); } catch (err) { toast(err.message, 'bad'); } },
    noqris(a, e, el) { this.qris = null; this.hapusQris = true; this.dirty = true; this.render(el); },
    async save(a, e, el) {
      const c = this.c;
      if (c.aktif && !c.layanan.ambil && !c.layanan.antar && !c.layanan.meja) { toast('Pilih minimal satu cara pesan (Ambil / Antar / Meja).', 'bad'); this.st.open = 'layanan'; this.render(el); return false; }
      if (c.aktif && !c.bayar.ditempat && !c.bayar.transfer) { toast('Pilih minimal satu cara pembayaran.', 'bad'); this.st.open = 'bayar'; this.render(el); return false; }
      if (!navigator.onLine) { toast('Menyimpan butuh internet.', 'warn'); return false; }
      const ok = await this.persist(el, a);
      if (ok) toast(c.aktif ? 'Tersimpan — toko online langsung diperbarui' : 'Pengaturan tersimpan (toko online nonaktif)', 'ok', 3000);
      return ok;
    }
  }
});


/* ============================================ PAKET (fitur Jual Online terkunci) */
function sellerWa() { return waNumber(CFG.SELLER_WA || '082213712168'); }
page('paket', {
  backTo: 'lainnya',
  template() {
    const t = Tenant.current || {};
    const msg = 'Halo admin Qasir, saya ingin upgrade ke Paket Kasir + Jual Online.\nToko: ' + (App.settings.nama_toko || t.nama || '') + '\nKode Toko: ' + (t.kode || '-');
    const feat = [['globe', 'Toko online sendiri', 'Link & QR toko untuk dibagikan ke pelanggan'], ['utensils', 'Pesan dari meja', 'Pelanggan scan QR meja, pesanan langsung masuk'], ['inbox', 'Pesanan Online', 'Terima, tolak, dan selesaikan pesanan dari kasir'], ['qr-code', 'Bayar QRIS / transfer', 'Pelanggan bisa bayar sebelum mengambil']];
    return topbar({ back: true, title: 'Jual Online', sub: 'Paket Anda: ' + (Tenant.paketLabel || 'Kasir') }) +
      '<div class="wrap" style="padding-top:16px;max-width:560px"><div class="card pad upsell">' +
      '<div class="row" style="gap:12px"><span class="ico-box warn">' + icon('lock') + '</span><div class="grow"><div style="font-weight:800;font-size:17px">Fitur ini ada di Paket Kasir + Jual Online</div><div class="muted" style="font-size:13.5px">Data dan transaksi Anda tetap utuh saat upgrade — tidak perlu pasang ulang.</div></div></div>' +
      '<div class="upsell-list">' + feat.map((f) => '<div class="row" style="gap:12px;align-items:flex-start"><span class="ico-box">' + icon(f[0], 'sm') + '</span><div><b>' + f[1] + '</b><div class="muted" style="font-size:13px">' + f[2] + '</div></div></div>').join('') + '</div>' +
      '<a class="btn primary block lg" style="background:#16A34A;border-color:#16A34A" target="_blank" rel="noopener" href="https://wa.me/' + sellerWa() + '?text=' + encodeURIComponent(msg) + '">' + icon('whatsapp', 'sm') + 'Tanya upgrade lewat WhatsApp</a>' +
      '</div></div>';
  }
});

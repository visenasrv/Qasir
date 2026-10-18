/* ============================================================================
   QASIR — p-ops.js · Riwayat Transaksi, Stok, Utang, Akun, Menu Lainnya
   ========================================================================== */
'use strict';

const METHOD_PILL = { TUNAI: 'ok', QRIS: 'info', TRANSFER: 'violet', UTANG: 'warn' };
function methodPill(m) { return '<span class="pill ' + (METHOD_PILL[m] || 'neutral') + ' sm">' + esc(METODE_LABEL[m] || m) + '</span>'; }

/* ====================================================== RIWAYAT TRANSAKSI */
page('transaksi', {
  keepScroll: true,
  st: { range: 'today', q: '', kasir: '', metode: '', status: '' },
  server: [], local: [],
  template() {
    return topbar({ title: 'Riwayat Transaksi', sub: '<span class="js-store-sub"></span>', right: syncPill() }) +
      '<div class="wrap" style="padding-top:14px"><div class="input-wrap">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari no. nota / nama pelanggan" autocomplete="off"></div>' +
      '<div class="chips js-filters" style="margin-top:10px"></div>' +
      '<div class="stat-tiles js-stats" style="margin-top:14px"></div>' +
      '<div class="label-row"><span class="sec-title js-list-title">Daftar nota hari ini</span><span class="muted row" style="gap:4px;font-size:13px">' + icon('arrow-down', 'xs') + 'Terbaru</span></div>' +
      '<div class="js-list">' + skeletonList(4, 96) + '</div></div>';
  },
  init(el) {
    $('.js-q', el).addEventListener('input', debounce((e) => { this.st.q = e.target.value.trim().toLowerCase(); this.render(el); }, 120));
    on('synced', () => { if (App.current === 'transaksi') this.loadLocal(el); });
  },
  show(el) { $('.js-store-sub', el).textContent = App.settings.nama_toko || ''; this.renderFilters(el); this.load(el); },
  range() {
    const r = this.st.range;
    if (r === 'yesterday') return { from: daysAgo(1), to: endOfDay(daysAgo(1)), label: 'kemarin' };
    if (r === '7d') return { from: daysAgo(6), to: endOfDay(new Date()), label: '7 hari terakhir' };
    return { from: startOfDay(new Date()), to: endOfDay(new Date()), label: 'hari ini' };
  },
  renderFilters(el) {
    const s = this.st;
    const sel = (key, label, opts) => '<label class="chip' + (s[key] ? ' soft-on' : '') + '" style="position:relative;padding-right:30px">' + esc(label) + ': ' + esc((opts.find((o) => o[0] === s[key]) || opts[0])[1]) + icon('chevron-down', 'xs') +
      '<select data-f="' + key + '" style="position:absolute;inset:0;opacity:0;width:100%">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === s[key] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
    const ranges = App.isOwner ? [['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['7d', '7 Hari']] : [['today', 'Hari ini']];
    const kasirOpts = [['', 'Semua']].concat((App.boot.users || []).map((u) => [u.nama, u.nama]));
    $('.js-filters', el).innerHTML = ranges.map((r) => '<button class="chip' + (s.range === r[0] ? ' on' : '') + '" data-act="range" data-r="' + r[0] + '" type="button">' + r[1] + '</button>').join('') +
      (App.isOwner ? sel('kasir', 'Kasir', kasirOpts) : '') +
      sel('metode', 'Metode', [['', 'Semua'], ['TUNAI', 'Tunai'], ['QRIS', 'QRIS'], ['TRANSFER', 'Transfer'], ['UTANG', 'Utang']]) +
      sel('status', 'Status', [['', 'Semua'], ['SELESAI', 'Selesai'], ['DIBATALKAN', 'Dibatalkan'], ['PENDING', 'Menunggu sinkron'], ['BELUM', 'Belum lunas']]);
    $$('select[data-f]', el).forEach((x) => x.addEventListener('change', () => { this.st[x.dataset.f] = x.value; this.renderFilters(el); this.render(el); }));
  },
  async loadLocal(el) {
    const r = this.range();
    this.local = (await DB.all('tx')).filter((t) => { const w = new Date(t.waktu); return w >= r.from && w <= r.to; }).map(normalizeTx);
    this.render(el);
  },
  async load(el) {
    const r = this.range();
    $('.js-list-title', el).textContent = 'Daftar nota ' + r.label;
    await this.loadLocal(el);
    swr('tx:' + this.st.range + ':' + ymd(new Date()), 'getTransactions', { from: r.from.toISOString(), to: r.to.toISOString() }, (d, cached) => {
      this.server = (d.list || []).map(normalizeTx);
      if (!cached) this.prune(el);
      this.render(el);
    },
      { fresh: 20000, onError: (e) => { if (!this.local.length) $('.js-list', el).innerHTML = retryBox(e.error); } });
  },
  /** Hapus salinan lokal transaksi yang sudah tersinkron tapi tidak ada lagi di server (dihapus permanen oleh pemilik). */
  async prune(el) {
    const ids = new Set(this.server.map((t) => t.transaksi_id)), old = Date.now() - 5 * 60e3;
    const gone = this.local.filter((t) => t._sync === 'OK' && t._cancelSync !== 'PENDING' && !ids.has(t.transaksi_id) && new Date(t.waktu).getTime() < old && (App.isOwner || t.kasir_id === App.user.user_id));
    if (!gone.length) return;
    for (const t of gone) await DB.del('tx', t.transaksi_id).catch(() => {});
    this.local = this.local.filter((t) => gone.indexOf(t) < 0);
    this.render(el);
  },
  merged() {
    const map = new Map();
    this.server.forEach((t) => map.set(t.transaksi_id, t));
    this.local.forEach((t) => {
      const s = map.get(t.transaksi_id);
      if (!s || t._sync === 'PENDING' || t._sync === 'REJECT' || t._cancelSync === 'PENDING' || (t.status === 'DIBATALKAN' && s.status !== 'DIBATALKAN')) map.set(t.transaksi_id, Object.assign({}, s || {}, t));
      else if (s && t._hasProof && !s.bukti_file_id) map.set(t.transaksi_id, Object.assign({}, s, { _hasProof: true }));
    });
    return Array.from(map.values()).sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
  },
  filtered() {
    const s = this.st;
    return this.merged().filter((t) => {
      if (!App.isOwner && t.kasir_id && t.kasir_id !== App.user.user_id) return false;
      if (s.q && String(t.no_nota).toLowerCase().indexOf(s.q) < 0 && String(t.pelanggan_nama || '').toLowerCase().indexOf(s.q) < 0) return false;
      if (s.kasir && t.kasir_nama !== s.kasir) return false;
      if (s.metode && t.metode_bayar !== s.metode) return false;
      if (s.status === 'PENDING' && t._sync !== 'PENDING' && t._cancelSync !== 'PENDING') return false;
      if (s.status === 'BELUM' && !(t.metode_bayar === 'UTANG' && t.status_bayar !== 'LUNAS' && t.status !== 'DIBATALKAN')) return false;
      if ((s.status === 'SELESAI' || s.status === 'DIBATALKAN') && t.status !== s.status) return false;
      return true;
    });
  },
  render(el) {
    const list = this.filtered();
    const okT = list.filter((t) => t.status !== 'DIBATALKAN');
    $('.js-stats', el).innerHTML = '<div class="stat"><div class="k">Transaksi</div><div class="v">' + okT.length + ' <span style="font-size:12px;color:var(--ok)">nota</span></div></div>' +
      '<div class="stat"><div class="k">Omzet</div><div class="v" style="color:var(--p)">' + rp(okT.reduce((s, t) => s + toNum(t.total), 0)) + '</div></div>' +
      '<div class="stat bad"><div class="k">Batal</div><div class="v">' + (list.length - okT.length) + ' <span style="font-size:12px">nota</span></div></div>';
    $('.js-list', el).innerHTML = list.length ? list.map(txCardHtml).join('') : emptyState('receipt', 'Belum ada transaksi', 'Transaksi ' + this.range().label + ' akan muncul di sini.');
  },
  actions: {
    range(a, e, el) { this.st.range = a.dataset.r; this.renderFilters(el); this.load(el); },
    open(a) { const t = this.merged().find((x) => x.transaksi_id === a.dataset.id); if (t) openTxDetail(t); },
    retry(a, e, el) { this.load(el); }
  }
});
function txCardHtml(t) {
  const voidT = t.status === 'DIBATALKAN';
  const pend = t._sync === 'PENDING' || t._cancelSync === 'PENDING';
  return '<button class="tx-card' + (voidT ? ' void' : '') + '" data-act="open" data-id="' + esc(t.transaksi_id) + '" type="button">' +
    '<div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="no ellipsis">' + esc(t.no_nota) + '</div><div class="meta">' + fmtTime(t.waktu) + ' · ' + esc(t.kasir_nama || '-') + '</div></div>' +
    '<div class="row" style="gap:6px"><span class="amt">' + rp(t.total) + '</span>' + icon('chevron-right', 'sm faint') + '</div></div>' +
    (voidT ? '<div class="row" style="margin-top:8px"><span class="pill bad sm">DIBATALKAN</span>' + (pend ? '<span class="pill warn sm">' + icon('clock', 'xs') + 'Menunggu sinkron</span>' : '') + '</div><div class="why"><b>Alasan:</b> ' + esc(t.alasan_batal || '-') + ' · oleh ' + esc(t.dibatalkan_oleh || '-') + (t.waktu_batal ? ' ' + fmtTime(t.waktu_batal) : '') + '</div>'
      : '<div class="foot">' + methodPill(t.metode_bayar) +
      (t.metode_bayar === 'UTANG' ? '<span class="muted" style="font-size:12.5px"><b>' + esc(t.pelanggan_nama || '') + '</b> · ' + (t.status_bayar === 'LUNAS' ? '<span style="color:var(--ok)">Lunas</span>' : '<span style="color:var(--bad)">Belum lunas</span>') + '</span>' : '') +
      (t.bukti_file_id || t._hasProof ? '<span class="pill neutral sm">' + icon('image', 'xs') + 'Bukti</span>' : '') +
      (t.flag_stok === 'MINUS' && App.isOwner ? '<span class="pill bad sm">Stok minus</span>' : '') +
      '<span style="margin-left:auto"></span>' + (t._sync === 'REJECT' ? '<span class="pill bad sm">' + icon('alert', 'xs') + 'Ditolak</span>' : pend ? '<span class="pill warn sm">' + icon('clock', 'xs') + 'Menunggu sinkron</span>' : '') + '</div>') +
    '</button>';
}
function openTxDetail(t) {
  const canCancel = t.status !== 'DIBATALKAN' && (App.isOwner || t.kasir_id === App.user.user_id || t._local);
  const s = sheet({
    title: t.no_nota,
    body: (t.status === 'DIBATALKAN' ? '<div class="banner bad" style="margin-bottom:12px">' + icon('alert', 'sm') + '<div><b>Dibatalkan</b> oleh ' + esc(t.dibatalkan_oleh || '-') + (t.waktu_batal ? ' · ' + fmtDT(t.waktu_batal) : '') + '<br>Alasan: ' + esc(t.alasan_batal || '-') + '</div></div>' : '') +
      (t._sync === 'REJECT' ? '<div class="banner bad" style="margin-bottom:12px">' + icon('alert', 'sm') + '<div>Ditolak server: ' + esc(t._msg || '') + '</div></div>' : '') +
      (t.flag_stok === 'MINUS' && App.isOwner ? '<div class="banner warn" style="margin-bottom:12px">' + icon('alert', 'sm') + '<div>Stok minus — perlu dicek (transaksi offline dari beberapa kasir).</div></div>' : '') +
      Receipt.html(t) + '<div style="height:18px"></div>' +
      '<div class="js-proof"></div>' +
      (App.isOwner && t.total_hpp ? '<div class="card pad" style="margin-top:12px"><div class="sum-row"><span class="muted">HPP</span><span class="v">' + rp(t.total_hpp) + '</span></div><div class="sum-row"><span class="muted">Laba kotor</span><span class="v" style="color:var(--ok)">' + rp(toNum(t.total) - toNum(t.total_hpp)) + '</span></div></div>' : ''),
    foot: '<div class="row" style="gap:8px"><button class="btn outline sm grow" data-a="print" type="button">' + icon('printer', 'sm') + 'Cetak</button><button class="btn outline sm grow" data-a="wa" type="button">' + icon('whatsapp', 'sm') + 'WA</button><button class="btn outline sm grow" data-a="img" type="button">' + icon('image', 'sm') + 'Gambar</button><button class="btn outline sm grow" data-a="pdf" type="button">' + icon('file', 'sm') + 'PDF</button></div>' +
      (canCancel ? '<button class="btn danger block" data-a="cancel" type="button" style="margin-top:8px">' + icon('x', 'sm') + 'Batalkan Transaksi</button>' : '') +
      (App.isOwner && t.status === 'DIBATALKAN' ? (t._sync === 'PENDING' || t._sync === 'REJECT' || t._cancelSync === 'PENDING'
        ? '<div class="help" style="justify-content:center;margin-top:8px">' + icon('clock', 'xs') + 'Hapus permanen tersedia setelah transaksi & pembatalannya tersinkron.</div>'
        : '<button class="btn outline block sm" data-a="delete" type="button" style="margin-top:8px;color:var(--bad)">' + icon('trash', 'sm') + 'Hapus Permanen</button>') : '')
  });
  const proofBox = $('.js-proof', s.el);
  (async () => {
    const lp = await DB.get('proofs', t.transaksi_id);
    if (lp) { proofBox.innerHTML = '<div class="card pad"><b>Bukti bayar</b> <span class="pill warn sm">Belum terunggah</span><img src="' + lp.dataUrl + '" style="margin-top:10px;border-radius:10px" alt=""></div>'; return; }
    if (t.bukti_file_id) proofBox.innerHTML = '<button class="btn outline block" data-a="proof" type="button">' + icon('image', 'sm') + 'Lihat Bukti Bayar</button>';
  })();
  s.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'print') Printer.printTx(t);
    else if (a === 'wa') Receipt.sendWA(t, t.pelanggan_id ? ((App.boot.customers || []).find((c) => c.pelanggan_id === t.pelanggan_id) || {}).no_hp : '');
    else if (a === 'img') runExport(b, () => Receipt.saveImage(t));
    else if (a === 'pdf') runExport(b, () => Receipt.savePdf(t));
    else if (a === 'proof') {
      busy(b, true); const r = await api('getProof', { file_id: t.bukti_file_id }); busy(b, false);
      if (r.ok) proofBox.innerHTML = '<img src="' + r.data.dataUrl + '" style="border-radius:12px" alt="Bukti bayar">'; else toast(r.error, 'bad');
    } else if (a === 'cancel') { if (await cancelTx(t)) s.close(); }
    else if (a === 'delete') {
      if (!(await confirmDlg({ title: 'Hapus permanen?', msg: 'Transaksi ' + t.no_nota + ' akan dihapus dari database dan tidak bisa dikembalikan.', okText: 'Hapus', danger: true }))) return;
      if (!navigator.onLine) { toast('Hapus permanen butuh koneksi internet.', 'warn'); return; }
      busy(b, true); const r = await api('deleteTransaction', { transaksi_id: t.transaksi_id }); busy(b, false);
      if (r.ok) { s.close(); await forgetTx(t.transaksi_id); toast('Transaksi ' + t.no_nota + ' dihapus permanen', 'ok'); }
      else toast(r.error, 'bad');
    }
  });
}
/** Bersihkan transaksi dari perangkat ini: salinan lokal, bukti, cache daftar/dashboard/laporan. */
async function forgetTx(id) {
  await DB.del('tx', id).catch(() => {}); await DB.del('proofs', id).catch(() => {});
  const pre = LS_PREFIX + userKey('');
  Object.keys(localStorage).filter((k) => k.indexOf(pre) === 0 && /:(tx|dash|rep):/.test(':' + k.slice(pre.length))).forEach((k) => localStorage.removeItem(k));
  const pg = Pages.transaksi, el = $('.page[data-page="transaksi"]');
  pg.server = pg.server.filter((x) => x.transaksi_id !== id); pg.local = pg.local.filter((x) => x.transaksi_id !== id);
  if (el) { pg.render(el); if (App.current === 'transaksi') pg.load(el); }
}
async function cancelTx(t) {
  const localRec = await DB.get('tx', t.transaksi_id);
  if (!navigator.onLine && !localRec) { toast('Membatalkan transaksi dari perangkat lain butuh koneksi internet.', 'warn'); return false; }
  if (!App.isOwner && t.kasir_id && t.kasir_id !== App.user.user_id) { toast('Kasir hanya bisa membatalkan transaksinya sendiri.', 'warn'); return false; }
  const reason = await promptDlg({ title: 'Batalkan ' + t.no_nota + '?', msg: 'Alasan wajib diisi dan tercatat untuk pemilik toko. Stok dikembalikan otomatis.', placeholder: 'Alasan pembatalan', chips: ['Salah input menu', 'Pelanggan batal', 'Pembayaran gagal', 'Transaksi dobel'], okText: 'Batalkan Transaksi', danger: true });
  if (!reason) return false;
  const rec = Object.assign({}, localRec || t, { status: 'DIBATALKAN', alasan_batal: reason, dibatalkan_oleh: App.user.nama, waktu_batal: new Date().toISOString(), _cancelSync: 'PENDING' });
  if (!localRec) rec._fromServer = true;
  await Sync.enqueue('cancel', { transaksi_id: t.transaksi_id, alasan: reason, waktu: rec.waktu_batal, _items: t.items }, { id: 'cx_' + t.transaksi_id, tx: rec });
  toast('Transaksi dibatalkan', 'ok');
  if (App.current === 'transaksi') Pages.transaksi.loadLocal($('.page[data-page="transaksi"]'));
  return true;
}

/* ================================================================= STOK */
function stockStatus(stok, min) { stok = toNum(stok); min = toNum(min); return stok <= 0 ? ['bad', 'Habis'] : stok <= min ? ['warn', 'Menipis'] : ['ok', 'Aman']; }
page('stok', {
  keepScroll: true,
  st: { tab: 'produk', q: '' },
  template() {
    return topbar({ title: 'Stok', sub: 'Stok masuk, stok menipis & koreksi', right: syncPill() }) +
      '<div class="wrap" style="padding-top:14px"><div class="seg light js-tabs"></div>' +
      '<div class="row" style="margin-top:12px"><div class="input-wrap grow">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari item stok" autocomplete="off"></div><button class="btn primary" data-act="stock-in" type="button">' + icon('plus', 'sm') + 'Stok Masuk</button></div>' +
      '<div class="js-body" style="margin-top:14px"></div></div>';
  },
  init(el) {
    $('.js-q', el).addEventListener('input', debounce((e) => { this.st.q = e.target.value.trim().toLowerCase(); this.render(el); }, 120));
    on('boot', () => { if (App.current === 'stok') this.render(el); });
    on('synced', () => { if (App.current === 'stok') this.render(el); });
  },
  show(el) { this.render(el); },
  render(el) {
    const tabs = [['produk', 'Produk Jadi'], ['bahan', 'Bahan Baku']].concat(App.isOwner ? [['mutasi', 'Riwayat']] : []);
    $('.js-tabs', el).innerHTML = tabs.map((t) => '<button class="' + (this.st.tab === t[0] ? 'on' : '') + '" data-act="tab" data-t="' + t[0] + '" type="button">' + t[1] + '</button>').join('');
    const q = this.st.q, body = $('.js-body', el), batas = toNum(App.settings.batas_stok_menipis) || 5;
    if (this.st.tab === 'produk') {
      const list = (App.boot.products || []).filter((p) => p.tipe_stok === 'STOK_JADI' && (!q || p.nama.toLowerCase().indexOf(q) > -1))
        .sort((a, b) => toNum(a.stok) - toNum(b.stok));
      body.innerHTML = (list.length ? '<div class="card" style="padding:0 16px">' + list.map((p) => {
        const min = toNum(p.stok_minimum) || batas, s = stockStatus(p.stok, min);
        return '<div class="list-item"><div class="thumb">' + productImg(p) + '</div><div class="grow"><div class="t ellipsis">' + esc(p.nama) + '</div><div class="s">Min. ' + fmtNum(min) + ' ' + esc(p.satuan || 'pcs') + '</div></div>' +
          '<div style="text-align:right"><div class="num" style="font-weight:800;font-size:17px">' + fmtNum(p.stok) + '</div><span class="pill ' + s[0] + ' sm">' + s[1] + '</span></div>' +
          '<div class="row" style="gap:6px"><button class="icon-btn soft" data-act="stock-in" data-o="PRODUK" data-id="' + esc(p.produk_id) + '" type="button" aria-label="Stok masuk">' + icon('plus', 'sm') + '</button>' +
          (App.isOwner ? '<button class="icon-btn ghost-border" data-act="adjust" data-o="PRODUK" data-id="' + esc(p.produk_id) + '" type="button" aria-label="Koreksi">' + icon('pencil', 'sm') + '</button>' : '') + '</div></div>';
      }).join('') + '</div>' : emptyState('package', 'Tidak ada produk stok jadi', 'Produk racik (minuman) memakai stok bahan baku.')) +
        '<div class="help" style="margin-top:12px">' + icon('info', 'xs') + 'Produk "racik" (minuman, menu racikan) mengurangi stok bahan baku sesuai resep secara otomatis.</div>';
    } else if (this.st.tab === 'bahan') {
      const list = (App.boot.materials || []).filter((m) => !q || m.nama.toLowerCase().indexOf(q) > -1).sort((a, b) => toNum(a.stok) / Math.max(1, toNum(a.stok_minimum)) - toNum(b.stok) / Math.max(1, toNum(b.stok_minimum)));
      body.innerHTML = list.length ? '<div class="card" style="padding:0 16px">' + list.map((m) => {
        const s = stockStatus(m.stok, m.stok_minimum), kem = toNum(m.isi_per_kemasan) ? toNum(m.stok) / toNum(m.isi_per_kemasan) : 0;
        return '<div class="list-item"><span class="ico-box ' + (m.jenis === 'KEMASAN' ? 'info' : '') + '">' + icon(m.jenis === 'KEMASAN' ? 'package' : 'coffee', 'sm') + '</span><div class="grow"><div class="t ellipsis">' + esc(m.nama) + '</div><div class="s">≈ ' + fmtNum(kem) + ' ' + esc(m.satuan_beli) + ' · min ' + fmtNum(m.stok_minimum) + ' ' + esc(m.satuan_pakai) + '</div></div>' +
          '<div style="text-align:right"><div class="num" style="font-weight:800">' + fmtNum(m.stok) + ' <span class="muted" style="font-size:12px;font-weight:600">' + esc(m.satuan_pakai) + '</span></div><span class="pill ' + s[0] + ' sm">' + s[1] + '</span></div>' +
          '<div class="row" style="gap:6px"><button class="icon-btn soft" data-act="stock-in" data-o="BAHAN" data-id="' + esc(m.bahan_id) + '" type="button" aria-label="Stok masuk">' + icon('plus', 'sm') + '</button>' +
          (App.isOwner ? '<button class="icon-btn ghost-border" data-act="adjust" data-o="BAHAN" data-id="' + esc(m.bahan_id) + '" type="button" aria-label="Koreksi">' + icon('pencil', 'sm') + '</button>' : '') + '</div></div>';
      }).join('') + '</div>' : emptyState('coffee', 'Belum ada bahan baku', App.isOwner ? 'Tambahkan di menu Bahan & Biaya.' : '');
    } else {
      body.innerHTML = skeletonList(5, 60);
      swr('mut:7d', 'getMutations', { from: daysAgo(6).toISOString() }, (d) => {
        const list = (d.list || []).filter((m) => !q || String(m.nama).toLowerCase().indexOf(q) > -1);
        const jl = { MASUK: ['ok', 'Masuk'], KELUAR_JUAL: ['neutral', 'Terjual'], BATAL: ['info', 'Batal'], KOREKSI: ['warn', 'Koreksi'] };
        body.innerHTML = list.length ? '<div class="card" style="padding:0 16px">' + list.map((m) => '<div class="list-item"><div class="grow"><div class="t ellipsis">' + esc(m.nama) + '</div><div class="s">' + fmtDT(m.waktu) + ' · ' + esc(m.user_nama || '') + (m.keterangan ? ' · ' + esc(m.keterangan) : '') + '</div></div>' +
          '<div style="text-align:right"><span class="pill ' + (jl[m.jenis] || ['neutral'])[0] + ' sm">' + esc((jl[m.jenis] || [0, m.jenis])[1]) + '</span><div class="num" style="font-weight:800;color:' + (toNum(m.qty) < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + (toNum(m.qty) > 0 ? '+' : '') + fmtNum(m.qty) + '</div></div></div>').join('') + '</div>' : emptyState('history', 'Belum ada mutasi', '7 hari terakhir');
      }, { fresh: 30000, onError: (e) => { body.innerHTML = retryBox(e.error); } });
    }
  },
  actions: {
    tab(a, e, el) { this.st.tab = a.dataset.t; this.render(el); },
    'stock-in'(a) { openStockIn(a.dataset.o || (this.st.tab === 'bahan' ? 'BAHAN' : 'PRODUK'), a.dataset.id); },
    adjust(a, e, el) { openAdjust(a.dataset.o, a.dataset.id, () => this.render(el)); },
    retry(a, e, el) { this.render(el); }
  }
});
function openStockIn(objek, id) {
  let o = objek || 'PRODUK';
  const s = sheet({
    title: 'Stok Masuk',
    body: '<div class="seg light" id="siO"><button type="button" data-o="PRODUK">Produk Jadi</button><button type="button" data-o="BAHAN">Bahan Baku</button></div>' +
      '<label class="field" style="margin-top:14px"><span class="lbl">Item <span class="req">*</span></span><select class="select" id="siItem"></select></label>' +
      '<div id="siQtyBox"></div>' +
      '<label class="field"><span class="lbl">Keterangan</span><input class="input" id="siKet" placeholder="contoh: hasil produksi pagi, belanja pasar"></label>',
    foot: '<button class="btn primary block lg" id="siSave" type="button">' + icon('check', 'sm') + 'Simpan Stok Masuk</button>'
  });
  const paint = () => {
    $$('#siO button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.o === o));
    const list = o === 'PRODUK' ? (App.boot.products || []).filter((p) => p.tipe_stok === 'STOK_JADI').map((p) => [p.produk_id, p.nama + ' (stok ' + fmtNum(p.stok) + ')'])
      : (App.boot.materials || []).map((m) => [m.bahan_id, m.nama + ' (stok ' + fmtNum(m.stok) + ' ' + m.satuan_pakai + ')']);
    $('#siItem', s.el).innerHTML = list.map((x) => '<option value="' + esc(x[0]) + '"' + (x[0] === id ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('');
    paintQty();
  };
  const paintQty = () => {
    const box = $('#siQtyBox', s.el);
    if (o === 'PRODUK') { box.innerHTML = '<label class="field"><span class="lbl">Jumlah masuk <span class="req">*</span></span><input class="input big" id="siQty" inputmode="decimal" placeholder="0"></label>'; return; }
    const m = (App.boot.materials || []).find((x) => x.bahan_id === $('#siItem', s.el).value) || {};
    box.innerHTML = '<div class="grid-2"><label class="field"><span class="lbl">Jumlah ' + esc(m.satuan_beli || 'kemasan') + ' <span class="req">*</span></span><input class="input big" id="siQty" inputmode="decimal" placeholder="0"></label>' +
      '<label class="field" style="margin-top:0"><span class="lbl">Harga / ' + esc(m.satuan_beli || 'kemasan') + '</span>' + moneyInput('id="siHarga" placeholder="opsional"', '') + '</label></div>' +
      '<div class="help">' + icon('info', 'xs') + '1 ' + esc(m.satuan_beli || 'kemasan') + ' = ' + fmtNum(m.isi_per_kemasan) + ' ' + esc(m.satuan_pakai || '') + '. Harga diisi bila berubah (HPP ikut diperbarui).</div>';
  };
  $('#siO', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { o = b.dataset.o; id = ''; paint(); } };
  $('#siItem', s.el).onchange = () => { id = $('#siItem', s.el).value; if (o === 'BAHAN') paintQty(); };
  $('#siSave', s.el).onclick = async () => {
    const itemId = $('#siItem', s.el).value, q = toNum(String($('#siQty', s.el).value).replace(',', '.'));
    if (!itemId || !(q > 0)) { toast('Pilih item dan isi jumlah', 'bad'); return; }
    let qty = q, harga = 0, ket = $('#siKet', s.el).value.trim();
    if (o === 'BAHAN') { const m = (App.boot.materials || []).find((x) => x.bahan_id === itemId); qty = Math.round(q * toNum(m.isi_per_kemasan) * 100) / 100; harga = parseMoney(($('#siHarga', s.el) || {}).value); ket = (ket ? ket + ' · ' : '') + fmtNum(q) + ' ' + m.satuan_beli; }
    await Sync.enqueue('stockIn', { mutasi_id: shortId('MI'), objek: o, objek_id: itemId, qty, harga_beli: harga, keterangan: ket, waktu: new Date().toISOString() });
    s.close(); toast('Stok masuk dicatat', 'ok'); emit('boot');
  };
  paint();
  setTimeout(() => { const q = $('#siQty', s.el); if (q && id) q.focus(); }, 80);
}
function openAdjust(objek, id, done) {
  const isB = objek === 'BAHAN';
  const item = isB ? (App.boot.materials || []).find((m) => m.bahan_id === id) : Local.product(id);
  if (!item) return;
  const s = sheet({
    title: 'Koreksi Stok (Stok Opname)',
    body: '<div class="card pad" style="background:var(--bg)"><b>' + esc(item.nama) + '</b><div class="muted">Stok di sistem: <b class="num">' + fmtNum(item.stok) + '</b> ' + esc(isB ? item.satuan_pakai : item.satuan || 'pcs') + '</div></div>' +
      '<label class="field" style="margin-top:14px"><span class="lbl">Stok fisik sebenarnya <span class="req">*</span></span><input class="input big" id="adV" inputmode="decimal" value="' + esc(item.stok) + '"></label>' +
      '<label class="field"><span class="lbl">Keterangan</span><input class="input" id="adK" placeholder="contoh: hitung ulang akhir hari, rusak"></label><div class="help" id="adDiff"></div>',
    foot: '<button class="btn primary block lg" id="adSave" type="button">Simpan Koreksi</button>'
  });
  const diff = () => { const d = toNum($('#adV', s.el).value.replace(',', '.')) - toNum(item.stok); $('#adDiff', s.el).innerHTML = icon('info', 'xs') + 'Selisih: <b style="color:' + (d < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + (d > 0 ? '+' : '') + fmtNum(d) + '</b>'; };
  $('#adV', s.el).addEventListener('input', diff); diff();
  $('#adSave', s.el).onclick = async (e) => {
    if (!navigator.onLine) { toast('Koreksi stok butuh internet', 'warn'); return; }
    const v = toNum($('#adV', s.el).value.replace(',', '.'));
    busy(e.currentTarget, true);
    const r = await api('stockAdjust', { objek, objek_id: id, stok_fisik: v, keterangan: $('#adK', s.el).value.trim() });
    busy(e.currentTarget, false);
    if (!r.ok) { toast(r.error, 'bad'); return; }
    item.stok = v; Boot.persist(); s.close(); toast('Stok dikoreksi (selisih ' + fmtNum(r.data.selisih) + ')', 'ok'); done && done(); Boot.refresh();
  };
}

/* ================================================================= UTANG */
page('utang', {
  keepScroll: true,
  st: { q: '', all: false },
  template() {
    return topbar({ title: 'Utang Pelanggan', sub: 'Catat pelunasan & tagih via WhatsApp', right: syncPill() }) +
      '<div class="wrap" style="padding-top:14px"><div class="js-sum"></div>' +
      '<div class="row" style="margin-top:12px"><div class="input-wrap grow">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari pelanggan" autocomplete="off"></div><button class="btn outline" data-act="add" type="button">' + icon('plus', 'sm') + 'Pelanggan</button></div>' +
      '<div class="chips" style="margin-top:10px"><button class="chip js-f0" data-act="f" data-all="0" type="button">Ada utang</button><button class="chip js-f1" data-act="f" data-all="1" type="button">Semua pelanggan</button></div>' +
      '<div class="js-list" style="margin-top:12px"></div></div>';
  },
  init(el) {
    $('.js-q', el).addEventListener('input', debounce((e) => { this.st.q = e.target.value.trim().toLowerCase(); this.render(el); }, 120));
    on('boot', () => { if (App.current === 'utang') this.render(el); });
  },
  show(el) { this.render(el); },
  render(el) {
    const due = toNum(App.settings.jatuh_tempo_hari) || 7;
    const all = (App.boot.customers || []);
    const total = all.reduce((s, c) => s + toNum(c.sisa_utang), 0), n = all.filter((c) => toNum(c.sisa_utang) > 0).length;
    $('.js-sum', el).innerHTML = '<div class="grid-2"><div class="mini"><span class="ico-box warn">' + icon('notebook', 'sm') + '</span><div class="k">Total piutang</div><div class="v" style="color:var(--warn)">' + rp(total) + '</div></div>' +
      '<div class="mini"><span class="ico-box">' + icon('users', 'sm') + '</span><div class="k">Pelanggan berutang</div><div class="v">' + n + '</div></div></div>';
    $('.js-f0', el).classList.toggle('on', !this.st.all); $('.js-f1', el).classList.toggle('on', this.st.all);
    const list = all.filter((c) => (this.st.all || toNum(c.sisa_utang) > 0) && (!this.st.q || c.nama.toLowerCase().indexOf(this.st.q) > -1 || String(c.no_hp).indexOf(this.st.q) > -1))
      .sort((a, b) => toNum(b.sisa_utang) - toNum(a.sisa_utang) || a.nama.localeCompare(b.nama));
    $('.js-list', el).innerHTML = list.length ? '<div class="card" style="padding:0 16px">' + list.map((c) => {
      const umur = c.utang_sejak ? Math.floor((Date.now() - new Date(c.utang_sejak).getTime()) / 864e5) : 0;
      return '<button class="list-item" data-act="open" data-id="' + esc(c.pelanggan_id) + '" type="button"><div class="thumb">' + esc(initials(c.nama)) + '</div><div class="grow"><div class="t ellipsis">' + esc(c.nama) + '</div><div class="s">' + esc(c.no_hp || 'Tanpa no. HP') + (toNum(c.sisa_utang) ? ' · ' + toNum(c.nota_utang) + ' nota · ' + umur + ' hari' : '') + '</div></div>' +
        (toNum(c.sisa_utang) ? '<div style="text-align:right"><div class="num" style="font-weight:800">' + rp(c.sisa_utang) + '</div>' + (umur >= due ? '<span class="pill bad sm">Jatuh tempo</span>' : '<span class="pill warn sm">Belum lunas</span>') + '</div>' : '<span class="pill ok sm">Lunas</span>') + icon('chevron-right', 'sm faint') + '</button>';
    }).join('') + '</div>' : emptyState('notebook', this.st.all ? 'Belum ada pelanggan' : 'Tidak ada utang', this.st.all ? 'Pelanggan ditambahkan saat transaksi utang.' : 'Semua pelanggan sudah lunas.');
  },
  actions: {
    f(a, e, el) { this.st.all = a.dataset.all === '1'; this.render(el); },
    open(a) { const c = (App.boot.customers || []).find((x) => x.pelanggan_id === a.dataset.id); if (c) openDebtDetail(c); },
    add(a, e, el) { pickCustomer(() => { this.st.all = true; this.render(el); }); }
  }
});
function debtWaText(c, notas) {
  const st = App.settings;
  let t = 'Halo ' + c.nama + ', ini pengingat dari *' + (st.nama_toko || 'toko kami') + '*.\nTotal utang Anda saat ini *' + rp(c.sisa_utang) + '*.';
  if (notas && notas.length) t += '\n\nRincian:\n' + notas.map((n) => '• ' + n.no_nota + ' (' + fmtDate(n.waktu) + ') sisa ' + rp(n.sisa)).join('\n');
  return t + '\n\nTerima kasih 🙏';
}
function openDebtDetail(c) {
  let notas = null;
  const s = sheet({
    headHtml: '<div class="thumb">' + esc(initials(c.nama)) + '</div><div class="grow"><h3 class="ellipsis">' + esc(c.nama) + '</h3><div class="muted" style="font-size:13px">' + esc(c.no_hp || 'Tanpa no. HP') + '</div></div>',
    body: '<div class="hero" style="padding:16px"><div class="k">SISA UTANG</div><div class="v">' + rp(c.sisa_utang) + '</div>' + (c.utang_sejak ? '<div style="font-size:12.5px;opacity:.9;margin-top:2px">Sejak ' + fmtDateLong(c.utang_sejak) + '</div>' : '') + '</div>' +
      '<div class="label-row"><span class="sec-title">Rincian nota</span></div><div class="js-notas">' + (navigator.onLine ? skeletonList(2, 56) : '<div class="muted">Rincian nota butuh internet. Pelunasan tetap bisa dicatat.</div>') + '</div>',
    foot: '<div class="grid-2"><button class="btn success" data-a="wa" type="button"' + (c.no_hp ? '' : ' disabled') + '>' + icon('whatsapp', 'sm') + 'Tagih via WA</button><button class="btn primary" data-a="pay" type="button"' + (toNum(c.sisa_utang) > 0 ? '' : ' disabled') + '>' + icon('wallet', 'sm') + 'Catat Bayar</button></div>'
  });
  if (navigator.onLine) api('getDebts', { pelanggan_id: c.pelanggan_id }).then((r) => {
    const box = $('.js-notas', s.el); if (!box) return;
    if (!r.ok) { box.innerHTML = '<div class="muted">' + esc(r.error) + '</div>'; return; }
    notas = r.data.list.filter((n) => n.pelanggan_id === c.pelanggan_id);
    box.innerHTML = notas.length ? '<div class="card" style="padding:0 14px">' + notas.map((n) => '<div class="list-item"><div class="grow"><div class="t mono" style="font-size:13.5px">' + esc(n.no_nota) + '</div><div class="s">' + fmtDate(n.waktu) + ' · ' + n.umur_hari + ' hari · total ' + rp(n.total) + (toNum(n.terbayar) ? ' · dibayar ' + rp(n.terbayar) : '') + '</div>' +
      ((r.data.payments[n.transaksi_id] || []).map((p) => '<div class="s" style="color:var(--ok)">✓ ' + fmtDate(p.waktu) + ' ' + rp(p.nominal) + ' (' + esc(METODE_LABEL[p.metode] || p.metode) + ')</div>').join('')) + '</div><div style="text-align:right"><div class="num" style="font-weight:800">' + rp(n.sisa) + '</div><span class="pill ' + (n.status === 'SEBAGIAN' ? 'info' : 'warn') + ' sm">' + (n.status === 'SEBAGIAN' ? 'Sebagian' : 'Belum') + '</span></div></div>').join('') + '</div>' : '<div class="muted">Tidak ada nota terbuka di server (mungkin masih menunggu sinkron).</div>';
  });
  s.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'wa') window.open('https://wa.me/' + waNumber(c.no_hp) + '?text=' + encodeURIComponent(debtWaText(c, notas)), '_blank');
    if (b.dataset.a === 'pay') { s.close(); openPayDebt(c); }
  });
}
function openPayDebt(c) {
  let metode = 'TUNAI', proof = null;
  const s = sheet({
    title: 'Catat Pembayaran Utang',
    body: '<div class="card pad" style="background:var(--bg)"><div class="row between"><b>' + esc(c.nama) + '</b><span class="num" style="font-weight:800;color:var(--warn)">' + rp(c.sisa_utang) + '</span></div></div>' +
      '<label class="field" style="margin-top:14px"><span class="lbl">Nominal dibayar <span class="req">*</span></span>' + moneyInput('id="pdN" class="input big money"', '') + '</label>' +
      '<div class="chips wrap" style="margin-top:10px"><button class="chip" data-v="' + toNum(c.sisa_utang) + '" type="button">Lunas semua</button>' + [0.5, 0.25].map((f) => '<button class="chip" data-v="' + Math.round(toNum(c.sisa_utang) * f / 500) * 500 + '" type="button">' + (f * 100) + '%</button>').join('') + '</div>' +
      '<div class="field" style="margin-top:16px"><span class="lbl">Metode</span><div class="seg light" id="pdM"><button data-m="TUNAI" type="button">Tunai</button><button data-m="QRIS" type="button">QRIS</button><button data-m="TRANSFER" type="button">Transfer</button></div></div>' +
      '<div id="pdProof"></div><div class="help">' + icon('info', 'xs') + 'Pembayaran dialokasikan ke nota terlama lebih dulu. Bisa dicicil.</div>',
    foot: '<button class="btn primary block lg" id="pdSave" type="button">' + icon('check', 'sm') + 'Simpan Pembayaran</button>'
  });
  const n = $('#pdN', s.el); n.className = 'input big money';
  const paint = () => {
    $$('#pdM button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.m === metode));
    $('#pdProof', s.el).innerHTML = metode === 'TUNAI' ? '' : '<div class="proof-box">' + (proof ? '<img src="' + proof + '" alt=""><div class="pill ok sm" style="margin-bottom:8px">' + dataUrlKB(proof) + ' KB</div>' : '<div class="muted" style="font-size:13px;margin-bottom:8px">Foto bukti (opsional)</div>') + '<div class="grid-2"><button class="btn outline sm" data-cap="1" type="button">' + icon('camera', 'sm') + 'Kamera</button><button class="btn outline sm" data-cap="0" type="button">' + icon('image', 'sm') + 'Galeri</button></div></div>';
  };
  s.el.addEventListener('click', async (e) => {
    const v = e.target.closest('[data-v]'); if (v) { n.value = NF.format(v.dataset.v); return; }
    const m = e.target.closest('[data-m]'); if (m) { metode = m.dataset.m; paint(); return; }
    const cp = e.target.closest('[data-cap]'); if (cp) { const f = await pickImage(cp.dataset.cap === '1'); if (f) { proof = await compressImage(f); paint(); } }
  });
  $('#pdSave', s.el).onclick = async () => {
    const nominal = parseMoney(n.value);
    if (!(nominal > 0)) { toast('Isi nominal pembayaran', 'bad'); return; }
    if (nominal > toNum(c.sisa_utang) && !(await confirmDlg({ title: 'Nominal melebihi sisa utang', msg: 'Kelebihan ' + rp(nominal - toNum(c.sisa_utang)) + ' tidak akan dialokasikan. Lanjutkan?' }))) return;
    const id = shortId('BY');
    await Sync.enqueue('payDebt', { pelanggan_id: c.pelanggan_id, nominal, metode, waktu: new Date().toISOString() }, { id, proof: proof ? { ref_id: id, ref_type: 'bayar', dataUrl: proof } : null });
    s.close(); toast('Pembayaran ' + rp(nominal) + ' dicatat', 'ok'); emit('boot');
  };
  paint();
}

/* ================================================================== AKUN */
page('akun', {
  template() { return topbar({ title: 'Akun & Perangkat', right: syncPill() }) + '<div class="wrap js-body" style="padding-top:14px;max-width:760px"></div>'; },
  init(el) { on('printer', () => { if (App.current === 'akun') this.show(el); }); on('synced', () => { if (App.current === 'akun') this.show(el); }); },
  async show(el) {
    const u = App.user, dev = App.session.device || {}, sv = Printer.saved(), rej = await DB.all('rejected');
    const last = Store.get(userKey('lastSync'), 0);
    $('.js-body', el).innerHTML = '<div class="card pad row"><div class="thumb" style="width:56px;height:56px;border-radius:16px;font-size:20px">' + esc(initials(u.nama)) + '</div><div class="grow"><div style="font-weight:800;font-size:17px">' + esc(u.nama) + '</div><div class="muted">@' + esc(u.username) + ' · ' + (u.role === 'OWNER' ? 'Pemilik' : 'Kasir') + '</div></div><span class="pill brand">' + icon('smartphone', 'xs') + esc(dev.kode || '-') + '</span></div>' +
      '<div class="label-row"><span class="sec-title">Sinkronisasi</span>' + syncPill() + '</div><div class="card pad">' +
      '<div class="sum-row"><span class="muted">Menunggu sinkron</span><b class="num">' + App.sync.pending + ' data</b></div>' +
      '<div class="sum-row"><span class="muted">Sinkron terakhir</span><b>' + (last ? fmtDT(last) : '-') + '</b></div>' +
      '<div class="sum-row"><span class="muted">Mode</span><b>' + (navigator.onLine ? 'Online' : 'Offline') + (App.session.offline ? ' (login offline)' : '') + '</b></div>' +
      (rej.length ? '<button class="btn danger block sm" data-act="rejected" type="button" style="margin-top:10px">' + icon('alert', 'sm') + rej.length + ' data ditolak server — tinjau</button>' : '') +
      '<button class="btn outline block" data-act="sync" type="button" style="margin-top:10px">' + icon('refresh', 'sm') + 'Sinkron Sekarang</button></div>' +
      '<div class="label-row"><span class="sec-title">Printer struk</span></div><div class="card pad">' +
      (Printer.supported() ? '<div class="row"><span class="ico-box info">' + icon('bluetooth', 'sm') + '</span><div class="grow"><b>' + esc(sv ? sv.name : 'Belum terhubung') + '</b><div class="muted" style="font-size:13px">Kertas ' + esc(App.settings.ukuran_kertas || '58') + ' mm' + (Printer.status() === 'connected' ? ' · terhubung' : '') + '</div></div></div>' +
        '<div class="grid-3" style="margin-top:12px;gap:8px"><button class="btn outline sm" data-act="pconnect" type="button">' + (sv ? 'Ganti' : 'Hubungkan') + '</button><button class="btn outline sm" data-act="ptest" type="button"' + (sv ? '' : ' disabled') + '>Uji cetak</button><button class="btn outline sm" data-act="pforget" type="button"' + (sv ? '' : ' disabled') + '>Lupakan</button></div>'
        : '<div class="banner info">' + icon('info', 'sm') + '<div>Browser ini tidak mendukung Bluetooth (mis. Safari iPhone). Struk bisa disimpan sebagai gambar atau dikirim lewat WhatsApp.</div></div>') + '</div>' +
      '<div class="label-row"><span class="sec-title">Aplikasi</span></div><div class="card pad">' +
      '<div class="sum-row"><span class="muted">Versi</span><b>' + esc(CFG.APP_VERSION || '1.0.0') + '</b></div>' +
      '<div class="sum-row"><span class="muted">Sesi berakhir</span><b>' + fmtDT(App.session.uiExp) + '</b></div>' +
      '<div class="help">' + icon('info', 'xs') + 'Pasang Qasir ke layar utama (menu browser → "Tambahkan ke layar utama") agar data offline tidak terhapus otomatis.</div>' +
      '<button class="btn outline block sm" data-act="perf" type="button" style="margin-top:10px">' + icon('zap', 'sm') + 'Lihat kecepatan server</button></div>' +
      '<button class="btn danger block lg" data-act="logout" type="button" style="margin-top:18px">' + icon('logout', 'sm') + 'Keluar</button><div style="height:20px"></div>';
    updateSyncUI();
  },
  actions: {
    sync() { if (!navigator.onLine) { toast('Sedang offline', 'warn'); return; } Sync.run(); Boot.refresh(true); },
    async pconnect() { try { const n = await Printer.connect(true); toast('Terhubung ke ' + n, 'ok'); } catch (e) { if (e.name !== 'NotFoundError') toast(e.message, 'bad'); } },
    ptest() { Printer.test(); },
    pforget() { Printer.forget(); },
    logout() { Auth.logout(); },
    perf() {
      const rows = Perf.rows.slice(-15).reverse();
      sheet({ title: 'Kecepatan server', body: rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Aksi</th><th class="r">Total</th><th class="r">Server</th><th class="r">Jaringan</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.action) + '<div class="muted" style="font-size:11px">' + esc(r.at) + '</div></td><td class="r num">' + r.total + ' ms</td><td class="r num">' + (r.server === null ? '-' : r.server + ' ms') + '</td><td class="r num">' + (r.net === null ? '-' : r.net + ' ms') + '</td></tr>').join('') + '</tbody></table></div><div class="help">' + icon('info', 'xs') + '"Jaringan" besar = sinyal lemah / server baru bangun. "Server" besar = data di Sheets banyak.</div>' : emptyState('zap', 'Belum ada data', 'Lakukan beberapa aksi dulu.') });
    },
    async rejected(a, e, el) {
      const rej = await DB.all('rejected');
      const s = sheet({ title: 'Data ditolak server', body: '<div class="banner warn" style="margin-bottom:12px">' + icon('info', 'sm') + '<div>Data ini tidak dihapus. Pemilik toko juga bisa melihatnya di menu "Perlu Ditinjau".</div></div>' +
        rej.map((r) => '<div class="card pad" style="margin-bottom:10px"><div class="row between"><b>' + esc({ tx: 'Transaksi', cancel: 'Pembatalan', stockIn: 'Stok masuk', payDebt: 'Pembayaran utang', customer: 'Pelanggan' }[r.type] || r.type) + '</b><span class="muted" style="font-size:12px">' + fmtDT(r.createdAt) + '</span></div>' +
          '<div class="mono" style="font-size:12.5px;margin-top:4px">' + esc(r.payload.no_nota || r.payload.nama || r.id) + '</div><div class="err">' + esc(r.message) + '</div>' +
          '<div class="row" style="margin-top:10px"><button class="btn outline sm" data-r="retry" data-id="' + esc(r.id) + '" type="button">Kirim ulang</button><button class="btn danger sm" data-r="drop" data-id="' + esc(r.id) + '" type="button">Abaikan</button></div></div>').join('') });
      s.el.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-r]'); if (!b) return;
        const r = rej.find((x) => x.id === b.dataset.id);
        if (b.dataset.r === 'retry') { const it = { id: r.id, type: r.type, payload: r.payload, createdAt: r.createdAt }; await DB.put('outbox', it); }
        await DB.del('rejected', r.id); s.close(); Sync.refreshCount(); Sync.soon(200); this.show(el);
      });
    }
  }
});

/* ============================================================ LAINNYA */
const OWNER_MENU = [
  ['online', 'Jual Online', 'globe'], ['pesanan', 'Pesanan Online', 'inbox'], ['stok', 'Stok', 'package'],
  ['produk', 'Produk', 'package'], ['hpp', 'Kalkulator HPP', 'calculator'], ['bahan', 'Bahan & Biaya', 'coffee'], ['promo', 'Promo', 'tag'],
  ['laporan', 'Laporan', 'file'], ['utang', 'Utang', 'notebook'], ['menu', 'Daftar Menu', 'utensils'], ['menu-ai', 'Prompt Menu AI', 'sparkles'], ['poster', 'Prompt Poster', 'image'],
  ['label', 'Cetak Barcode', 'barcode'], ['karyawan', 'Karyawan', 'users'], ['pengaturan', 'Pengaturan', 'settings'], ['tinjau', 'Perlu Ditinjau', 'inbox'], ['akun', 'Akun', 'user']
];
page('lainnya', {
  role: 'OWNER',
  template() { return topbar({ title: 'Lainnya', sub: 'Semua menu pemilik toko', right: syncPill() }) + '<div class="wrap" style="padding-top:16px"><div class="menu-grid">' + OWNER_MENU.map((m) => '<a class="menu-tile" href="#/' + m[0] + '"><span class="ico-box">' + icon(m[2]) + '</span>' + m[1] + '</a>').join('') + '</div></div>'; },
  show() {}
});
